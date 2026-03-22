const { pool, getPlayer, updatePlayer, getPlayersInTown, addNews } = require('../../db');
const { getRandomMonster, TOWNS } = require('../data');
const { resolvePvP } = require('../combat');
const { getTownScreen, getTavernScreen, getTavernDrinkScreen, getTavernEncounterScreen } = require('../engine');
const { pickEncounter, RESOLVERS } = require('../tavern_events');

// Helper: fetch players in the same town as player
function townPlayers(player) {
  return getPlayersInTown(player.current_town || 'dawnmark', player.id);
}

async function tavern({ player, req, res, pendingMessages }) {
  const today = Math.floor(Date.now() / 86400000);
  if (player.encounter_day !== today && Math.random() < 0.40) {
    const encounter = pickEncounter(player);
    if (encounter) {
      req.session.tavernEncounter = encounter.id;
      await updatePlayer(player.id, { last_encounter_id: encounter.id, encounter_day: today });
      player = await getPlayer(player.id);
      return res.json(getTavernEncounterScreen(player, encounter));
    }
  }
  const others = await townPlayers(player);
  return res.json({ ...getTavernScreen(player, others), pendingMessages });
}

async function tavern_encounter({ player, param, req, res, pendingMessages }) {
  const encounterId = req.session.tavernEncounter;
  if (!encounterId || !RESOLVERS[encounterId]) {
    const others = await townPlayers(player);
    return res.json({ ...getTavernScreen(player, others), pendingMessages: ['`7The moment has passed.'] });
  }
  delete req.session.tavernEncounter;
  return RESOLVERS[encounterId](player, param, req, res, pendingMessages);
}

async function tavern_attack({ player, param, req, res, pendingMessages }) {
  const others = await townPlayers(player);
  const targetIdx = parseInt(param) - 1;
  const target = Number.isInteger(targetIdx) && targetIdx >= 0 ? others[targetIdx] : undefined;

  if (!target)
    return res.json({ ...getTavernScreen(player, await townPlayers(player)), pendingMessages: ['`@Invalid target.'] });

  // Wrap PvP in a transaction to prevent race conditions on both player rows
  const client = await pool.connect();
  let attackerWon, log, freshPlayer, fullTarget, msgs;
  try {
    await client.query('BEGIN');

    // Lock both rows (lower id first to avoid deadlocks)
    const [idA, idB] = [player.id, target.id].sort((a, b) => a - b);
    await client.query('SELECT id FROM players WHERE id = $1 FOR UPDATE', [idA]);
    await client.query('SELECT id FROM players WHERE id = $1 FOR UPDATE', [idB]);

    const { rows: [fp] } = await client.query('SELECT * FROM players WHERE id = $1', [player.id]);
    const { rows: [ft] } = await client.query('SELECT * FROM players WHERE id = $1', [target.id]);
    freshPlayer = fp;
    fullTarget  = ft;

    if (freshPlayer.human_fights_left <= 0) {
      await client.query('ROLLBACK');
      return res.json({ ...getTavernScreen(player, await townPlayers(player)), pendingMessages: ['`@No human fights left today!'] });
    }
    if (fullTarget.dead) {
      await client.query('ROLLBACK');
      return res.json({ ...getTavernScreen(player, await townPlayers(player)), pendingMessages: [`\`7${fullTarget.handle} is already dead.`] });
    }

    // Vampire: Hypnosis — charm-based chance to auto-win without normal combat
    if (freshPlayer.is_vampire) {
      const hypChance = Math.min(0.50, (freshPlayer.charm || 10) / 60);
      if (Math.random() < hypChance) {
        attackerWon = true;
        msgs = [
          `\`#Your eyes meet ${fullTarget.handle}\'s. Your gaze holds them — they cannot move.`,
          `\`#${fullTarget.handle} stands helpless as your will overwhelms theirs.`,
          '`#Hypnosis succeeds. They never had a chance.',
        ];
        await client.query('UPDATE players SET human_fights_left = $1 WHERE id = $2',
          [freshPlayer.human_fights_left - 1, freshPlayer.id]);
        const stolen = Math.floor(Number(fullTarget.gold) * 0.25);
        const expGain = fullTarget.level * 100;
        await client.query('UPDATE players SET kills = $1, gold = $2, exp = $3 WHERE id = $4',
          [freshPlayer.kills + 1, Number(freshPlayer.gold) + stolen, Number(freshPlayer.exp) + expGain, freshPlayer.id]);
        await client.query('UPDATE players SET dead = 1, gold = $1 WHERE id = $2',
          [Math.max(0, Number(fullTarget.gold) - stolen), fullTarget.id]);
        msgs.push(`\`$You take ${stolen.toLocaleString()} gold. +${expGain.toLocaleString()} exp.`);
        await client.query('COMMIT');
        await addNews(`\`#${freshPlayer.handle}\`% mesmerised \`@${fullTarget.handle}\`% with a vampiric gaze and claimed their gold!`);
        player = await getPlayer(player.id);
        return res.json({ ...getTavernScreen(player, await townPlayers(player)), pendingMessages: msgs });
      }
    }

    ({ attackerWon, log } = resolvePvP(freshPlayer, fullTarget));
    msgs = [...log.slice(-5)];

    await client.query('UPDATE players SET human_fights_left = $1 WHERE id = $2',
      [freshPlayer.human_fights_left - 1, freshPlayer.id]);

    if (attackerWon) {
      const stolen = Math.floor(Number(fullTarget.gold) * 0.25);
      const expGain = fullTarget.level * 100;
      await client.query('UPDATE players SET kills = $1, gold = $2, exp = $3 WHERE id = $4',
        [freshPlayer.kills + 1, Number(freshPlayer.gold) + stolen, Number(freshPlayer.exp) + expGain, freshPlayer.id]);
      await client.query('UPDATE players SET dead = 1, gold = $1 WHERE id = $2',
        [Math.max(0, Number(fullTarget.gold) - stolen), fullTarget.id]);
      msgs.push(`\`$You defeated ${fullTarget.handle} and stole ${stolen.toLocaleString()} gold! +${expGain.toLocaleString()} exp.`);
    } else {
      const hpLost = Math.floor(freshPlayer.hit_points * 0.5);
      await client.query('UPDATE players SET hit_points = $1 WHERE id = $2',
        [Math.max(1, freshPlayer.hit_points - hpLost), freshPlayer.id]);
      msgs.push(`\`@You were defeated! You lost ${hpLost} HP.`);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Post-commit: news and response (using sanitised handles to avoid color code injection)
  if (attackerWon) {
    await addNews(`\`@${freshPlayer.handle}\`% defeated \`@${fullTarget.handle}\`% in the tavern and stole gold!`);
  } else {
    await addNews(`\`@${freshPlayer.handle}\`% was defeated by \`$${fullTarget.handle}\`% in the tavern!`);
  }

  player = await getPlayer(player.id);
  return res.json({ ...getTavernScreen(player, await townPlayers(player)), pendingMessages: msgs });
}

async function tavern_intimidate({ player, param, req, res, pendingMessages }) {
  if (player.class !== 1)
    return res.json({ ...getTavernScreen(player, await townPlayers(player)), pendingMessages: ['`@Only Dread Knights can Intimidate!'] });
  if (player.human_fights_left <= 0)
    return res.json({ ...getTavernScreen(player, await townPlayers(player)), pendingMessages: ['`@No human fights left today!'] });

  const others = await townPlayers(player);
  const targetIdx = parseInt(param) - 1;
  const targetStub = Number.isInteger(targetIdx) && targetIdx >= 0 ? others[targetIdx] : undefined;

  if (!targetStub)
    return res.json({ ...getTavernScreen(player, await townPlayers(player)), pendingMessages: ['`@Invalid target.'] });
  if (targetStub.dead)
    return res.json({ ...getTavernScreen(player, await townPlayers(player)), pendingMessages: [`\`7${targetStub.handle} is already dead.`] });

  // Fetch the full target record — getPlayersInTown does not include gold
  const fullTarget = await getPlayer(targetStub.id);
  if (!fullTarget || fullTarget.dead)
    return res.json({ ...getTavernScreen(player, await townPlayers(player)), pendingMessages: [`\`7${targetStub.handle} is no longer available.`] });

  await updatePlayer(player.id, { human_fights_left: player.human_fights_left - 1 });
  const successChance = Math.min(0.80, 0.40 + (player.strength - (fullTarget.strength || 15)) / 200);

  if (Math.random() < successChance) {
    const stolen = Math.floor(Number(fullTarget.gold) * 0.15);
    await updatePlayer(player.id, { gold: Number(player.gold) + stolen });
    await updatePlayer(fullTarget.id, { gold: Math.max(0, Number(fullTarget.gold) - stolen) });
    await addNews(`\`@${player.handle}\`% intimidated \`@${fullTarget.handle}\`% and seized \`$${stolen.toLocaleString()}\`% gold!`);
    player = await getPlayer(player.id);
    return res.json({ ...getTavernScreen(player, await townPlayers(player)), pendingMessages: [
      `\`@You loom over ${fullTarget.handle} with a death stare.`,
      `\`@They hand over ${stolen.toLocaleString()} gold without a word.`,
    ]});
  }

  return res.json({ ...getTavernScreen(player, await townPlayers(player)), pendingMessages: [
    `\`7${fullTarget.handle} meets your gaze and doesn't flinch.`,
    '`7Even a Dread Knight needs more than a stare to shake this one.',
  ]});
}

async function tavern_drink({ player, req, res, pendingMessages }) {
  return res.json({ ...getTavernDrinkScreen(player), pendingMessages });
}

async function tavern_drink_order({ player, param, req, res, pendingMessages }) {
  const DRINKS = {
    ale:     { cost: 10, stamina: 2, name: 'Pint of Ale' },
    wine:    { cost: 25, stamina: 3, name: 'Cup of Wine' },
    spirits: { cost: 50, stamina: 4, name: 'Fine Spirits' },
  };
  const chosen = DRINKS[(param || '').toLowerCase()];
  if (!chosen)
    return res.json({ ...getTavernDrinkScreen(player), pendingMessages: ['`7Unknown drink.'] });

  const drinksToday = player.drinks_today || 0;
  if (drinksToday >= 3)
    return res.json({ ...getTavernDrinkScreen(player), pendingMessages: [`\`7You've had enough drinks today. Hrok cuts you off.`] });
  if (Number(player.gold) < chosen.cost)
    return res.json({ ...getTavernDrinkScreen(player), pendingMessages: [`\`@Not enough gold! A ${chosen.name} costs ${chosen.cost} gold.`] });

  const curStam = player.stamina ?? player.fights_left ?? 10;
  const stamMax = player.stamina_max || 10;
  const newStam = Math.min(stamMax, curStam + chosen.stamina);
  const actualGain = newStam - curStam;
  await updatePlayer(player.id, { gold: Number(player.gold) - chosen.cost, stamina: newStam, drinks_today: drinksToday + 1 });
  player = await getPlayer(player.id);

  const msgs = [`\`6Hrok slides you a ${chosen.name}. You drink deeply.`];
  msgs.push(actualGain > 0
    ? `\`0You feel refreshed! Stamina restored by ${actualGain}. (${newStam}/10)`
    : '`7Your stamina was already full, but the drink was good.');
  return res.json({ ...getTavernDrinkScreen(player), pendingMessages: msgs });
}

async function tavern_gamble({ player, param, req, res, pendingMessages }) {
  const bet = Math.max(0, parseInt(param) || 0);
  if (bet < 10)
    return res.json({ ...getTavernScreen(player, await townPlayers(player)), pendingMessages: ['`7Minimum bet is 10 gold.'] });
  if (bet > Number(player.gold))
    return res.json({ ...getTavernScreen(player, await townPlayers(player)), pendingMessages: [`\`@You don't have ${bet.toLocaleString()} gold to bet!`] });

  const cappedBet = Math.min(bet, Math.min(500 + player.level * 50, Number(player.gold)));
  const playerRoll = 1 + Math.floor(Math.random() * 6);
  const houseRoll  = 1 + Math.floor(Math.random() * 6);
  const msgs = [
    `\`6You toss ${cappedBet.toLocaleString()} gold on the table.`,
    `\`7You roll: \`$${playerRoll}\`7   House rolls: \`@${houseRoll}`,
  ];

  if (playerRoll > houseRoll) {
    await updatePlayer(player.id, { gold: Number(player.gold) + cappedBet });
    msgs.push(`\`0You win! \`$${cappedBet.toLocaleString()}\`0 gold added to your purse.`);
  } else {
    await updatePlayer(player.id, { gold: Number(player.gold) - cappedBet });
    msgs.push(`\`@You lose! The house takes ${cappedBet.toLocaleString()} gold. Better luck next time.`);
  }

  player = await getPlayer(player.id);
  return res.json({ ...getTavernScreen(player, await townPlayers(player)), pendingMessages: msgs });
}

async function tavern_rumours({ player, req, res, pendingMessages }) {
  const monster = getRandomMonster(Number(player.level));
  const templates = [
    `\`6Old Hrok leans in: "Careful out there. Folk say a \`%${monster.name}\`6 has been seen on the trail."`,
    `\`6A cloaked traveller whispers: "I saw a \`%${monster.name}\`6 near the forest edge. Didn't stick around."`,
    `\`6The barmaid sets down your mug: "My cousin lost a horse to a \`%${monster.name}\`6 last night."`,
    `\`6A veteran warrior grumbles: "Damned \`%${monster.name}\`6s are thick in the woods tonight. Watch yourself."`,
    `\`6Someone drew a rough sketch on the table: a \`%${monster.name}\`6. The ink is still fresh.`,
  ];
  const rumour = templates[Math.floor(Math.random() * templates.length)];
  return res.json({ ...getTavernScreen(player, await townPlayers(player)), pendingMessages: [rumour] });
}

async function tavern_buyround({ player, req, res, pendingMessages }) {
  if (Number(player.gold) < 50)
    return res.json({ ...getTavernScreen(player, await townPlayers(player)), pendingMessages: ['`@Not enough gold! Buying a round costs 50 gold.'] });

  const newCharm = Math.min(50, (player.charm || 10) + 1);
  await updatePlayer(player.id, { gold: Number(player.gold) - 50, charm: newCharm });
  const tavernTown = (TOWNS[player.current_town || 'dawnmark'] || TOWNS.dawnmark).name;
  await addNews(`\`6${player.handle}\`% bought the house a round at the tavern in ${tavernTown}!`);
  player = await getPlayer(player.id);

  return res.json({ ...getTavernScreen(player, await townPlayers(player)), pendingMessages: [
    `\`6"Drinks on ${player.handle}!" A cheer goes up from the tavern.`,
    `\`#Your charm has increased to ${newCharm}!`,
  ]});
}

module.exports = {
  tavern,
  players: tavern,
  tavern_attack,
  tavern_intimidate,
  tavern_drink,
  tavern_drink_order,
  tavern_gamble,
  tavern_rumours,
  tavern_buyround,
  tavern_encounter,
};
