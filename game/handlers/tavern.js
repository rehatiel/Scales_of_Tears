const {
  pool, getPlayer, updatePlayer, getPlayersInTown, getJailedPlayersInTown, addNews,
  sendMail, getInboxMail, getSentMail, markMailRead, getUnreadMailCount, getAllPlayers,
  getOnlinePlayers, postBounty, getAllActiveBounties, collectBounties,
  createArenaChallenge, getPendingChallengesForPlayer, getArenaChallenge, updateArenaChallenge,
  placeBet, resolveArenaBets, getOpenArenaChallenge,
  createPvpSession,
} = require('../../db');
const { getRandomMonster, TOWNS } = require('../data');
const { resolvePvP, resolvePvPRound } = require('../combat');
const {
  getTavernScreen, getTavernDrinkScreen, getTavernEncounterScreen,
  getTavernPlayerScreen, getPlayerInspectScreen,
  getMailHubScreen, getMailRosterScreen, getMailInboxScreen, getMailReadScreen, getMailSentScreen, getMailComposeScreen, getBountyPostScreen,
  getBountyBoardScreen, getArenaLobbyScreen, getArenaBettingScreen, getWhoIsOnlineScreen,
  getPvPCombatScreen, getPvPChallengeScreen, getJailScreen,
} = require('../engine');
const { pickEncounter, RESOLVERS } = require('../tavern_events');
const { pushToast } = require('../sse');
const { checkLevelUp } = require('../newday');
const { buildTitleAward } = require('../titles');

const ARENA_TOWNS = new Set(['silverkeep', 'ironhold']);

// Helper: fetch players in the same town as player
function townPlayers(player) {
  return getPlayersInTown(player.current_town || 'dawnmark', player.id);
}

// Helper: build full tavern screen with online/bounty context
async function tavernScreen(player) {
  const [others, online, bounties] = await Promise.all([
    townPlayers(player),
    getOnlinePlayers(player.id),
    getAllActiveBounties(),
  ]);
  const onlineIds = online.map(p => p.id);
  const bountyTargetIds = [...new Set(bounties.map(b => b.target_id))];
  return getTavernScreen(player, others, onlineIds, bountyTargetIds);
}

async function tavern({ player, req, res, pendingMessages }) {
  const today = Math.floor(Date.now() / 86400000);

  const isWidowmaker = player.active_title === 'widowmaker';
  const encounterChance = isWidowmaker ? 0.10 : 0.40;
  const widowmakerMsg = isWidowmaker ? '`@The barflies recognise you. Nobody meets your eye tonight.' : null;

  if (player.encounter_day !== today && Math.random() < encounterChance) {
    const encounter = pickEncounter(player);
    if (encounter) {
      req.session.tavernEncounter = encounter.id;
      await updatePlayer(player.id, { last_encounter_id: encounter.id, encounter_day: today });
      player = await getPlayer(player.id);
      return res.json(getTavernEncounterScreen(player, encounter));
    }
  }

  const msgs = widowmakerMsg ? [...pendingMessages, widowmakerMsg] : pendingMessages;

  // Check unread mail notification
  const unread = await getUnreadMailCount(player.id);
  if (unread > 0) {
    msgs.push(`\`!Hrok slides a note across the bar: "Got ${unread} message${unread > 1 ? 's' : ''} for ya."`);
  }

  // Secret event check
  try {
    const { checkSecrets } = require('../secrets');
    const secret = await checkSecrets(player, 'tavern');
    if (secret) {
      if (secret.damage > 0) {
        await updatePlayer(player.id, { hit_points: Math.max(1, player.hit_points - secret.damage) });
        player = await getPlayer(player.id);
      }
      return res.json({ ...(await tavernScreen(player)), pendingMessages: [...msgs, ...secret.lines] });
    }
  } catch { /* non-critical */ }

  return res.json({ ...(await tavernScreen(player)), pendingMessages: msgs });
}

async function tavern_encounter({ player, param, req, res, pendingMessages }) {
  const encounterId = req.session.tavernEncounter;
  if (!encounterId || !RESOLVERS[encounterId]) {
    return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`7The moment has passed.'] });
  }
  delete req.session.tavernEncounter;
  return RESOLVERS[encounterId](player, param, req, res, pendingMessages);
}

// ── Per-player action submenu ─────────────────────────────────────────────────

async function tavern_player({ player, param, req, res, pendingMessages }) {
  const others = await townPlayers(player);
  // param may be a 1-based index OR a player ID (from back-links)
  let target;
  const n = parseInt(param);
  if (!isNaN(n)) {
    // Try as 1-based index first
    if (n >= 1 && n <= others.length) {
      target = others[n - 1];
    } else {
      // Try as player ID
      target = others.find(p => p.id === n);
    }
  }

  if (!target)
    return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Invalid player number.'] });

  const fullTarget = await getPlayer(target.id);
  if (!fullTarget)
    return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Player not found.'] });

  req.session.tavernTargetId = fullTarget.id;
  const bounties = await getAllActiveBounties();
  const hasArena = ARENA_TOWNS.has(player.current_town || 'dawnmark');

  return res.json({ ...getTavernPlayerScreen(player, fullTarget, hasArena, bounties), pendingMessages });
}

// ── PvP Attack ────────────────────────────────────────────────────────────────

async function tavern_attack({ player, param, req, res, pendingMessages }) {
  const others = await townPlayers(player);

  // param can be a player ID (from per-player screen) or a 1-based index (legacy)
  let target;
  const n = parseInt(param);
  if (!isNaN(n)) {
    target = others.find(p => p.id === n) || (n >= 1 && n <= others.length ? others[n - 1] : undefined);
  }

  if (!target)
    return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Invalid target.'] });
  if (target.id === player.id)
    return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@You cannot attack yourself.'] });
  if (player.human_fights_left <= 0)
    return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@No human fights left today!'] });
  if (target.dead)
    return res.json({ ...(await tavernScreen(player)), pendingMessages: [`\`7${target.handle} is already dead.`] });

  const fullTarget = await getPlayer(target.id);
  if (!fullTarget || fullTarget.dead)
    return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@That player is no longer available.'] });

  // Vampire: Hypnosis — pre-combat instant-win check (before fight counter is spent)
  if (player.is_vampire) {
    const hypChance = Math.min(0.50, (player.charm || 10) / 60);
    if (Math.random() < hypChance) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const [idA, idB] = [player.id, fullTarget.id].sort((a, b) => a - b);
        await client.query('SELECT id FROM players WHERE id = $1 FOR UPDATE', [idA]);
        await client.query('SELECT id FROM players WHERE id = $1 FOR UPDATE', [idB]);
        const stolen = Math.floor(Number(fullTarget.gold) * 0.25);
        const expGain = fullTarget.level * 100;
        await client.query('UPDATE players SET human_fights_left = $1, kills = $2, gold = $3, exp = $4, last_killed_by = $5 WHERE id = $6',
          [player.human_fights_left - 1, player.kills + 1, Number(player.gold) + stolen, Number(player.exp) + expGain, fullTarget.id, player.id]);
        await client.query('UPDATE players SET dead = 1, hit_points = 0, gold = $1, last_killed_by = $2 WHERE id = $3',
          [Math.max(0, Number(fullTarget.gold) - stolen), player.id, fullTarget.id]);
        await client.query('COMMIT');

        await addNews(`\`#${player.handle}\`% mesmerised \`@${fullTarget.handle}\`% with a vampiric gaze and claimed their gold!`);
        const msgs = [
          `\`#Your eyes meet ${fullTarget.handle}'s. Your gaze holds them — they cannot move.`,
          `\`#${fullTarget.handle} stands helpless as your will overwhelms theirs.`,
          '`#Hypnosis succeeds. They never had a chance.',
          `\`$You take ${stolen.toLocaleString()} gold. +${expGain.toLocaleString()} exp.`,
        ];
        const bountyGold = await collectBounties(player.id, fullTarget.id);
        if (bountyGold > 0) msgs.push(`\`$You collect a bounty of ${bountyGold.toLocaleString()} gold!`);
        player = await getPlayer(player.id);
        const hypLevelUp = checkLevelUp(player);
        if (hypLevelUp) {
          await updatePlayer(player.id, hypLevelUp.updates);
          player = await getPlayer(player.id);
          await addNews(`\`$${player.handle}\`% has reached level \`$${hypLevelUp.newLevel}\`%!`);
          msgs.push(`\`$LEVEL UP! You are now level ${hypLevelUp.newLevel}!`);
        }
        return res.json({ ...(await tavernScreen(player)), pendingMessages: msgs });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
  }

  await updatePlayer(player.id, { human_fights_left: player.human_fights_left - 1 });
  player = await getPlayer(player.id);

  const onlinePlayers = await getOnlinePlayers(player.id);
  const isOnline = onlinePlayers.some(p => p.id === fullTarget.id);

  // ── ONLINE target → real-time session ─────────────────────────────────────
  if (isOnline) {
    const { pickChallengeMsg } = require('./pvp_session');
    const challengeMsg = pickChallengeMsg(player.handle, fullTarget.handle);
    const session = await createPvpSession({
      challenger_id:         player.id,
      defender_id:           fullTarget.id,
      challenger_hp:         player.hit_points,
      defender_hp:           fullTarget.hit_points,
      challenger_skill_uses: player.skill_uses_left || 0,
      defender_skill_uses:   fullTarget.skill_uses_left || 0,
      challenge_msg:         challengeMsg,
    });
    req.session.livePvpId = session.id;
    const { getPvPSessionWaitingScreen } = require('../engine');
    const { push: ssePush } = require('../sse');
    const initLog = [
      challengeMsg,
      `\`7Waiting for ${fullTarget.handle} to accept...`,
    ];
    // Push challenge screen to defender immediately via SSE
    try {
      ssePush(fullTarget.id, {
        ...getPvPChallengeScreen(fullTarget, session, player.handle),
        pendingMessages: [],
      });
    } catch {}
    return res.json({
      ...getPvPSessionWaitingScreen(player, session, fullTarget.handle, initLog, []),
      pendingMessages,
    });
  }

  // ── OFFLINE target → AI turn-based combat (session-only) ─────────────────
  req.session.pvpCombat = {
    targetId:        fullTarget.id,
    handle:          fullTarget.handle,
    weapon_name:     fullTarget.weapon_name || 'steel',
    class:           fullTarget.class,
    currentHp:       fullTarget.hit_points,
    maxHp:           fullTarget.hit_points,
    strength:        fullTarget.strength,
    defense:         fullTarget.defense,
    level:           fullTarget.level,
    perks:           fullTarget.perks,
    specialization:  fullTarget.specialization,
    skill_uses_left: fullTarget.skill_uses_left || 0,
    is_vampire:      fullTarget.is_vampire || false,
    charm:           fullTarget.charm || 0,
    round: 1,
    history: [],
  };

  const initLog = [
    { type: 'challenge', text: `\`!You draw your weapon and face ${fullTarget.handle}!` },
    { type: 'status',    text: '`7They are offline — their skills will fight for them.' },
  ];
  return res.json({ ...getPvPCombatScreen(player, req.session.pvpCombat, initLog, false, false, false, false, 1, []), pendingMessages });
}

// ── Pickpocket ────────────────────────────────────────────────────────────────
async function tavern_pickpocket({ player, param, req, res, pendingMessages }) {
  const targetId = parseInt(param);
  if (!targetId) return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Invalid target.'] });

  const others = await townPlayers(player);
  const targetStub = others.find(p => p.id === targetId);
  if (!targetStub)
    return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@That person isn\'t here.'] });

  const target = await getPlayer(targetId);
  if (!target || target.dead)
    return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Target not available.'] });

  // Progressive catch rate: each attempt today reduces success by 10%
  // Guild rep gives a bonus (up to +20%), Rogue class gets +10%
  const attemptsToday = player.pickpocket_today || 0;
  const guildBonus = Math.min(20, Math.floor((player.rep_guild || 0) / 5));
  const classBonus = player.class === 3 ? 10 : 0;
  const successRate = Math.max(5, 40 + guildBonus + classBonus - (attemptsToday * 10)) / 100;

  // Increment attempt counter regardless of outcome
  await updatePlayer(player.id, { pickpocket_today: attemptsToday + 1 });

  if (Math.random() < successRate) {
    // Success — steal 5–15% of target gold, capped at player.level × 200
    const targetGold = Number(target.gold);
    if (targetGold <= 0) {
      player = await getPlayer(player.id);
      return res.json({ ...(await tavernScreen(player)), pendingMessages: [
        `\`7You slip your hand into ${target.handle}'s pocket... nothing there. They're as broke as you.`,
      ]});
    }
    const pct = 0.05 + Math.random() * 0.10;
    const stolen = Math.min(Math.floor(targetGold * pct), player.level * 200);
    await updatePlayer(player.id, { gold: Number(player.gold) + stolen });
    await updatePlayer(target.id, { gold: Math.max(0, targetGold - stolen) });
    await addNews(`\`8Someone's coin purse is lighter in ${TOWNS[player.current_town]?.name || 'town'} tonight.`);
    player = await getPlayer(player.id);
    return res.json({ ...(await tavernScreen(player)), pendingMessages: [
      `\`7You watch ${target.handle} for a moment. Their attention drifts.`,
      `\`7Your hand moves. Coin purse. Done.`,
      `\`$You lifted \`$${stolen.toLocaleString()}\`$ gold without a sound.`,
      attemptsToday >= 2 ? '`8The tavern is starting to notice the pattern. Be careful.' : '',
    ].filter(Boolean)});
  }

  // Failure — caught. Rep hit and jail time.
  const repHit = 5 + attemptsToday * 3;
  const newKnightsRep = Math.max(-100, (player.rep_knights || 0) - repHit);
  // Sentence scales: 15 min base, +15 per prior attempt today
  const jailMinutes = 15 + attemptsToday * 15;
  const jailUntil = Date.now() + jailMinutes * 60 * 1000;
  const townId = player.current_town || 'dawnmark';

  await updatePlayer(player.id, {
    rep_knights: newKnightsRep,
    jailed_until: jailUntil,
    jail_town: townId,
    jail_offense: 'pickpocket',
  });
  await addNews(`\`7A pickpocket was caught in ${TOWNS[townId]?.name || 'town'} and dragged to the cells.`);
  player = await getPlayer(player.id);

  const cellmates = await getJailedPlayersInTown(townId, player.id);

  const catchMsgs = [
    `\`@Your hand moves toward ${target.handle}'s belt.`,
    `\`@${target.handle} catches your wrist. Hard.`,
    '`@"Thief!" The whole tavern turns.',
    '`@Two guards materialise from the shadows like they\'ve been waiting for exactly this.',
    `\`7They haul you out the door and into the street.`,
    `\`8Sentence: ${jailMinutes} minutes in the ${TOWNS[townId]?.name || ''} jail.`,
    `\`8(Knights reputation −${repHit})`,
  ];
  return res.json({ ...getJailScreen(player, cellmates), pendingMessages: catchMsgs });
}

async function tavern_intimidate({ player, param, req, res, pendingMessages }) {
  if (player.class !== 1)
    return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Only Dread Knights can Intimidate!'] });
  if (player.human_fights_left <= 0)
    return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@No human fights left today!'] });

  const others = await townPlayers(player);
  // param is player ID (from per-player screen) or legacy index
  const n = parseInt(param);
  let targetStub = others.find(p => p.id === n) || (n >= 1 && n <= others.length ? others[n - 1] : undefined);

  if (!targetStub)
    return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Invalid target.'] });
  if (targetStub.dead)
    return res.json({ ...(await tavernScreen(player)), pendingMessages: [`\`7${targetStub.handle} is already dead.`] });

  const fullTarget = await getPlayer(targetStub.id);
  if (!fullTarget || fullTarget.dead)
    return res.json({ ...(await tavernScreen(player)), pendingMessages: [`\`7${targetStub.handle} is no longer available.`] });

  await updatePlayer(player.id, { human_fights_left: player.human_fights_left - 1 });
  const successChance = Math.min(0.80, 0.40 + (player.strength - (fullTarget.strength || 15)) / 200);

  if (Math.random() < successChance) {
    const stolen = Math.floor(Number(fullTarget.gold) * 0.15);
    await updatePlayer(player.id, { gold: Number(player.gold) + stolen });
    await updatePlayer(fullTarget.id, { gold: Math.max(0, Number(fullTarget.gold) - stolen) });
    await addNews(`\`@${player.handle}\`% intimidated \`@${fullTarget.handle}\`% and seized \`$${stolen.toLocaleString()}\`% gold!`);
    player = await getPlayer(player.id);
    return res.json({ ...(await tavernScreen(player)), pendingMessages: [
      `\`@You loom over ${fullTarget.handle} with a death stare.`,
      `\`@They hand over ${stolen.toLocaleString()} gold without a word.`,
    ]});
  }

  return res.json({ ...(await tavernScreen(player)), pendingMessages: [
    `\`7${fullTarget.handle} meets your gaze and doesn't flinch.`,
    '`7Even a Dread Knight needs more than a stare to shake this one.',
  ]});
}

// ── Inspect ───────────────────────────────────────────────────────────────────

async function tavern_inspect({ player, param, req, res, pendingMessages }) {
  const targetId = parseInt(param);
  if (!targetId) return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Invalid target.'] });
  const target = await getPlayer(targetId);
  if (!target) return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Player not found.'] });
  return res.json({ ...getPlayerInspectScreen(player, target), pendingMessages });
}

// ── Drinks ────────────────────────────────────────────────────────────────────

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

// ── Gamble ────────────────────────────────────────────────────────────────────

async function tavern_gamble({ player, param, req, res, pendingMessages }) {
  const bet = Math.max(0, parseInt(param) || 0);
  if (bet < 10)
    return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`7Minimum bet is 10 gold.'] });
  if (bet > Number(player.gold))
    return res.json({ ...(await tavernScreen(player)), pendingMessages: [`\`@You don't have ${bet.toLocaleString()} gold to bet!`] });

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
  return res.json({ ...(await tavernScreen(player)), pendingMessages: msgs });
}

// ── Rumours ───────────────────────────────────────────────────────────────────

async function tavern_rumours({ player, req, res, pendingMessages }) {
  const { getActiveWorldEvent, getWorldState } = require('../../db');
  const { getEventDef } = require('../world_events');

  const monster = getRandomMonster(Number(player.level));

  const pool2 = [
    { w: 3, text: `\`6Old Hrok leans in: "Careful out there. Folk say a \`%${monster.name}\`6 has been seen on the trail."` },
    { w: 3, text: `\`6A cloaked traveller whispers: "I saw a \`%${monster.name}\`6 near the forest edge. Didn't stick around."` },
    { w: 3, text: `\`6The barmaid sets down your mug: "My cousin lost a horse to a \`%${monster.name}\`6 last night."` },
    { w: 3, text: `\`6A veteran warrior grumbles: "Damned \`%${monster.name}\`6s are thick in the woods tonight. Watch yourself."` },
  ];

  const activeEvent = await getActiveWorldEvent();
  if (activeEvent) {
    const evDef = getEventDef(activeEvent.type);
    if (evDef) {
      const eventLines = {
        plague:        [`\`6A pale-faced merchant coughs into his sleeve. "Half the caravans won't leave town. The fever's spreading."`,
                        `\`6"Healers are charging triple," the barman says grimly. "Supply and demand, they say."`],
        war:           [`\`6A soldier at the bar stares at nothing. "The eastern roads are gone. Bandits took them."`,
                        `\`6"War's good for business if you're selling steel," grins the mercenary. "Bad if you're buying anything else."`],
        dragon_stirs:  [`\`6Someone carved a dragon silhouette into the table. Fresh chips surround it.`,
                        `\`6"The Red Dragon's shadow passed overhead at dawn," whispers a merchant. "I've never moved a cart faster."`],
        arcane_storm:  [`\`6A mage in the corner stares at her hands — they glow faintly, and not by choice.`,
                        `\`6"Wild magic ate three cows last night," the farmer says flatly. "No one knows how. Or cares to ask."`],
        grand_fair:    [`\`6"Quality like this, I'd normally charge twice as much," the trader beams, sliding a box across the table.`,
                        `\`6The crowd outside is twice the usual size. Merchants from as far as Velmora, someone says.`],
        undead_rising: [`\`6A gravedigger drinks alone in the corner. His tools are bent and he won't say why.`,
                        `\`6"Don't travel at night. Not now," says a cloaked woman, not meeting your eyes.`],
      };
      for (const text of (eventLines[activeEvent.type] || [])) {
        pool2.push({ w: 4, text });
      }
    }
  }

  const suppRaw = await getWorldState('eco:suppressions');
  if (suppRaw) {
    const today = Math.floor(Date.now() / 86400000);
    const suppressed = Object.entries(JSON.parse(suppRaw))
      .filter(([, exp]) => exp > today)
      .map(([k]) => k.replace(/_/g, ' '));
    if (suppressed.length) {
      const name = suppressed[0];
      pool2.push({ w: 4, text: `\`6"Hunters went mad for \`%${name}\`6s last week," says the trapper. "Now there's none to be found. Give it a couple days."` });
      pool2.push({ w: 3, text: `\`6A leather-worker sighs: "No \`%${name}\`6 pelts in the market. Overhunted. It happens every season."` });
    }
  }

  const infestRaw = await getWorldState('eco:infestations');
  if (infestRaw) {
    const today = Math.floor(Date.now() / 86400000);
    const infestations = JSON.parse(infestRaw);
    const playerTown = player.current_town || 'dawnmark';
    const adjacent = TOWNS[playerTown]?.connections || [];
    for (const adj of adjacent) {
      const list = (infestations[adj] || []).filter(e => e.expiresDay > today);
      if (list.length) {
        const inf = list[0];
        const adjName = TOWNS[adj]?.name || adj;
        pool2.push({ w: 5, text: `\`6A rider just in from \`%${adjName}\`6 looks shaken: "The wilds are swarming with \`@${inf.monsterName}\`6s out there. Something's driving them."` });
        break;
      }
    }
  }

  const total = pool2.reduce((s, e) => s + e.w, 0);
  let r = Math.random() * total;
  let chosen = pool2[pool2.length - 1].text;
  for (const entry of pool2) {
    r -= entry.w;
    if (r <= 0) { chosen = entry.text; break; }
  }

  return res.json({ ...(await tavernScreen(player)), pendingMessages: [chosen] });
}

// ── Buy round ─────────────────────────────────────────────────────────────────

async function tavern_buyround({ player, req, res, pendingMessages }) {
  if (Number(player.gold) < 50)
    return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Not enough gold! Buying a round costs 50 gold.'] });

  const newCharm = Math.min(50, (player.charm || 10) + 1);
  await updatePlayer(player.id, { gold: Number(player.gold) - 50, charm: newCharm });
  const tavernTown = (TOWNS[player.current_town || 'dawnmark'] || TOWNS.dawnmark).name;
  await addNews(`\`6${player.handle}\`% bought the house a round at the tavern in ${tavernTown}!`);
  player = await getPlayer(player.id);

  return res.json({ ...(await tavernScreen(player)), pendingMessages: [
    `\`6"Drinks on ${player.handle}!" A cheer goes up from the tavern.`,
    `\`#Your charm has increased to ${newCharm}!`,
  ]});
}

// ── Mail ──────────────────────────────────────────────────────────────────────

async function tavern_mail_hub({ player, req, res, pendingMessages }) {
  const unread = await getUnreadMailCount(player.id);
  return res.json({ ...getMailHubScreen(player, unread), pendingMessages });
}

async function tavern_mail_inbox({ player, req, res, pendingMessages }) {
  const mails = await getInboxMail(player.id);
  return res.json({ ...getMailInboxScreen(player, mails), pendingMessages });
}

async function tavern_mail_sent({ player, req, res, pendingMessages }) {
  const mails = await getSentMail(player.id);
  return res.json({ ...getMailSentScreen(player, mails), pendingMessages });
}

async function tavern_mail_read({ player, param, req, res, pendingMessages }) {
  const mailId = parseInt(param);
  if (!mailId) return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Invalid mail.'] });
  const mails = await getInboxMail(player.id);
  const mail = mails.find(m => m.id === mailId);
  if (!mail) return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Message not found or not yours.'] });
  await markMailRead(mailId, player.id);
  return res.json({ ...getMailReadScreen(player, mail), pendingMessages });
}

async function tavern_mail_new({ player, req, res, pendingMessages }) {
  const allPlayers = await getAllPlayers();
  return res.json({ ...getMailRosterScreen(player, allPlayers), pendingMessages });
}

async function tavern_mail_compose({ player, param, req, res, pendingMessages }) {
  const targetId = parseInt(param);
  if (!targetId) return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@No target selected.'] });
  const target = await getPlayer(targetId);
  if (!target || !target.setup_complete) return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Player not found.'] });
  req.session.mailTargetId = targetId;
  return res.json({ ...getMailComposeScreen(player, target.handle), pendingMessages });
}

async function tavern_mail_send({ player, param, req, res, pendingMessages }) {
  const targetId = req.session.mailTargetId;
  if (!targetId) return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Session expired. Please select the player again.'] });

  const message = (param || '').trim().slice(0, 280);
  if (!message) return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Message cannot be empty.'] });

  const target = await getPlayer(targetId);
  if (!target) return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Player not found.'] });

  await sendMail(player.id, targetId, message);
  delete req.session.mailTargetId;
  // Notify recipient immediately if they're online
  pushToast(targetId, `\`0You have a new message from \`7${player.handle}\`0. Check the tavern mailbox.`);
  player = await getPlayer(player.id);

  return res.json({ ...(await tavernScreen(player)), pendingMessages: [
    `\`0Letter delivered to Hrok for ${target.handle}.`,
  ]});
}

// ── Bounties ──────────────────────────────────────────────────────────────────

async function tavern_bounty_board({ player, req, res, pendingMessages }) {
  const bounties = await getAllActiveBounties();
  return res.json({ ...getBountyBoardScreen(player, bounties), pendingMessages });
}

async function tavern_bounty_post({ player, param, req, res, pendingMessages }) {
  const targetId = parseInt(param);
  if (!targetId) return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@No target specified.'] });
  const target = await getPlayer(targetId);
  if (!target || !target.setup_complete) return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Player not found.'] });
  if (target.id === player.id) return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@You cannot post a bounty on yourself.'] });
  req.session.bountyTargetId = targetId;
  return res.json({ ...getBountyPostScreen(player, target), pendingMessages });
}

async function tavern_bounty_confirm({ player, param, req, res, pendingMessages }) {
  const targetId = req.session.bountyTargetId;
  if (!targetId) return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Session expired. Please select the player again.'] });

  const gold = Math.floor(parseInt(param) || 0);
  if (gold < 50) return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Minimum bounty is 50 gold.'] });
  if (gold > Number(player.gold)) return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@You don\'t have that much gold.'] });

  const target = await getPlayer(targetId);
  if (!target) return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Player not found.'] });

  await updatePlayer(player.id, { gold: Number(player.gold) - gold });
  await postBounty(player.id, targetId, gold);
  delete req.session.bountyTargetId;

  await addNews(`\`@A bounty of \`$${gold.toLocaleString()}\`@ gold has been placed on \`@${target.handle}\`%!`);
  pushToast(targetId, `\`@A bounty of \`$${gold.toLocaleString()}\`@ gold has been placed on your head!`);
  player = await getPlayer(player.id);

  return res.json({ ...(await tavernScreen(player)), pendingMessages: [
    `\`@${gold.toLocaleString()} gold bounty posted on ${target.handle}.`,
    '`7Their name now hangs on the Wanted Board.',
  ]});
}

// ── Who's online ──────────────────────────────────────────────────────────────

async function tavern_online({ player, req, res, pendingMessages }) {
  const online = await getOnlinePlayers(player.id);
  return res.json({ ...getWhoIsOnlineScreen(player, online), pendingMessages });
}

// ── Arena ──────────────────────────────────────────────────────────────────────

async function tavern_arena_challenge({ player, param, req, res, pendingMessages }) {
  const town = player.current_town || 'dawnmark';
  if (!ARENA_TOWNS.has(town))
    return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@The arena is only available in Silverkeep and Ironhold.'] });

  const targetId = parseInt(param);
  if (!targetId) return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@No target specified.'] });
  const target = await getPlayer(targetId);
  if (!target || !target.setup_complete) return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Player not found.'] });
  if (target.id === player.id) return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@You cannot challenge yourself.'] });

  // Check for existing pending challenge
  const existing = await pool.query(
    `SELECT id FROM arena_challenges WHERE challenger_id = $1 AND defender_id = $2 AND status = 'pending' AND created_at > $3`,
    [player.id, targetId, Date.now() - 30 * 60 * 1000]
  );
  if (existing.rows.length)
    return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`7You already have a pending challenge to that player.'] });

  const challenge = await createArenaChallenge(player.id, targetId, town);
  await addNews(`\`!${player.handle}\`% has challenged \`$${target.handle}\`% to an arena duel!`);
  pushToast(targetId, `\`!${player.handle}\`% has challenged you to an arena duel! Visit the tavern arena to accept. (Challenge #${challenge.id})`);

  return res.json({ ...(await tavernScreen(player)), pendingMessages: [
    `\`!You challenge ${target.handle} to a duel in the arena!`,
    `\`7They must accept before the challenge expires (30 minutes).`,
    `\`7Challenge ID: #${challenge.id} — tell them to check the arena.`,
  ]});
}

async function arena_lobby({ player, req, res, pendingMessages }) {
  const town = player.current_town || 'dawnmark';
  if (!ARENA_TOWNS.has(town))
    return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@The arena is only available in Silverkeep and Ironhold.'] });

  const pending = await getPendingChallengesForPlayer(player.id);
  const townName = TOWNS[town]?.name || town;
  return res.json({ ...getArenaLobbyScreen(player, pending, townName), pendingMessages });
}

async function arena_accept({ player, param, req, res, pendingMessages }) {
  const challengeId = parseInt(param);
  const challenge = await getArenaChallenge(challengeId);

  if (!challenge || challenge.status !== 'pending')
    return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@That challenge is no longer valid.'] });
  if (challenge.defender_id !== player.id)
    return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@That challenge is not for you.'] });
  if (Date.now() > challenge.created_at + 30 * 60 * 1000) {
    await updateArenaChallenge(challengeId, { status: 'expired' });
    return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@That challenge has expired.'] });
  }

  const challenger = await getPlayer(challenge.challenger_id);
  if (!challenger) return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Challenger not found.'] });

  // Resolve arena fight — no death, no gold loss
  const { attackerWon, log } = resolvePvP(challenger, player);
  const winner = attackerWon ? challenger : player;
  const loser  = attackerWon ? player : challenger;
  const msgs = [...log.slice(-5)];

  await updateArenaChallenge(challengeId, {
    status: 'completed',
    winner_id: winner.id,
    resolved_at: Date.now(),
  });

  // Pay out spectator bets
  await resolveArenaBets(challengeId, winner.id);

  msgs.push(`\`$${winner.handle}\`% wins the arena duel!`);
  msgs.push(`\`7No gold or gear was lost. Honour is its own reward.`);

  await addNews(`\`!${winner.handle}\`% defeated \`$${loser.handle}\`% in the ${TOWNS[challenge.town]?.name || challenge.town} arena!`);

  player = await getPlayer(player.id);
  return res.json({ ...(await tavernScreen(player)), pendingMessages: msgs });
}

async function arena_bet({ player, param, req, res, pendingMessages }) {
  const challengeId = parseInt(param);
  const challenge = await getOpenArenaChallenge(challengeId);
  if (!challenge || challenge.status !== 'pending')
    return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@No active challenge found.'] });

  req.session.arenaBetChallenge = challengeId;
  return res.json({ ...getArenaBettingScreen(player, challenge), pendingMessages });
}

async function arena_bet_challenger({ player, param, req, res, pendingMessages }) {
  return _placeBetFor(player, param, 'challenger', req, res, pendingMessages);
}
async function arena_bet_defender({ player, param, req, res, pendingMessages }) {
  return _placeBetFor(player, param, 'defender', req, res, pendingMessages);
}

async function _placeBetFor(player, param, side, req, res, pendingMessages) {
  const challengeId = req.session.arenaBetChallenge;
  if (!challengeId) return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Session expired.'] });
  const amount = parseInt(param) || 0;
  if (amount < 10) return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Minimum bet is 10 gold.'] });
  if (amount > Number(player.gold)) return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@Not enough gold.'] });

  const challenge = await getArenaChallenge(challengeId);
  if (!challenge || challenge.status !== 'pending')
    return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`@That fight is no longer accepting bets.'] });

  await updatePlayer(player.id, { gold: Number(player.gold) - amount });
  const bet = await placeBet(challengeId, player.id, side, amount);
  if (!bet) {
    await updatePlayer(player.id, { gold: Number(player.gold) + amount }); // refund
    return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`7You already placed a bet on that fight.'] });
  }

  delete req.session.arenaBetChallenge;
  player = await getPlayer(player.id);
  return res.json({ ...(await tavernScreen(player)), pendingMessages: [
    `\`$You bet ${amount.toLocaleString()} gold on the ${side}.`,
    '`7You\'ll collect if they win — or lose it if they don\'t.',
  ]});
}

// ── Interactive PvP (turn-based duel) ─────────────────────────────────────────

async function pvp_combat({ player, action, req, res, pendingMessages }) {
  const pvpState = req.session.pvpCombat;
  if (!pvpState)
    return res.json({ ...(await tavernScreen(player)), pendingMessages: ['`7The duel has already ended.'] });

  // Map action to combat verb; validate power move availability
  const act = { pvp_attack: 'attack', pvp_run: 'run', pvp_power: 'power' }[action] || 'attack';

  if (act === 'power') {
    if ((player.skill_uses_left || 0) <= 0)
      return res.json({
        ...getPvPCombatScreen(player, pvpState, [], false, false, false, false, pvpState.round, pvpState.history),
        pendingMessages: [...pendingMessages, '`@No power uses left!'],
      });
    await updatePlayer(player.id, { skill_uses_left: player.skill_uses_left - 1 });
    player = await getPlayer(player.id);
  }

  const { playerDamage, defenderDamage, fled, defenderFled, log } = resolvePvPRound(player, pvpState, act);

  const round       = pvpState.round;
  const newTargetHp = Math.max(0, pvpState.currentHp - playerDamage);
  const newPlayerHp = Math.max(0, player.hit_points - defenderDamage);
  const newHistory  = [...pvpState.history, ...log].slice(-30);

  // Attacker fled
  if (fled) {
    req.session.pvpCombat = null;
    return res.json({
      ...getPvPCombatScreen(player, pvpState, log, false, false, true, false, round, pvpState.history),
      pendingMessages,
    });
  }

  // Defender fled
  if (defenderFled) {
    req.session.pvpCombat = null;
    pvpState.currentHp = newTargetHp;
    return res.json({
      ...getPvPCombatScreen(player, pvpState, log, false, false, false, true, round, pvpState.history),
      pendingMessages,
    });
  }

  // Target defeated
  if (newTargetHp <= 0) {
    req.session.pvpCombat = null;
    const fullTarget = await getPlayer(pvpState.targetId);
    const msgs = [...pendingMessages];

    if (fullTarget && !fullTarget.dead) {
      const stolen = Math.floor(Number(fullTarget.gold) * 0.25);
      let expGain = pvpState.level * 100;
      const isRevenge = player.last_killed_by === pvpState.targetId;
      if (isRevenge) expGain = Math.floor(expGain * 1.5);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const [idA, idB] = [player.id, pvpState.targetId].sort((a, b) => a - b);
        await client.query('SELECT id FROM players WHERE id = $1 FOR UPDATE', [idA]);
        await client.query('SELECT id FROM players WHERE id = $1 FOR UPDATE', [idB]);
        await client.query(
          'UPDATE players SET kills = $1, gold = $2, exp = $3, last_killed_by = $4, hit_points = $5 WHERE id = $6',
          [player.kills + 1, Number(player.gold) + stolen, Number(player.exp) + expGain, pvpState.targetId, newPlayerHp, player.id]
        );
        await client.query(
          'UPDATE players SET dead = 1, hit_points = 0, gold = $1, last_killed_by = $2 WHERE id = $3',
          [Math.max(0, Number(fullTarget.gold) - stolen), player.id, pvpState.targetId]
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      await addNews(`\`@${player.handle}\`% slew \`@${pvpState.handle}\`% in a duel and claimed their gold!`);
      const bountyGold = await collectBounties(player.id, pvpState.targetId);
      if (bountyGold > 0) msgs.push(`\`$You collect a bounty of ${bountyGold.toLocaleString()} gold!`);
      if (isRevenge) msgs.push('`$Revenge! +50% EXP bonus.');
      msgs.push(`\`$You defeat ${pvpState.handle} and steal ${stolen.toLocaleString()} gold! +${expGain.toLocaleString()} exp.`);

      player = await getPlayer(player.id);
      const lvlUp = checkLevelUp(player);
      if (lvlUp) {
        await updatePlayer(player.id, lvlUp.updates);
        player = await getPlayer(player.id);
        await addNews(`\`$${player.handle}\`% has reached level \`$${lvlUp.newLevel}\`%!`);
        msgs.push(`\`$LEVEL UP! You are now level ${lvlUp.newLevel}!`);
      }
      if (player.kills >= 10) {
        const titleAward = buildTitleAward(player, 'widowmaker');
        if (titleAward) {
          await updatePlayer(player.id, titleAward);
          player = await getPlayer(player.id);
          msgs.push('`@You have earned the title: `$the Widowmaker`@. The tavern falls silent.');
          await addNews(`\`@${player.handle}\`% has earned the title \`$the Widowmaker\`% — their tenth kill.`);
        }
      }
    }

    pvpState.currentHp = 0;
    return res.json({ ...getPvPCombatScreen(player, pvpState, log, true, false, false, false, round, pvpState.history), pendingMessages: msgs });
  }

  // Player defeated
  if (newPlayerHp <= 0) {
    req.session.pvpCombat = null;
    const fullTarget = await getPlayer(pvpState.targetId);
    const stolen  = Math.floor(Number(player.gold) * 0.25);
    const expGain = pvpState.level * 100;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const [idA, idB] = [player.id, pvpState.targetId].sort((a, b) => a - b);
      await client.query('SELECT id FROM players WHERE id = $1 FOR UPDATE', [idA]);
      await client.query('SELECT id FROM players WHERE id = $1 FOR UPDATE', [idB]);
      await client.query(
        'UPDATE players SET dead = 1, hit_points = 0, gold = $1, last_killed_by = $2 WHERE id = $3',
        [Math.max(0, Number(player.gold) - stolen), pvpState.targetId, player.id]
      );
      if (fullTarget && !fullTarget.dead) {
        await client.query(
          'UPDATE players SET kills = $1, gold = $2, exp = $3, last_killed_by = $4 WHERE id = $5',
          [fullTarget.kills + 1, Number(fullTarget.gold) + stolen, Number(fullTarget.exp) + expGain, player.id, pvpState.targetId]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await addNews(`\`@${pvpState.handle}\`% slew \`@${player.handle}\`% in a duel!`);
    player = await getPlayer(player.id);
    pvpState.currentHp = newTargetHp;
    return res.json({
      ...getPvPCombatScreen(player, pvpState, log, false, true, false, false, round, pvpState.history),
      pendingMessages,
    });
  }

  // Combat continues
  pvpState.currentHp = newTargetHp;
  pvpState.round     = round + 1;
  pvpState.history   = newHistory;
  await updatePlayer(player.id, { hit_points: newPlayerHp });
  player = await getPlayer(player.id);

  return res.json({
    ...getPvPCombatScreen(player, pvpState, log, false, false, false, false, round + 1, newHistory),
    pendingMessages,
  });
}

const pvp_attack = pvp_combat;
const pvp_run    = pvp_combat;
const pvp_power  = pvp_combat;

module.exports = {
  tavern,
  players: tavern,
  tavern_player,
  tavern_attack,
  tavern_pickpocket,
  tavern_intimidate,
  tavern_inspect,
  tavern_drink,
  tavern_drink_order,
  tavern_gamble,
  tavern_rumours,
  tavern_buyround,
  tavern_encounter,
  tavern_mail_hub,
  tavern_mail_new,
  tavern_mail_inbox,
  tavern_mail_sent,
  tavern_mail_read,
  tavern_mail_compose,
  tavern_mail_send,
  tavern_bounty_board,
  tavern_bounty_post,
  tavern_bounty_confirm,
  tavern_online,
  tavern_arena_challenge,
  arena_lobby,
  arena_accept,
  arena_bet,
  arena_bet_challenger,
  arena_bet_defender,
  pvp_attack,
  pvp_run,
  pvp_power,
};
