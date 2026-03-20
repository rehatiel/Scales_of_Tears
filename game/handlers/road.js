// Road travel handlers — walking between towns
const { getPlayer, updatePlayer, addNews, getCaptivePlayers } = require('../../db');
const { TOWNS, getRoadSegments } = require('../data');
const {
  getTownScreen, getWorldMapScreen, getCampingScreen, getRoadScreen,
  getCaptiveScreen, getRoadEncounterScreen, getRoadFightScreen,
  getTravelOptionsScreen,
} = require('../engine');
const { resolveRound } = require('../combat');
const { pickRoadEncounter, buildCampAmbush } = require('../road_events');

// ── Show travel options (carriage vs walk) ────────────────────────────────────
async function travel_options({ player, param, req, res, pendingMessages }) {
  const dest = TOWNS[param];
  if (!dest) return res.json({ ...getWorldMapScreen(player), pendingMessages: ['`@Unknown destination.'] });

  const from = TOWNS[player.current_town || 'harood'] || TOWNS.harood;
  if (!from.connections.includes(param))
    return res.json({ ...getWorldMapScreen(player), pendingMessages: [`\`@No direct route from ${from.name} to ${dest.name}.`] });
  if (dest.minLevel && player.level < dest.minLevel)
    return res.json({ ...getWorldMapScreen(player), pendingMessages: [
      `\`@The road to ${dest.name} is too dangerous for you.`,
      `\`@You must reach level \`$${dest.minLevel}\`@ before travelling there.`,
    ]});

  return res.json({ ...getTravelOptionsScreen(player, param), pendingMessages });
}

// ── Start walking ─────────────────────────────────────────────────────────────
async function walk_start({ player, param, req, res, pendingMessages }) {
  const dest = TOWNS[param];
  if (!dest) return res.json({ ...getWorldMapScreen(player), pendingMessages: ['`@Unknown destination.'] });

  const from = TOWNS[player.current_town || 'harood'] || TOWNS.harood;
  if (!from.connections.includes(param))
    return res.json({ ...getWorldMapScreen(player), pendingMessages: [`\`@No direct route.`] });
  if (dest.minLevel && player.level < dest.minLevel)
    return res.json({ ...getWorldMapScreen(player), pendingMessages: [
      `\`@The road to ${dest.name} is too dangerous for you.`,
    ]});

  const stam = player.stamina ?? player.fights_left ?? 10;
  if (stam <= 0)
    return res.json({ ...getTravelOptionsScreen(player, param), pendingMessages: ['`@You are too exhausted to walk. Rest at the inn first.'] });

  const segs = getRoadSegments(from.id, param);
  await updatePlayer(player.id, {
    travel_to: param,
    travel_segments_done: 0,
    travel_segments_total: segs,
  });
  player = await getPlayer(player.id);

  return res.json({ ...getRoadScreen(player), pendingMessages: [
    `\`6You set off on foot toward ${dest.name}.`,
    `\`8The road stretches ahead — ${segs} segments of walking lie before you.`,
  ]});
}

// ── Continue walking (one segment) ───────────────────────────────────────────
async function walk_continue({ player, param, req, res, pendingMessages }) {
  if (!player.travel_to) return res.json({ ...getTownScreen(player), pendingMessages: ['`7You are not on the road.'] });

  const dest = TOWNS[player.travel_to];
  const stam = player.stamina ?? player.fights_left ?? 10;

  // Out of stamina → force camp
  if (stam <= 0) {
    await updatePlayer(player.id, { camping: 1 });
    player = await getPlayer(player.id);
    return res.json({ ...getCampingScreen(player), pendingMessages: [
      '`@You are exhausted. You have no choice but to make camp.',
      '`8Your stamina will restore when a new day comes.',
    ]});
  }

  const done  = (player.travel_segments_done || 0) + 1;
  const total = player.travel_segments_total || getRoadSegments(player.current_town || 'harood', player.travel_to);

  // Consume 1 stamina
  await updatePlayer(player.id, {
    stamina: stam - 1,
    travel_segments_done: done,
  });
  player = await getPlayer(player.id);

  // Arrived?
  if (done >= total) {
    const arrivedTown = TOWNS[player.travel_to];
    await updatePlayer(player.id, {
      current_town: player.travel_to,
      travel_to: null,
      travel_segments_done: 0,
      travel_segments_total: 0,
      camping: 0,
      guide_hired: 0,
      road_hint: null,
    });
    player = await getPlayer(player.id);
    return res.json({ ...getTownScreen(player), pendingMessages: [
      `\`6You arrive in \`$${arrivedTown.name}\`6 on foot, weary but whole.`,
      `\`8${arrivedTown.tagline}`,
    ]});
  }

  // Show road hint flavour if player has one
  const hintMsg = player.road_hint
    ? { bandits: '`#Your contact warned of bandits ahead. Stay alert.', monster: '`#Your contact warned of a creature lurking on this road.', safe: '`2Your contact said this stretch is clear.', encounter: '`#Your contact mentioned something unusual on this road.' }[player.road_hint]
    : null;

  // Check for road encounter (35% base, halved if guide hired)
  const encounterChance = player.guide_hired ? 0.175 : 0.35;
  if (Math.random() < encounterChance) {
    const encounter = pickRoadEncounter(player);
    req.session.roadEncounter = encounter;
    const extraMsgs = hintMsg ? [hintMsg] : [];
    return res.json({ ...getRoadEncounterScreen(player, encounter.data), pendingMessages: [
      ...extraMsgs,
      `\`8Segment ${done}/${total} — Something crosses your path...`,
    ]});
  }

  // Quiet segment — check if stamina hits 0 now
  const newStam = player.stamina ?? 10;
  if (newStam <= 0) {
    await updatePlayer(player.id, { camping: 1 });
    player = await getPlayer(player.id);
    return res.json({ ...getCampingScreen(player), pendingMessages: [
      `\`8Segment ${done}/${total} passed.`,
      '`@You are completely spent. You must make camp.',
    ]});
  }

  const quietMsgs = [`\`8Segment ${done}/${total} — The road is quiet. You press on.`];
  if (hintMsg && done === 1) quietMsgs.unshift(hintMsg);
  return res.json({ ...getRoadScreen(player), pendingMessages: quietMsgs });
}

// ── Make camp voluntarily ─────────────────────────────────────────────────────
async function road_make_camp({ player, req, res, pendingMessages }) {
  if (!player.travel_to)
    return res.json({ ...getTownScreen(player), pendingMessages });

  await updatePlayer(player.id, { camping: 1 });
  player = await getPlayer(player.id);
  return res.json({ ...getCampingScreen(player), pendingMessages: ['`6You set up camp for the night.'] });
}

// ── Wait at camp ──────────────────────────────────────────────────────────────
async function camp_wait({ player, req, res, pendingMessages }) {
  // Night ambush chance: 20%
  if (Math.random() < 0.20) {
    const ambush = buildCampAmbush(player);
    req.session.roadFight = {
      enemy: ambush.monster,
      log: [],
      fromCamp: true,
    };
    player = await getPlayer(player.id);
    return res.json({ ...getRoadFightScreen(player, ambush.monster, ambush.lines), pendingMessages: [
      '`@Something stirs in the darkness — you are ambushed!',
      '`@Deal with this before you can rest.',
    ]});
  }

  // Peaceful night — log out and wait for the new day
  req.session.destroy();
  return res.json({
    screen: 'login',
    title: '',
    lines: [],
    choices: [],
    pendingMessages: [],
    campLogout: true,
  });
}

// ── Turn back (abandon trip) ──────────────────────────────────────────────────
async function road_turn_back({ player, req, res, pendingMessages }) {
  const fromId = player.current_town || 'harood';
  const from   = TOWNS[fromId] || TOWNS.harood;

  await updatePlayer(player.id, {
    travel_to: null,
    travel_segments_done: 0,
    travel_segments_total: 0,
    camping: 0,
  });
  player = await getPlayer(player.id);

  return res.json({ ...getTownScreen(player), pendingMessages: [
    `\`7You turn back and return to \`%${from.name}\`7.`,
  ]});
}

// ── Resolve a road encounter choice ──────────────────────────────────────────
async function road_encounter_resolve({ player, param, req, res, pendingMessages }) {
  const encounter = req.session.roadEncounter;
  if (!encounter) return walk_continue({ player, param: null, req, res, pendingMessages });

  const type = encounter.data.type;
  const data = encounter.data;

  // ── Uneventful: just continue
  if (type === 'uneventful') {
    delete req.session.roadEncounter;
    return walk_continue({ player, param: null, req, res, pendingMessages: [...pendingMessages, ...data.lines] });
  }

  // ── Helpful traveller
  if (type === 'helpful_traveller') {
    delete req.session.roadEncounter;
    await updatePlayer(player.id, { gold: Number(player.gold) + data.goldGain });
    player = await getPlayer(player.id);
    return res.json({ ...getRoadScreen(player), pendingMessages: [
      ...data.lines,
      `\`$You received ${data.goldGain.toLocaleString()} gold.`,
    ]});
  }

  // ── Dead traveller
  if (type === 'dead_traveller') {
    delete req.session.roadEncounter;
    if (param === 'take') {
      await updatePlayer(player.id, { gold: Number(player.gold) + data.goldGain });
      player = await getPlayer(player.id);
      return res.json({ ...getRoadScreen(player), pendingMessages: [
        '`8You rifle through the dead man\'s pockets.',
        `\`$You find ${data.goldGain.toLocaleString()} gold. It\'ll spend.`,
      ]});
    }
    return res.json({ ...getRoadScreen(player), pendingMessages: [
      '`7You leave the body and walk on.',
    ]});
  }

  // ── Road bandits: fight or pay
  if (type === 'road_bandits') {
    delete req.session.roadEncounter;
    if (param === 'pay') {
      const paid = Math.min(data.goldDemand, Number(player.gold));
      await updatePlayer(player.id, { gold: Number(player.gold) - paid });
      player = await getPlayer(player.id);
      return res.json({ ...getRoadScreen(player), pendingMessages: [
        paid < data.goldDemand
          ? `\`@"Not enough?" The bandit spits and takes what you have: ${paid.toLocaleString()} gold.`
          : `\`7You hand over ${paid.toLocaleString()} gold. They let you pass.`,
      ]});
    }
    // Fight
    req.session.roadFight = { enemy: { ...data.monster }, log: [] };
    return res.json({ ...getRoadFightScreen(player, data.monster, []), pendingMessages: [
      '`@You draw your weapon!',
    ]});
  }

  // ── Corrupt sheriff
  if (type === 'corrupt_sheriff') {
    delete req.session.roadEncounter;
    if (param === 'pay') {
      const paid = Math.min(data.toll, Number(player.gold));
      await updatePlayer(player.id, { gold: Number(player.gold) - paid });
      player = await getPlayer(player.id);
      return res.json({ ...getRoadScreen(player), pendingMessages: [
        `\`7You pay the "toll". ${paid.toLocaleString()} gold gone. The sheriff tips his hat.`,
      ]});
    }
    if (param === 'bluff') {
      if (player.level >= 5 || player.strength > 80) {
        return res.json({ ...getRoadScreen(player), pendingMessages: [
          '`0You meet his eyes with a cold stare. The deputies step back.',
          '`0The sheriff decides you\'re not worth the trouble. He waves you through.',
        ]});
      }
      // Bluff failed → fight
      req.session.roadFight = { enemy: { ...data.monster }, log: [] };
      return res.json({ ...getRoadFightScreen(player, data.monster, []), pendingMessages: [
        '`@Your bluff falls flat. The sheriff draws his weapon!',
      ]});
    }
    // Fight
    req.session.roadFight = { enemy: { ...data.monster }, log: [] };
    return res.json({ ...getRoadFightScreen(player, data.monster, []), pendingMessages: [
      '`@You refuse the toll. The sheriff draws his weapon!',
    ]});
  }

  // ── Road monster: fight or run
  if (type === 'road_monster') {
    delete req.session.roadEncounter;
    if (param === 'run') {
      // 45% flee chance
      if (Math.random() < 0.45) {
        return res.json({ ...getRoadScreen(player), pendingMessages: [
          `\`7You run from the ${data.monster.name} and make it to safety.`,
        ]});
      }
      // Failed to flee — forced fight
      req.session.roadFight = { enemy: { ...data.monster }, log: [] };
      return res.json({ ...getRoadFightScreen(player, data.monster, [`\`@You couldn't escape!`]), pendingMessages });
    }
    req.session.roadFight = { enemy: { ...data.monster }, log: [] };
    return res.json({ ...getRoadFightScreen(player, data.monster, []), pendingMessages: [
      '`@You draw your weapon and face the creature!',
    ]});
  }

  // ── Kidnapper gang (women)
  if (type === 'kidnapper_gang') {
    delete req.session.roadEncounter;
    if (param === 'submit') {
      // Become captive
      const town = TOWNS[player.current_town || 'harood'] || TOWNS.harood;
      await updatePlayer(player.id, {
        captive: 1,
        captive_location: `${town.name} outskirts`,
        travel_to: null,
        travel_segments_done: 0,
        travel_segments_total: 0,
        camping: 0,
      });
      await addNews(`\`#${player.handle}\`% has been taken captive on the road!`);
      player = await getPlayer(player.id);
      return res.json({ ...getCaptiveScreen(player), pendingMessages: [
        '`@They bind your wrists. You are their prisoner now.',
        '`#Someone may yet come to free you... or you may find your own way out.',
      ]});
    }
    // Fight
    req.session.roadFight = { enemy: { ...data.monster }, log: [] };
    return res.json({ ...getRoadFightScreen(player, data.monster, []), pendingMessages: [
      '`@You draw your weapon. They won\'t take you without a fight!',
    ]});
  }

  // ── Damsel trap (men)
  if (type === 'damsel_trap') {
    delete req.session.roadEncounter;
    if (param === 'walk_on') {
      return res.json({ ...getRoadScreen(player), pendingMessages: [
        '`7You pass the woman without stopping. Her cries fade behind you.',
        '`8Whether the right choice or not, you\'ll never know.',
      ]});
    }
    if (param === 'negotiate') {
      // Pay gold to walk away. 50% chance bandits attack anyway.
      const paid = Math.min(data.goldLoss, Number(player.gold));
      await updatePlayer(player.id, { gold: Number(player.gold) - paid });
      player = await getPlayer(player.id);
      if (Math.random() < 0.50) {
        // Bandits attack anyway
        req.session.roadFight = { enemy: { ...data.monster }, log: [] };
        return res.json({ ...getRoadFightScreen(player, data.monster, []), pendingMessages: [
          `\`@You offer ${paid.toLocaleString()} gold. They take it — then attack anyway!`,
          '`@"Kill him! Leave no witnesses!"',
        ]});
      }
      return res.json({ ...getRoadScreen(player), pendingMessages: [
        `\`7You hand over ${paid.toLocaleString()} gold. The men melt back into the trees.`,
        '`8The woman disappears with them. You knew something was wrong.',
      ]});
    }
    // Help = investigate = bandits surround and attack
    req.session.roadFight = { enemy: { ...data.monster }, log: [] };
    return res.json({ ...getRoadFightScreen(player, data.monster, []), pendingMessages: [
      '`@You step toward the woman. Men rush from the trees behind you!',
      '`@"Got one! Cut him down!"',
    ]});
  }

  // Fallback — just continue
  delete req.session.roadEncounter;
  return walk_continue({ player, param: null, req, res, pendingMessages });
}

// ── Road combat round ─────────────────────────────────────────────────────────
async function road_encounter_fight({ player, req, res, pendingMessages }) {
  return _roadCombat(player, 'attack', req, res, pendingMessages);
}

async function road_encounter_run({ player, req, res, pendingMessages }) {
  return _roadCombat(player, 'run', req, res, pendingMessages);
}

async function road_encounter_power({ player, req, res, pendingMessages }) {
  return _roadCombat(player, 'power', req, res, pendingMessages);
}

async function _roadCombat(player, action, req, res, pendingMessages) {
  const fight = req.session.roadFight;
  if (!fight) return walk_continue({ player, param: null, req, res, pendingMessages });

  // Guard power move against skill uses
  if (action === 'power' && player.skill_uses_left <= 0)
    return res.json({ ...getRoadFightScreen(player, fight.enemy, []), pendingMessages: ['`@No skill uses left!'] });
  if (action === 'power') {
    await updatePlayer(player.id, { skill_uses_left: player.skill_uses_left - 1 });
    player = await getPlayer(player.id);
  }

  const { playerDamage, monsterDamage, poisonDamage, fled, appliedPoison, log } = resolveRound(player, fight.enemy, action);

  const newEnemyHp = Math.max(0, fight.enemy.currentHp - playerDamage);
  fight.enemy.currentHp = newEnemyHp;

  const newHp = Math.max(0, player.hit_points - monsterDamage - (poisonDamage || 0));
  await updatePlayer(player.id, {
    hit_points: newHp,
    poisoned: appliedPoison ? Math.max(3, player.poisoned || 0) : (player.poisoned || 0),
  });
  player = await getPlayer(player.id);

  const logLines = log.map(l => (typeof l === 'string' ? l : l.text));

  // Fled
  if (fled) {
    delete req.session.roadFight;
    return res.json({ ...getRoadScreen(player), pendingMessages: [
      ...logLines,
      '`7You escape back down the road, heart pounding.',
    ]});
  }

  // Enemy dead
  if (newEnemyHp <= 0) {
    delete req.session.roadFight;
    const goldGain = fight.enemy.gold || 0;
    const expGain  = fight.enemy.exp  || 0;
    await updatePlayer(player.id, {
      gold: Number(player.gold) + goldGain,
      exp:  Number(player.exp)  + expGain,
    });
    player = await getPlayer(player.id);

    const fromCamp = fight.fromCamp;
    return res.json({ ...(fromCamp ? getCampingScreen(player) : getRoadScreen(player)), pendingMessages: [
      ...logLines,
      `\`0You defeated the ${fight.enemy.name}!`,
      `\`$+${goldGain.toLocaleString()} gold  +${expGain.toLocaleString()} exp`,
    ]});
  }

  // Player dead
  if (newHp <= 0) {
    delete req.session.roadFight;
    await updatePlayer(player.id, {
      near_death: 1,
      near_death_by: fight.enemy.name,
      travel_to: null,
      travel_segments_done: 0,
      travel_segments_total: 0,
      camping: 0,
    });
    await addNews(`\`@${player.handle}\`% was struck down on the road by a \`%${fight.enemy.name}\`%!`);
    player = await getPlayer(player.id);
    const { getNearDeathScreen } = require('../engine');
    return res.json({ ...getNearDeathScreen(player, fight.enemy, [], 0, []), pendingMessages: [
      ...logLines,
      `\`@You fall on the road, badly wounded.`,
    ]});
  }

  // Continue fight
  req.session.roadFight = fight;
  return res.json({ ...getRoadFightScreen(player, fight.enemy, logLines), pendingMessages });
}

// ── Captive actions ───────────────────────────────────────────────────────────
async function captive_wait({ player, req, res, pendingMessages }) {
  return res.json({ ...getCaptiveScreen(player), pendingMessages: [
    '`8You wait. The hours stretch long.',
    '`7Perhaps someone will come...',
  ]});
}

async function captive_buy_freedom({ player, req, res, pendingMessages }) {
  const price = player.level * 1000;
  if (Number(player.gold) < price)
    return res.json({ ...getCaptiveScreen(player), pendingMessages: ['`@You don\'t have enough gold.'] });

  await updatePlayer(player.id, {
    gold: Number(player.gold) - price,
    captive: 0,
    captive_location: null,
  });
  await addNews(`\`$${player.handle}\`% bought their way out of captivity.`);
  player = await getPlayer(player.id);

  return res.json({ ...getTownScreen(player), pendingMessages: [
    `\`6You hand over ${price.toLocaleString()} gold. The guard pockets it and unlocks your chains.`,
    '`0You are free.',
  ]});
}

async function captive_escape({ player, req, res, pendingMessages }) {
  if (Math.random() < 0.40) {
    await updatePlayer(player.id, { captive: 0, captive_location: null });
    await addNews(`\`0${player.handle}\`% escaped from captivity!`);
    player = await getPlayer(player.id);
    return res.json({ ...getTownScreen(player), pendingMessages: [
      '`0You wait for your chance — and seize it.',
      '`0You slip your bonds and vanish into the night. You are free!',
    ]});
  }

  return res.json({ ...getCaptiveScreen(player), pendingMessages: [
    '`@You make your move... but they catch you.',
    '`@They tie your bonds tighter. Escape will be harder now.',
  ]});
}

// ── Rescue a captive (from tavern) ────────────────────────────────────────────
async function rescue_captive({ player, param, req, res, pendingMessages }) {
  const captives = await getCaptivePlayers(player.id);
  const target   = captives[parseInt(param) - 1];
  if (!target)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`@No such captive.'] });

  const cost = target.level * 500;
  if (Number(player.gold) < cost)
    return res.json({ ...getTownScreen(player), pendingMessages: [`\`@You need ${cost.toLocaleString()} gold to rescue ${target.handle}.`] });

  await updatePlayer(player.id, { gold: Number(player.gold) - cost });
  await updatePlayer(target.id, { captive: 0, captive_location: null });
  await addNews(`\`0${player.handle}\`% paid \`$${cost.toLocaleString()}\`% gold to rescue \`!${target.handle}\`% from captivity!`);
  player = await getPlayer(player.id);

  return res.json({ ...getTownScreen(player), pendingMessages: [
    `\`6You pay ${cost.toLocaleString()} gold and secure ${target.handle}'s release.`,
    `\`0${target.handle} is free thanks to your generosity.`,
  ]});
}

module.exports = {
  travel_options,
  walk_start,
  walk_continue,
  road_make_camp,
  camp_wait,
  road_turn_back,
  road_encounter_resolve,
  road_encounter_fight,
  road_encounter_run,
  road_encounter_power,
  captive_wait,
  captive_buy_freedom,
  captive_escape,
  rescue_captive,
};
