const { getPlayer, updatePlayer, getNearDeathPlayers, addNews } = require('../../db');
const { getRandomMonster, getWeaponByNum, getArmorByNum } = require('../data');
const { resolveRound } = require('../combat');
const { checkLevelUp } = require('../newday');
const { FOREST_EVENTS } = require('../forest_events');
const { parseWounds, getWoundType, getWoundSeverity, woundChance, getBleedDamage, getCrushDefPenalty, rollInfection, resolveInfection } = require('../wounds');
const { adjustReps, getHostileFactions, makeAssassin } = require('../factions');
const {
  getTownScreen, getForestEncounterScreen, getForestCombatScreen,
  getForestEventScreen, getRescueOpportunityScreen, getLevelUpScreen,
  getNpcRescueScreen, getNearDeathScreen,
} = require('../engine');

async function forest({ player, req, res, pendingMessages }) {
  if (player.dead)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`@You are dead! Come back tomorrow.'] });

  const forestStamina = player.stamina ?? player.fights_left ?? 10;
  if (forestStamina <= 0)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`@You are too exhausted to enter the forest! Rest at the tavern.'] });

  // Vampires take sunlight damage during daylight hours (6:00–18:00 UTC)
  if (player.is_vampire) {
    const hour = new Date().getUTCHours();
    if (hour >= 6 && hour < 18) {
      const sunDmg = Math.max(1, Math.floor(player.hit_max * 0.08));
      const newHp = Math.max(1, player.hit_points - sunDmg);
      await updatePlayer(player.id, { hit_points: newHp });
      player = await getPlayer(player.id);
      pendingMessages = [...pendingMessages, `\`#The sunlight sears your pale flesh for \`@${sunDmg}\`# damage as you step outside!`];
    }
  }

  const nearDeathList = await getNearDeathPlayers(player.id);
  if (nearDeathList.length > 0 && Math.random() < 0.5) {
    const victim = nearDeathList[0];
    req.session.rescueTarget = victim.id;
    return res.json({ ...getRescueOpportunityScreen(player, victim), pendingMessages });
  }

  await updatePlayer(player.id, { stamina: forestStamina - 1 });
  player = await getPlayer(player.id);

  const eligibleEvents = FOREST_EVENTS.filter(e =>
    e.minLevel <= player.level && (!e.classOnly || e.classOnly === player.class)
  );
  if (eligibleEvents.length > 0 && Math.random() < 0.30) {
    const event = eligibleEvents[Math.floor(Math.random() * eligibleEvents.length)];
    req.session.forestEvent = { eventId: event.id };
    return res.json({ ...getForestEventScreen(player, event), pendingMessages });
  }

  req.session.forestDepth = 0;

  // Faction assassin — 20% chance per hostile faction to intercept this run
  const hostileFactions = getHostileFactions(player);
  if (hostileFactions.length > 0) {
    for (const faction of hostileFactions) {
      if (Math.random() < 0.20) {
        const assassin = makeAssassin(faction, player.level);
        req.session.combat = { monster: assassin, round: 1, history: [], isAssassin: true, factionId: faction.id };
        return res.json({ ...getForestEncounterScreen(player, assassin), pendingMessages: [
          ...pendingMessages,
          `\`@You sense something wrong. A figure detaches from the tree line.`,
        ]});
      }
    }
  }

  const monster = getRandomMonster(Number(player.level));
  req.session.combat = { monster, round: 1, history: [] };
  return res.json({ ...getForestEncounterScreen(player, monster), pendingMessages });
}

async function forest_event({ player, param, req, res, pendingMessages }) {
  const { eventId } = req.session.forestEvent || {};
  if (!eventId) return res.json({ ...getTownScreen(player), pendingMessages });

  const event = FOREST_EVENTS.find(e => e.id === eventId);
  if (!event) return res.json({ ...getTownScreen(player), pendingMessages });

  let outcome = event.outcomes[param];
  if (!outcome) return res.json({ ...getTownScreen(player), pendingMessages });

  if (outcome.charmCheck && player.charm < outcome.charmCheck) {
    outcome = outcome.charmFail || { fight: true, msg: ['Your charm fails you!'] };
  }

  req.session.forestEvent = null;
  const msgs = [...(outcome.msg || [])];
  const updates = {};

  if (outcome.goldFlat) {
    const delta = outcome.goldFlat < 0 ? Math.max(-Number(player.gold), outcome.goldFlat) : outcome.goldFlat;
    updates.gold = Number(player.gold) + delta;
    if (delta < 0) msgs.push(`\`@You lost ${Math.abs(delta).toLocaleString()} gold!`);
    else if (delta > 0) msgs.push(`\`0You find ${delta.toLocaleString()} gold!`);
  }
  if (outcome.goldMult) {
    const g = outcome.goldMult * player.level;
    updates.gold = (updates.gold ?? Number(player.gold)) + g;
    msgs.push(`\`0You gain ${g.toLocaleString()} gold!`);
  }
  if (outcome.expMult) {
    const xp = outcome.expMult * player.level;
    updates.exp = Number(player.exp) + xp;
    msgs.push(`\`0You gain ${xp.toLocaleString()} experience!`);
  }
  let hpBase = player.hit_points;
  if (outcome.hpPct) {
    const delta = Math.floor(outcome.hpPct * player.hit_max);
    hpBase = Math.max(1, Math.min(player.hit_max, hpBase + delta));
    if (delta < 0) msgs.push(`\`@You lost ${Math.abs(delta)} hit points!`);
    else msgs.push(`\`0You recovered ${delta} hit points!`);
  }
  if (outcome.hp) {
    hpBase = Math.max(1, Math.min(player.hit_max, hpBase + outcome.hp));
    if (outcome.hp < 0) msgs.push(`\`@You lost ${Math.abs(outcome.hp)} more hit points from the shock!`);
    else msgs.push(`\`0You recovered ${outcome.hp} additional hit points!`);
  }
  if (outcome.hpPct || outcome.hp) updates.hit_points = hpBase;
  if (outcome.charm) {
    updates.charm = player.charm + outcome.charm;
    msgs.push(outcome.charm > 0 ? `\`#Your charm increased by ${outcome.charm}!` : `\`@Your charm decreased by ${Math.abs(outcome.charm)}!`);
  }
  if (outcome.gem) {
    if (outcome.gem < 0 && player.gems <= 0) {
      msgs.push('`7You have no gems to offer.');
      const refuseOutcome = event.outcomes.refuse || event.outcomes.leave;
      if (refuseOutcome) msgs.push(...(refuseOutcome.msg || []));
    } else {
      updates.gems = Math.max(0, player.gems + outcome.gem);
      if (outcome.gem > 0) msgs.push(`\`0You found ${outcome.gem} gem${outcome.gem > 1 ? 's' : ''}!`);
    }
  }
  if (outcome.poison) { updates.poisoned = 3; msgs.push('`2Poison seeps into your wounds...'); }
  if (outcome.questStart) {
    updates.quest_id = outcome.questStart;
    updates.quest_step = 1;
    msgs.push(`\`$A new quest has begun: ${outcome.questStart.replace(/_/g, ' ')}`);
  }

  if (Object.keys(updates).length) {
    await updatePlayer(player.id, updates);
    player = await getPlayer(player.id);
  }

  if (outcome.expMult) {
    const levelUp = checkLevelUp(player);
    if (levelUp) {
      await updatePlayer(player.id, levelUp.updates);
      player = await getPlayer(player.id);
      await addNews(`\`$${player.handle}\`% has advanced to level \`$${levelUp.newLevel}\`%!`);
      if (!outcome.fight)
        return res.json({ ...getLevelUpScreen(player, levelUp.newLevel, levelUp.hpGain, levelUp.strGain), pendingMessages: msgs });
    }
  }

  if (outcome.fight) {
    const monster = getRandomMonster(Number(player.level));
    req.session.combat = { monster, round: 1, history: [] };
    player = await getPlayer(player.id);
    return res.json({ ...getForestEncounterScreen(player, monster), pendingMessages: msgs });
  }

  return res.json({ ...getTownScreen(player), pendingMessages: msgs });
}

async function rescue({ player, req, res, pendingMessages }) {
  const targetId = req.session.rescueTarget;
  req.session.rescueTarget = null;
  if (!targetId) return res.json({ ...getTownScreen(player), pendingMessages });

  const victim = await getPlayer(targetId);
  if (!victim || !victim.near_death) {
    return res.json({ ...getTownScreen(player), pendingMessages: [`\`7${victim ? victim.handle : 'That warrior'} was already rescued by someone else.`] });
  }

  const savedHp = Math.max(1, Math.floor(victim.hit_max * 0.3));
  await updatePlayer(targetId, { near_death: 0, near_death_by: '', hit_points: savedHp });
  const expGain = victim.level * 75;
  const rescueRepUpdates = adjustReps(player, { knights: 3, druids: 2 });
  await updatePlayer(player.id, { exp: Number(player.exp) + expGain, charm: player.charm + 1, ...rescueRepUpdates });
  await addNews(`\`0${player.handle}\`% heroically rescued \`$${victim.handle}\`% from death in the forest!`);
  player = await getPlayer(player.id);

  const levelUp = checkLevelUp(player);
  if (levelUp) {
    await updatePlayer(player.id, levelUp.updates);
    player = await getPlayer(player.id);
    await addNews(`\`$${player.handle}\`% has advanced to level \`$${levelUp.newLevel}\`%!`);
    return res.json({
      ...getLevelUpScreen(player, levelUp.newLevel, levelUp.hpGain, levelUp.strGain),
      pendingMessages: [
        `\`0You carry ${victim.handle} to safety! They owe you their life.`,
        `\`$You gain ${expGain.toLocaleString()} experience and +1 charm for your heroism!`,
      ],
    });
  }

  return res.json({ ...getTownScreen(player), pendingMessages: [
    `\`0You carry ${victim.handle} to safety! They owe you their life.`,
    `\`$You gain ${expGain.toLocaleString()} experience and +1 charm for your heroism!`,
  ]});
}

async function rescue_skip({ player, req, res, pendingMessages }) {
  req.session.rescueTarget = null;
  const stam = player.stamina ?? player.fights_left ?? 10;
  if (stam <= 0)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`@You are too exhausted to enter the forest!'] });
  await updatePlayer(player.id, { stamina: stam - 1 });
  player = await getPlayer(player.id);
  const monster = getRandomMonster(Number(player.level));
  req.session.combat = { monster, round: 1, history: [] };
  return res.json({ ...getForestEncounterScreen(player, monster), pendingMessages });
}

async function forest_combat({ action, player, req, res, pendingMessages }) {
  const combat = req.session.combat;
  if (!combat) return res.json(getTownScreen(player));

  const { monster } = combat;
  const round = combat.round || 1;
  const history = combat.history || [];
  const act = { forest_attack: 'attack', forest_run: 'run', forest_power: 'power' }[action];

  if (act === 'power' && player.skill_uses_left <= 0)
    return res.json({ ...getForestEncounterScreen(player, monster), pendingMessages: ['`@No skill uses left!'] });
  if (act === 'power') {
    await updatePlayer(player.id, { skill_uses_left: player.skill_uses_left - 1 });
    player = await getPlayer(player.id);
  }

  const { playerDamage, monsterDamage, poisonDamage, fled, monsterFled, appliedPoison, log } = resolveRound(player, monster, act);
  const newHistory = [...history, ...log].slice(-30);

  let finalPlayerDamage = playerDamage;
  if (act !== 'run' && (player.rage_active || req.session.raging)) {
    finalPlayerDamage = Math.floor(playerDamage * 2.0);
    log.push({ text: `\`@RAGE UNLEASHED! You strike for \`$${finalPlayerDamage}\`@ damage!` });
    await updatePlayer(player.id, { rage_active: 0 });
    req.session.raging = false;
  }

  const weaponBonus = getWeaponByNum(player.weapon_num)?.bonus;
  if (!fled && !monsterFled && act !== 'run') {
    if (weaponBonus === 'double_strike' && Math.random() < 0.20) {
      const bonus = Math.floor(finalPlayerDamage * 0.5);
      finalPlayerDamage += bonus;
      log.push({ text: `\`$Double Strike! You hit again for \`$${bonus}\`$ extra damage!` });
    }
    if (weaponBonus === 'stun' && Math.random() < 0.12)
      log.push({ text: `\`$You stun the ${monster.name}! It staggers!` });
  }

  const armorBonus = getArmorByNum(player.arm_num)?.bonus;
  let finalMonsterDamage = monsterDamage + (poisonDamage || 0);
  if (!fled && !monsterFled) {
    if (armorBonus === 'regen') {
      finalMonsterDamage = Math.max(0, finalMonsterDamage - 2);
      log.push({ text: '`2Your armour regenerates 2 HP.' });
    }
    if (armorBonus === 'evasion' && Math.random() < 0.15) {
      log.push({ text: '`2You evade the attack! No damage taken.' });
      finalMonsterDamage = poisonDamage || 0;
    }
    if (armorBonus === 'thorns' && monsterDamage > 0) {
      monster.currentHp = Math.max(0, monster.currentHp - 10);
      log.push({ text: '`2Your armour spikes reflect 10 damage!' });
    }
  }

  let willPoison = appliedPoison;
  if (appliedPoison && armorBonus === 'poison_resist' && Math.random() < 0.50) {
    log.push({ text: '`2Your armour resists the poison!' });
    willPoison = false;
  }
  if (willPoison) await updatePlayer(player.id, { poisoned: 3 });

  if (fled) {
    req.session.combat = null;
    return res.json(getForestCombatScreen(player, monster, log, false, false, round, history));
  }

  if (monsterFled) {
    req.session.combat = null;
    const goldGain = Math.floor(monster.gold * 0.5);
    const expGain = Math.floor(monster.exp * 0.5);
    await updatePlayer(player.id, { gold: Number(player.gold) + goldGain, exp: Number(player.exp) + expGain });
    player = await getPlayer(player.id);
    log.push({ text: `\`7The ${monster.name} fled! You salvage ${goldGain} gold and ${expGain} exp.` });
    const depth = req.session.forestDepth || 0;
    return res.json(getForestCombatScreen(player, monster, log, true, false, round, history, depth));
  }

  monster.currentHp = Math.max(0, monster.currentHp - finalPlayerDamage);

  // ── Wound & infection rolling ───────────────────────────────────────────────
  const wounds = parseWounds(player);
  let woundUpdates = {};

  // Bleed damage from existing slash wounds
  const slashBleed = wounds
    .filter(w => w.type === 'slash')
    .reduce((sum, w) => sum + getBleedDamage(w, player.hit_max), 0);
  if (slashBleed > 0) {
    log.push({ text: `\`@Your wounds bleed for \`@${slashBleed}\`% damage!` });
  }

  // Crush defense penalty applied before damage (already resolved via resolveRound, but log it)
  const crushPenalty = getCrushDefPenalty(wounds);
  if (crushPenalty > 0 && finalMonsterDamage > 0) {
    log.push({ text: `\`8Crushed bones leave you exposed! (+${Math.round(crushPenalty * 100)}% damage taken)` });
  }

  // New wound from this round's monster hit
  if (!fled && !monsterFled && finalMonsterDamage > 0) {
    const severity = getWoundSeverity(monster, player);
    const isCrit = log.some(l => l.type === 'monster_crit');
    if (Math.random() < woundChance(severity, isCrit)) {
      const wType = getWoundType(monster);
      wounds.push({ type: wType, severity, source: monster.name });
      woundUpdates.wounds = JSON.stringify(wounds);
      log.push({ text: `\`@You suffer a ${severity === 3 ? 'critical' : severity === 2 ? 'serious' : 'minor'} ${wType} wound from the ${monster.name}!` });

      // Infection roll for bite wounds
      if (wType === 'bite') {
        const infResult = rollInfection(monster);
        if (infResult) {
          const newInfType = resolveInfection(player.infection_type || '', infResult.infectionType);
          if (newInfType !== player.infection_type) {
            woundUpdates.infection_type = newInfType;
            woundUpdates.infection_stage = 0;
            woundUpdates.infection_days = 0;
          }
          log.push({ text: infResult.message });
        }
      }
    }
  }

  const totalPlayerDamage = finalMonsterDamage + slashBleed;
  const newPlayerHp = Math.max(0, player.hit_points - totalPlayerDamage);
  await updatePlayer(player.id, { hit_points: newPlayerHp, ...woundUpdates });
  player = await getPlayer(player.id);
  req.session.combat = { monster, round: round + 1, history: newHistory };

  if (monster.currentHp <= 0) {
    req.session.combat = null;
    const { getMonsterFamily } = require('../wounds');
    const family = getMonsterFamily(monster);
    // Rep adjustments based on monster family
    const killRep = {};
    if (family === 'undead')   { killRep.knights = 2; killRep.necromancers = -1; }
    if (family === 'humanoid') { killRep.knights = 2; killRep.merchants = 1; }
    if (family === 'beast')    { killRep.druids = -1; }
    if (family === 'giant')    { killRep.knights = 1; }
    // Assassin kill: rep boost with that faction for standing up to them
    if (monster.isAssassin && monster.factionId) killRep[monster.factionId] = (killRep[monster.factionId] || 0) + 5;
    const repUpdates = adjustReps(player, killRep);

    await updatePlayer(player.id, { gold: Number(player.gold) + monster.gold, exp: Number(player.exp) + monster.exp, ...repUpdates });
    player = await getPlayer(player.id);
    if (monster.isAssassin) {
      await addNews(`\`$${player.handle}\`% defeated a ${monster.name} sent by the \`@${monster.factionId}\`% in the forest!`);
    } else if (Math.random() < 0.10) {
      await addNews(`\`0${player.handle}\`% slew a \`@${monster.name}\`% in the forest!`);
    }

    if (Math.random() < 0.05) {
      await updatePlayer(player.id, { gems: player.gems + 1 });
      log.push({ text: '`$You find a shimmering gem on the ground!' });
      player = await getPlayer(player.id);
    }

    const levelUp = checkLevelUp(player);
    if (levelUp) {
      await updatePlayer(player.id, levelUp.updates);
      player = await getPlayer(player.id);
      await addNews(`\`$${player.handle}\`% has advanced to level \`$${levelUp.newLevel}\`%!`);
      return res.json({ ...getLevelUpScreen(player, levelUp.newLevel, levelUp.hpGain, levelUp.strGain), pendingMessages: log.map(l => l.text) });
    }

    const depth = req.session.forestDepth || 0;
    return res.json(getForestCombatScreen(player, monster, log, true, false, round, history, depth));
  }

  if (newPlayerHp <= 0) {
    req.session.combat = null;
    req.session.forestDepth = 0;
    const deathRoll = Math.random();
    const npcSavers = ['A passing healer', 'A wandering monk', 'A forest ranger', 'A traveling merchant', 'A grizzled veteran', 'A mysterious stranger'];
    const saver = npcSavers[Math.floor(Math.random() * npcSavers.length)];
    const npcSaveChance = Math.max(0.10, 0.45 - (player.level - 1) * 0.03);

    if (deathRoll < npcSaveChance) {
      const savedHp = Math.max(1, Math.floor(player.hit_max * 0.15));
      await updatePlayer(player.id, { hit_points: savedHp });
      player = await getPlayer(player.id);
      await addNews(`\`0${player.handle}\`% was pulled from death's door by ${saver}!`);
      return res.json(getNpcRescueScreen(player, saver, monster, log, round, history));
    } else if (deathRoll < npcSaveChance + 0.25) {
      await updatePlayer(player.id, { near_death: 1, near_death_by: monster.name, hit_points: 0 });
      player = await getPlayer(player.id);
      await addNews(`\`@${player.handle}\`% lies near death in the forest, felled by a \`@${monster.name}\`%!`);
      return res.json(getNearDeathScreen(player, monster, log, round, history));
    } else {
      await updatePlayer(player.id, { dead: 1 });
      player = await getPlayer(player.id);
      await addNews(`\`@${player.handle}\`% was slain by a \`@${monster.name}\`% in the forest!`);
      return res.json(getForestCombatScreen(player, monster, log, false, true, round, history));
    }
  }

  const depth = req.session.forestDepth || 0;
  return res.json(getForestCombatScreen(player, monster, log, false, false, round, history, depth));
}

async function forest_deeper({ player, req, res, pendingMessages }) {
  const deeperStamina = player.stamina ?? player.fights_left ?? 10;
  if (deeperStamina <= 0)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`@You are too exhausted to go deeper!'] });

  await updatePlayer(player.id, { stamina: deeperStamina - 1 });
  player = await getPlayer(player.id);

  const depth = (req.session.forestDepth || 0) + 1;
  req.session.forestDepth = depth;

  const baseMonster = getRandomMonster(Number(player.level));
  const depthMult = 1 + depth * 0.15;
  const monster = {
    ...baseMonster,
    strength: Math.floor(baseMonster.strength * depthMult),
    hp: Math.floor(baseMonster.hp * depthMult),
    maxHp: Math.floor(baseMonster.hp * depthMult),
    currentHp: Math.floor(baseMonster.hp * depthMult),
    gold: Math.floor(baseMonster.gold * depthMult),
    exp: Math.floor(baseMonster.exp * depthMult),
  };
  req.session.combat = { monster, round: 1, history: [] };
  return res.json({ ...getForestEncounterScreen(player, monster, depth), pendingMessages: [`\`@You press deeper into the forest... Depth ${depth}. The shadows thicken.`] });
}

async function forest_rage({ player, req, res }) {
  if (player.class !== 1)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`@Only Death Knights can Rage!'] });
  const combat = req.session.combat;
  if (!combat) return res.json(getTownScreen(player));

  const rageCost = Math.floor(player.hit_max * 0.15);
  await updatePlayer(player.id, { hit_points: Math.max(1, player.hit_points - rageCost), rage_active: 1 });
  player = await getPlayer(player.id);
  req.session.raging = true;

  const depth = req.session.forestDepth || 0;
  return res.json({
    ...getForestEncounterScreen(player, combat.monster, depth),
    pendingMessages: [`\`@You enter a blood rage! Lost ${rageCost} HP. Your next strike will be devastating!`],
  });
}

module.exports = {
  forest,
  forest_event,
  rescue,
  rescue_skip,
  forest_attack: forest_combat,
  forest_run: forest_combat,
  forest_power: forest_combat,
  forest_deeper,
  forest_rage,
};
