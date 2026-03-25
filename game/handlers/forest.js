const { getPlayer, updatePlayer, getNearDeathPlayers, addNews, getActiveNamedEnemiesForLevel, createNamedEnemy, updateNamedEnemy, getNamedEnemy, getInvadingEnemies, getWorldState, setWorldState, getActiveHunts, incrementHuntKill } = require('../../db');
const { getRandomMonster, getMonster, getWeaponByNum, getArmorByNum, hasPerk, hasSpec, generateNamedEnemyName, pickKillTitle, NAMED_ITEMS, getNamedItemDrop } = require('../data');
const { buildTitleAward } = require('../titles');
const { resolveRound } = require('../combat');
const { checkLevelUp } = require('../newday');
const { FOREST_EVENTS } = require('../forest_events');
const { parseWounds, getWoundType, getWoundSeverity, getWoundLocation, woundChance, getBleedDamage, getCrushDefPenalty, rollInfection, resolveInfection } = require('../wounds');
const { adjustReps, getHostileFactions, makeAssassin } = require('../factions');
const {
  getTownScreen, getForestEncounterScreen, getForestCombatScreen,
  getForestEventScreen, getRescueOpportunityScreen, getLevelUpScreen,
  getNpcRescueScreen, getNearDeathScreen, getWildernessVictoryScreen,
} = require('../engine');

// ── Ecosystem: monster suppression cache ──────────────────────────────────────
// Tracks which monster names are over-hunted (50+ kills/day) and suppressed for 2 days.
// Module-level cache is updated immediately when suppression triggers; loaded fresh each day.
let _suppressedMonsters = {};  // { normalizedName: expiresDay }
let _suppressionLoadedDay = -1;

function normEco(name) { return name.toLowerCase().replace(/\s+/g, '_'); }

async function loadSuppressionsIfNeeded() {
  const today = Math.floor(Date.now() / 86400000);
  if (_suppressionLoadedDay === today) return;
  const raw = await getWorldState('eco:suppressions');
  _suppressedMonsters = {};
  if (raw) {
    for (const [k, expiresDay] of Object.entries(JSON.parse(raw))) {
      if (expiresDay > today) _suppressedMonsters[k] = expiresDay;
    }
  }
  _suppressionLoadedDay = today;
}

async function pickForestMonster(level, prestigeLevel = 0) {
  await loadSuppressionsIfNeeded();
  const today = Math.floor(Date.now() / 86400000);
  const allM = Array.from({ length: 11 }, (_, i) => getMonster(level, i));
  const available = allM.filter(m => {
    const k = normEco(m.name);
    return !_suppressedMonsters[k] || _suppressedMonsters[k] <= today;
  });
  const pool = available.length > 0 ? available : allM;
  let pick = { ...pool[Math.floor(Math.random() * pool.length)] };

  // Prestige scaling: each tier makes monsters 20% harder
  if (prestigeLevel > 0) {
    const scale = 1 + prestigeLevel * 0.20;
    pick.strength   = Math.floor(pick.strength   * scale);
    pick.hp         = Math.floor(pick.hp         * scale);
    pick.maxHp      = pick.hp;
    pick.currentHp  = pick.hp;
  } else {
    pick.maxHp     = pick.hp;
    pick.currentHp = pick.hp;
  }
  return pick;
}

// Returns suppressed monster name if threshold just crossed, null otherwise.
async function trackMonsterKill(monsterName) {
  const today = Math.floor(Date.now() / 86400000);
  const nameKey = normEco(monsterName);
  const raw = await getWorldState(`eco:kills:${nameKey}`);
  let data = raw ? JSON.parse(raw) : { count: 0, day: today };
  if (data.day !== today) data = { count: 0, day: today };
  data.count++;
  await setWorldState(`eco:kills:${nameKey}`, JSON.stringify(data));
  if (data.count === 50) {
    const expiresDay = today + 2;
    const suppRaw = await getWorldState('eco:suppressions');
    const suppressions = suppRaw ? JSON.parse(suppRaw) : {};
    suppressions[nameKey] = expiresDay;
    await setWorldState('eco:suppressions', JSON.stringify(suppressions));
    _suppressedMonsters[nameKey] = expiresDay;
    return monsterName;
  }
  return null;
}

async function forest({ player, req, res, pendingMessages }) {
  if (player.dead)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`@You are dead! Come back tomorrow.'] });

  const forestStamina = player.stamina ?? player.fights_left ?? 10;
  if (forestStamina <= 0)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`@You are too exhausted to enter the forest! Rest at the tavern.'] });

  // Block forest entry when a named enemy is threatening the town gates
  const townInvaders = await getInvadingEnemies(player.current_town || 'dawnmark');
  if (townInvaders.length > 0) {
    const inv = townInvaders[0];
    return res.json({ ...getTownScreen(player), pendingMessages: [
      `\`@${inv.given_name} blocks the town gate — you cannot reach the forest!`,
      '`7Defeat the invader at the gate [Z] before venturing out.',
    ]});
  }

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
    e.minLevel <= player.level &&
    (!e.classOnly || e.classOnly === player.class) &&
    (!e.blockIfQuestId || player.quest_id !== e.blockIfQuestId) &&
    (!e.blockIfFlag || !player[e.blockIfFlag])
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

  // 3% chance for a named enemy encounter
  if (Math.random() < 0.03) {
    const activeEnemies = await getActiveNamedEnemiesForLevel(player.level);
    let enemy;
    if (activeEnemies.length > 0) {
      enemy = activeEnemies[Math.floor(Math.random() * activeEnemies.length)];
    } else {
      const idx = Math.floor(Math.random() * 11);
      const base = getMonster(Number(player.level), idx);
      enemy = await createNamedEnemy({
        template_name: base.name,
        given_name: generateNamedEnemyName(),
        level: Number(player.level),
        template_index: idx,
        strength: Math.floor(base.strength * 1.40),
        hp:       Math.floor(base.hp       * 1.40),
        gold:     Math.floor(base.gold     * 2.00),
        exp:      Math.floor(base.exp      * 2.00),
      });
    }
    const displayName = `${enemy.given_name}${enemy.title ? `, ${enemy.title}` : ''}`;
    const base = getMonster(enemy.level, enemy.template_index);
    const killsLine = enemy.kills > 0
      ? ` This beast has claimed \`@${enemy.kills}\`% warrior${enemy.kills !== 1 ? 's' : ''} before you.`
      : ' You are the first to face this creature.';
    const namedMonster = {
      ...base,
      strength:  enemy.strength,
      hp:        enemy.hp,
      maxHp:     enemy.hp,
      currentHp: enemy.hp,
      gold:      enemy.gold,
      exp:       enemy.exp,
      isNamed:      true,
      namedEnemyId: enemy.id,
      displayName,
      artName:   base.name,
      kills:     enemy.kills,
      meet: `\`@${displayName}\`% — a legendary ${base.name} — emerges from the shadows!${killsLine}`,
    };
    req.session.combat = { monster: namedMonster, round: 1, history: [] };
    return res.json({
      ...getForestEncounterScreen(player, namedMonster),
      pendingMessages: [...pendingMessages, `\`$A legend stirs in the forest...`],
    });
  }

  const monster = await pickForestMonster(Number(player.level), player.prestige_level || 0);

  // Spec: Mage Enchanter — 25% chance to charm the enemy before combat; award full gold+exp
  if (hasSpec(player, 'enchanter') && Math.random() < 0.25) {
    await updatePlayer(player.id, {
      gold: Number(player.gold) + monster.gold,
      exp:  Number(player.exp)  + monster.exp,
    });
    player = await getPlayer(player.id);
    return res.json({ ...getTownScreen(player), pendingMessages: [
      ...pendingMessages,
      `\`#Enchanting Aura! The ${monster.name} blinks at you dreamily and wanders off.`,
      `\`$You pocket ${monster.gold} gold and earn ${monster.exp} exp without a fight.`,
    ]});
  }

  req.session.combat = { monster, round: 1, history: [], warlordStacks: req.session.warlordStacks || 0 };
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
  if (outcome.strDelta) {
    updates.strength = player.strength + outcome.strDelta;
    msgs.push(outcome.strDelta > 0
      ? `\`$Your strength surges! +${outcome.strDelta} Strength.`
      : `\`@Your strength wanes. ${outcome.strDelta} Strength.`);
  }
  if (outcome.alignDelta) {
    const newAlign = Math.max(-100, Math.min(100, (player.alignment || 0) + outcome.alignDelta));
    updates.alignment = newAlign;
    msgs.push(outcome.alignDelta > 0
      ? `\`0A lawful act. Alignment ${outcome.alignDelta > 0 ? '+' : ''}${outcome.alignDelta}.`
      : `\`@A dark deed. Alignment ${outcome.alignDelta}.`);
    // Oathkeeper shatters on chaotic acts (alignment drops below -20)
    if (player.named_weapon_id === 'oathkeeper' && newAlign < -20) {
      const oathItem = NAMED_ITEMS.oathkeeper;
      updates.named_weapon_id = null;
      updates.strength = (updates.strength || player.strength) - oathItem.strength;
      msgs.push('\`@Oathkeeper senses your dark deed and SHATTERS in your hand!');
      msgs.push('\`8The blade crumbles to ash. The oath is broken.');
    }
  }
  if (outcome.questStart && (!player.quest_id || player.quest_id === '')) {
    const { getQuestName } = require('../quests');
    updates.quest_id = outcome.questStart;
    updates.quest_step = 1;
    msgs.push(`\`$Quest begun: ${getQuestName(outcome.questStart)}.`);
  }
  if (outcome.bloodOathEffect) {
    const hpLoss = 20;
    const strGain = 40;
    updates.hit_max    = Math.max(15, player.hit_max - hpLoss);
    updates.hit_points = Math.min(updates.hit_max, (updates.hit_points || player.hit_points));
    updates.strength   = (updates.strength || player.strength) + strGain;
    updates.blood_oath = true;
    msgs.push(`\`@Your maximum HP decreases by ${hpLoss}.`);
    msgs.push(`\`$Your strength surges! +${strGain} Strength permanently.`);
    msgs.push('\`8The pact is sealed. It cannot be undone.');
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
        return res.json({ ...getLevelUpScreen(player, levelUp.newLevel, levelUp.hpGain, levelUp.strGain, levelUp.perkPoint, levelUp.specPoint), pendingMessages: msgs });
    }
  }

  if (outcome.fight) {
    const monster = getRandomMonster(Number(player.level));
    req.session.combat = { monster, round: 1, history: [], warlordStacks: req.session.warlordStacks || 0 };
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
      ...getLevelUpScreen(player, levelUp.newLevel, levelUp.hpGain, levelUp.strGain, levelUp.perkPoint, levelUp.specPoint),
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
  req.session.combat = { monster, round: 1, history: [], warlordStacks: req.session.warlordStacks || 0 };
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

  const { CLASS_POWER_MOVES } = require('../data');
  const activePowerMove = act === 'power' ? (CLASS_POWER_MOVES[player.class] || {}) : {};
  const preLog = [];

  // Spec: Dread Knight Berserker — pay 3% max HP at round start for +50% damage
  if (hasSpec(player, 'berserker') && act !== 'run') {
    const berserkCost = Math.max(1, Math.floor(player.hit_max * 0.03));
    await updatePlayer(player.id, { hit_points: Math.max(1, player.hit_points - berserkCost) });
    player = await getPlayer(player.id);
    preLog.push({ text: `\`@Berserker rage costs \`@${berserkCost}\`@ HP!` });
  }

  if (act === 'power') {
    // Spec: Elementalist Invoker — Elemental Fury ×2 damage, always costs 15% HP
    if (activePowerMove.sideEffect === 'hp_cost' && hasSpec(player, 'invoker')) {
      const cost = Math.max(1, Math.floor(player.hit_max * 0.15));
      if (player.hit_points <= cost)
        return res.json({ ...getForestEncounterScreen(player, monster), pendingMessages: ['`@You don\'t have enough HP for Invoker\'s fury!'] });
      await updatePlayer(player.id, { hit_points: player.hit_points - cost });
      player = await getPlayer(player.id);
      preLog.push({ text: `\`@Invoker burns \`@${cost}\`@ HP — power beyond measure!` });
    // Elementalist: Elemental Fury costs 10% max HP to cast (unless Elemental Mastery perk waives it)
    } else if (activePowerMove.sideEffect === 'hp_cost' && !hasPerk(player, 'elemental_mastery')) {
      const cost = Math.max(1, Math.floor(player.hit_max * 0.10));
      if (player.hit_points <= cost)
        return res.json({ ...getForestEncounterScreen(player, monster), pendingMessages: ['`@You don\'t have enough HP to channel Elemental Fury!'] });
      await updatePlayer(player.id, { hit_points: player.hit_points - cost });
      player = await getPlayer(player.id);
      preLog.push({ text: `\`@You burn \`@${cost}\`% HP to fuel the elemental surge!` });
    }
    // Necromancer Dark Pact: Death Coil costs extra HP but deals 50% more damage (applied post-hit)
    if (activePowerMove.sideEffect === 'poison' && hasPerk(player, 'dark_pact')) {
      const pactCost = Math.max(1, Math.floor(player.hit_max * 0.10));
      await updatePlayer(player.id, { hit_points: Math.max(1, player.hit_points - pactCost) });
      player = await getPlayer(player.id);
      preLog.push({ text: `\`@Dark Pact exacts its toll — \`@${pactCost}\`% HP consumed!` });
    }
    await updatePlayer(player.id, { skill_uses_left: player.skill_uses_left - 1 });
    player = await getPlayer(player.id);
  }

  // Monk: if monster was stunned last round, it deals no damage this round
  // monsterStunRounds counts down: 1 = stunned this round, 2 = Iron Fist 2-round stun
  const stunRounds = combat.monsterStunRounds || 0;
  const monsterStunned = stunRounds > 0;
  if (monsterStunned) {
    combat.monsterStunRounds = stunRounds - 1;
    preLog.push({ text: `\`7The ${monster.name} is still reeling from your last strike!` });
  }

  const { playerDamage, monsterDamage, poisonDamage, fled, monsterFled, appliedPoison, log } = resolveRound(player, monster, act);
  if (preLog.length) log.unshift(...preLog);
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

  // ── Perk + Spec: offensive effects ───────────────────────────────────────
  if (!fled && !monsterFled && act !== 'run' && finalPlayerDamage > 0) {
    // Spec: Ranger Strider — first strike in round 1 (+25% bonus damage)
    if (round === 1 && hasSpec(player, 'strider') && !hasPerk(player, 'shadow_step')) {
      const strikerBonus = Math.floor(finalPlayerDamage * 0.25);
      finalPlayerDamage += strikerBonus;
      log.push({ text: `\`0Strider's Advantage! You strike first for \`$${strikerBonus}\`0 bonus damage!` });
    }

    // Rogue: Shadow Step — free ambush strike in round 1
    if (round === 1 && hasPerk(player, 'shadow_step')) {
      // Spec: Assassin — shadow step ambush is always a crit (2.2× instead of 0.5×)
      const isCritAmbush = hasSpec(player, 'assassin');
      const ambush = isCritAmbush
        ? Math.floor(finalPlayerDamage * 1.2)
        : Math.floor(finalPlayerDamage * 0.5);
      finalPlayerDamage += ambush;
      log.push({ text: isCritAmbush
        ? `\`#Assassin's Shadow Step! Critical ambush for \`$${ambush}\`# bonus damage!`
        : `\`#Shadow Step! You strike from the shadows for \`$${ambush}\`# bonus damage!` });
    }

    // Ranger: Armor Pierce — attacks deal 35% more damage
    if (hasPerk(player, 'armor_pierce')) {
      const bonus = Math.floor(finalPlayerDamage * 0.35);
      finalPlayerDamage += bonus;
      log.push({ text: `\`!Armor Pierce cuts through for \`$${bonus}\`! extra damage!` });
    }

    // Ranger: Animal Bond — wolf companion deals 10% of player strength each round
    // Spec: Beastmaster — companion deals double (20% str) and may intercept monster attacks
    if (hasPerk(player, 'animal_bond')) {
      const wolfPct  = hasSpec(player, 'beastmaster') ? 0.20 : 0.10;
      const wolfDmg  = Math.max(1, Math.floor(player.strength * wolfPct));
      finalPlayerDamage += wolfDmg;
      log.push({ text: `\`0Your wolf companion snaps at the ${monster.name} for \`$${wolfDmg}\`0 damage!` });
    }

    // Mage: Conjurer — shadow minion deals 15% strength as bonus damage each round
    if (hasSpec(player, 'conjurer')) {
      const minionDmg = Math.max(1, Math.floor(player.strength * 0.15));
      finalPlayerDamage += minionDmg;
      log.push({ text: `\`8Your shadow minion claws the ${monster.name} for \`$${minionDmg}\`8 damage!` });
    }

    // Paladin: Consecrate — double damage vs undead
    // Spec: Inquisitor — triple damage vs undead (stacks with Consecrate for ×6), +stun chance
    if (hasPerk(player, 'consecrate') || hasSpec(player, 'inquisitor')) {
      const { getMonsterFamily: gmf } = require('../wounds');
      if (gmf(monster) === 'undead') {
        const mult = (hasPerk(player, 'consecrate') && hasSpec(player, 'inquisitor')) ? 5 : // ×6 total
                      hasSpec(player, 'inquisitor') ? 2 : 1; // ×3 or ×2
        const bonus = finalPlayerDamage * mult;
        finalPlayerDamage += bonus;
        log.push({ text: hasSpec(player, 'inquisitor')
          ? `\`!Inquisitor's Judgement! Holy fury obliterates the undead!`
          : `\`!Consecrate! Holy light sears the undead for double damage!` });
      }
    }
    // Spec: Inquisitor — 15% stun chance on any hit
    if (hasSpec(player, 'inquisitor') && Math.random() < 0.15 && !monsterStunned) {
      combat.monsterStunRounds = 1;
      log.push({ text: `\`!Inquisitor's Strike! The ${monster.name} staggers from divine force!` });
    }

    // Warrior: Battle Cry — crit hits deal extra burst
    const wasCrit = log.some(l => l.type === 'player_crit');
    if (wasCrit && hasPerk(player, 'battle_cry')) {
      const burst = player.level * 5;
      finalPlayerDamage += burst;
      log.push({ text: `\`$Battle Cry! Your war cry fuels the blow for \`$${burst}\`$ extra!` });
    }

    // Mage: Spell Surge — power move hits twice
    if (act === 'power' && hasPerk(player, 'spell_surge')) {
      finalPlayerDamage = finalPlayerDamage * 2;
      log.push({ text: `\`!Spell Surge! Arcane power doubles the strike!` });
    }

    // Spec: Elementalist Arcanist — 35% chance of free second cast at half power
    if (act === 'power' && hasSpec(player, 'arcanist') && Math.random() < 0.35) {
      const echo = Math.floor(finalPlayerDamage * 0.50);
      finalPlayerDamage += echo;
      log.push({ text: `\`9Arcane Echo! A second cast erupts for \`$${echo}\`9 bonus damage!` });
    }

    // Spec: Elementalist Invoker — Elemental Fury deals double damage
    if (act === 'power' && hasSpec(player, 'invoker') && activePowerMove.sideEffect === 'hp_cost') {
      finalPlayerDamage = finalPlayerDamage * 2;
      log.push({ text: `\`9Invoker's Fury! Raw elemental power doubles the strike!` });
    }

    // Necromancer: Dark Pact — Death Coil +50% damage
    if (act === 'power' && hasPerk(player, 'dark_pact') && (require('../data').CLASS_POWER_MOVES[player.class]?.sideEffect === 'poison')) {
      finalPlayerDamage = Math.floor(finalPlayerDamage * 1.5);
      log.push({ text: `\`#Dark Pact amplifies your Death Coil!` });
    }

    // Elementalist: Overload — +20% damage, costs 2% max HP
    if (hasPerk(player, 'overload')) {
      const overloadBonus = Math.floor(finalPlayerDamage * 0.20);
      const overloadCost = Math.max(1, Math.floor(player.hit_max * 0.02));
      finalPlayerDamage += overloadBonus;
      await updatePlayer(player.id, { hit_points: Math.max(1, player.hit_points - overloadCost) });
      player = await getPlayer(player.id);
      log.push({ text: `\`9Overload! +${overloadBonus} damage, but costs \`@${overloadCost}\`9 HP!` });
    }

    // Elementalist: Storm Call — attacks chain 2-3 times
    if (hasPerk(player, 'storm_call') && act !== 'power') {
      const chains = Math.random() < 0.5 ? 3 : 2;
      finalPlayerDamage = finalPlayerDamage * chains;
      log.push({ text: `\`9Storm Call! Lightning chains ${chains}× for \`$${finalPlayerDamage}\`9 total!` });
    }

    // Spec: Dread Knight Berserker — +50% damage
    if (hasSpec(player, 'berserker')) {
      const berserkBonus = Math.floor(finalPlayerDamage * 0.50);
      finalPlayerDamage += berserkBonus;
      log.push({ text: `\`@Berserker rage adds \`$${berserkBonus}\`@ to the blow!` });
    }

    // Spec: Dread Knight Warlord — +10% damage per intimidation stack
    const warlordStacks = combat.warlordStacks || 0;
    if (hasSpec(player, 'warlord') && warlordStacks > 0) {
      const warlordBonus = Math.floor(finalPlayerDamage * warlordStacks * 0.10);
      finalPlayerDamage += warlordBonus;
      log.push({ text: `\`@Warlord's Presence (${warlordStacks} stack${warlordStacks > 1 ? 's' : ''})! +${warlordBonus} intimidation damage!` });
    }

    // Spec: Monk Iron Fist — +25% attack damage
    if (hasSpec(player, 'iron_fist')) {
      const ironBonus = Math.floor(finalPlayerDamage * 0.25);
      finalPlayerDamage += ironBonus;
      log.push({ text: `\`3Iron Fist strikes for \`$${ironBonus}\`3 extra damage!` });
    }

    // Rogue: Poisoned Blade — 25% chance to poison monster
    // Spec: Plague Doctor — doubles the poison chance and adds disease
    const poisonChance = hasSpec(player, 'plague_doctor') ? 0.50 : 0.25;
    if (hasPerk(player, 'poisoned_blade') && Math.random() < poisonChance) {
      combat.monsterPoisoned = true;
      log.push({ text: `\`2Poisoned Blade! Your blade seeps venom into the ${monster.name}!` });
    }
    // Spec: Plague Doctor — 25% disease on any attack
    if (hasSpec(player, 'plague_doctor') && !combat.monsterDiseased && Math.random() < 0.25) {
      combat.monsterDiseased = true;
      log.push({ text: `\`2Plague Doctor! The ${monster.name} is diseased — its attacks weaken!` });
    }

    // Named weapon: Widow's Fang — 25% poison on hit
    if (player.named_weapon_id === 'widows_fang' && Math.random() < 0.25) {
      combat.monsterPoisoned = true;
      log.push({ text: `\`2Widow's Fang injects venom into the ${monster.name}!` });
    }
    // Named weapon: Sunbreaker — +60% damage vs undead
    if (player.named_weapon_id === 'sunbreaker') {
      const { getMonsterFamily: gmf } = require('../wounds');
      if (gmf(monster) === 'undead') {
        const bonus = Math.floor(finalPlayerDamage * 0.60);
        finalPlayerDamage += bonus;
        log.push({ text: `\`$Sunbreaker blazes! +${bonus} holy damage vs the undead!` });
      }
    }
    // Cursed weapon: Blooddrinker — drain 15% of damage dealt as HP
    if (player.named_weapon_id === 'blooddrinker' && finalPlayerDamage > 0) {
      const drain = Math.max(1, Math.floor(finalPlayerDamage * 0.15));
      const newHp = Math.min(player.hit_max, player.hit_points + drain);
      await updatePlayer(player.id, { hit_points: newHp });
      player = await getPlayer(player.id);
      log.push({ text: `\`@Blooddrinker drains \`$${drain}\`@ HP from the ${monster.name}!` });
    }

    // Warrior: Unbreakable — power move 35% stun (Spec: Guardian raises this to 60%)
    const shieldSlamStunChance = hasSpec(player, 'guardian') ? 0.60 : 0.35;
    if (act === 'power' && hasPerk(player, 'unbreakable') && Math.random() < shieldSlamStunChance) {
      combat.monsterStunRounds = 1;
      log.push({ text: `\`$Unbreakable! The force of your blow stuns the ${monster.name}!` });
    }

    // Monk: Pressure Points — 20% stun on hit
    // Spec: Iron Fist — stun lasts 2 rounds
    if (hasPerk(player, 'pressure_points') && Math.random() < 0.20) {
      combat.monsterStunRounds = hasSpec(player, 'iron_fist') ? 2 : 1;
      log.push({ text: `\`3Pressure Points! You strike a vital nerve — the ${monster.name} staggers${hasSpec(player, 'iron_fist') ? ' for 2 rounds' : ''}!` });
    }
  }

  // Vampire: Drain Life — heal 20% of damage dealt
  if (player.is_vampire && finalPlayerDamage > 0 && !fled && !monsterFled) {
    const drain = Math.max(1, Math.floor(finalPlayerDamage * 0.20));
    const newHp = Math.min(player.hit_max, player.hit_points + drain);
    await updatePlayer(player.id, { hit_points: newHp });
    player = await getPlayer(player.id);
    log.push({ text: `\`#You drain life from the ${monster.name} for \`$${drain}\`# HP!` });
  }

  const armorBonus = getArmorByNum(player.arm_num)?.bonus;
  let finalMonsterDamage = monsterDamage + (poisonDamage || 0);

  // If monster was stunned this round, it deals no damage
  if (monsterStunned) finalMonsterDamage = poisonDamage || 0;

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

    // Spec: Rogue Trickster — 30% dodge; on dodge, counter-attacks for 50% player str
    if (hasSpec(player, 'trickster') && monsterDamage > 0 && Math.random() < 0.30) {
      const counter = Math.max(1, Math.floor(player.strength * 0.50));
      monster.currentHp = Math.max(0, monster.currentHp - counter);
      finalMonsterDamage = poisonDamage || 0;
      log.push({ text: `\`#Trickster's Dodge! You sidestep the attack and counter for \`$${counter}\`# damage!` });
    }

    // Spec: Ranger Beastmaster — wolf companion 20% chance to intercept monster attack
    if (hasSpec(player, 'beastmaster') && hasPerk(player, 'animal_bond') && monsterDamage > 0 && Math.random() < 0.20) {
      finalMonsterDamage = poisonDamage || 0;
      log.push({ text: `\`0Your wolf leaps in front of the blow, taking the hit for you!` });
    }

    // Spec: Plague Doctor — diseased monster deals 15% less damage
    if (combat.monsterDiseased && monsterDamage > 0) {
      const reduced = Math.floor(finalMonsterDamage * 0.15);
      finalMonsterDamage = Math.max(0, finalMonsterDamage - reduced);
      log.push({ text: `\`2Disease weakens the ${monster.name} (−${reduced} damage)!` });
    }

    // Perk: Monk Ki Shield — 25% chance to block all incoming damage
    // Spec: Wind Walker — block chance raised to 40%; blocked attacks trigger a counter
    const kiBlockChance = hasSpec(player, 'wind_walker') ? 0.40 : 0.25;
    if (hasPerk(player, 'ki_shield') && monsterDamage > 0 && Math.random() < kiBlockChance) {
      if (hasSpec(player, 'wind_walker')) {
        const counter = Math.max(1, Math.floor(player.strength * 0.60));
        monster.currentHp = Math.max(0, monster.currentHp - counter);
        log.push({ text: `\`3Wind Walker! You deflect and counter for \`$${counter}\`3 damage!` });
      } else {
        log.push({ text: `\`3Ki Shield! You deflect the ${monster.name}\'s attack completely!` });
      }
      finalMonsterDamage = poisonDamage || 0;
    }

    // Perk: Necromancer Bone Shield — absorb 20 damage per round
    if (hasPerk(player, 'bone_shield') && finalMonsterDamage > 0) {
      const absorbed = Math.min(20, finalMonsterDamage);
      finalMonsterDamage = Math.max(0, finalMonsterDamage - 20);
      if (absorbed > 0) log.push({ text: `\`8Bone Shield absorbs ${absorbed} damage!` });
    }

    // Perk: Druid Thorns — reflect 15% of damage taken back at attacker
    if (hasPerk(player, 'thorns') && monsterDamage > 0) {
      const reflect = Math.max(1, Math.floor(monsterDamage * 0.15));
      monster.currentHp = Math.max(0, monster.currentHp - reflect);
      log.push({ text: `\`0Thorns! The ${monster.name} takes \`$${reflect}\`0 reflected damage!` });
    }

    // Perk: Druid Regrowth — regenerate 3% max HP per round
    // Spec: Stormcaller — regrowth also zaps the enemy for 3% max HP as lightning
    if (hasPerk(player, 'regrowth')) {
      const regen = Math.max(1, Math.floor(player.hit_max * 0.03));
      finalMonsterDamage = Math.max(0, finalMonsterDamage - regen);
      log.push({ text: `\`0Regrowth heals \`$${regen}\`0 HP!` });
      if (hasSpec(player, 'stormcaller')) {
        const lightning = Math.max(1, Math.floor(player.hit_max * 0.03));
        monster.currentHp = Math.max(0, monster.currentHp - lightning);
        log.push({ text: `\`9Stormcaller! Lightning zaps the ${monster.name} for \`$${lightning}\`9 damage!` });
      }
    }
  }

  // Spec: Shapeshifter — immune to poison in combat (block the poison DoT component)
  if (hasSpec(player, 'shapeshifter') && hasPerk(player, 'shapeshift') && (poisonDamage || 0) > 0) {
    finalMonsterDamage = Math.max(0, finalMonsterDamage - (poisonDamage || 0));
    log.push({ text: `\`0Shapeshifter form purges the venom — poison nullified!` });
  }

  // Spec: Plague Doctor — extra poison tick each round (second DoT tick)
  if (hasSpec(player, 'plague_doctor') && hasPerk(player, 'poisoned_blade') && (player.poisoned || 0) > 0) {
    const extraTick = Math.max(1, Math.floor((player.hit_max || player.hit_points) * 0.05));
    finalMonsterDamage += extraTick;
    log.push({ text: `\`2Plague Doctor! A second poison tide hits for \`@${extraTick}\`2 more!` });
  }

  let willPoison = appliedPoison;
  if (appliedPoison && armorBonus === 'poison_resist' && Math.random() < 0.50) {
    log.push({ text: '`2Your armour resists the poison!' });
    willPoison = false;
  }
  if (willPoison) await updatePlayer(player.id, { poisoned: 3 });

  if (fled) {
    req.session.combat = null;

    // ── Flee tracking: Shadow title ───────────────────────────────────────────
    const newFleeCount  = (player.flee_count || 0) + 1;
    const fleeUpdates   = { flee_count: newFleeCount };
    const shadowAward   = newFleeCount >= 20 ? buildTitleAward(player, 'shadow') : null;
    if (shadowAward) Object.assign(fleeUpdates, shadowAward);
    await updatePlayer(player.id, fleeUpdates);
    player = await getPlayer(player.id);
    if (shadowAward) {
      log.push({ text: '`8You slip away like smoke on the wind. The forest grants you a new name: `7the Shadow`8.' });
      await addNews(`\`8${player.handle}\`% has become one with the darkness — now known as \`7the Shadow\`8.`);
    }

    if (req.session.dungeon) {
      req.session.dungeon = null;
      req.session.wildernessMode = null;
      return res.json({ ...getTownScreen(player), pendingMessages: [`\`7You flee the dungeon! The entrance seals behind you.`] });
    }
    if (req.session.wildernessMode) {
      req.session.wildernessMode = null;
      return res.json({ ...getTownScreen(player), pendingMessages: [`\`7You flee from the ${monster.name} and escape the wilderness!`] });
    }
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
    if (req.session.dungeon) {
      const { advanceDungeonRoom } = require('./dungeon');
      return advanceDungeonRoom(player, req, res, log);
    }
    if (req.session.wildernessMode) {
      const { WILDERNESS_ZONES } = require('../wilderness');
      const zone = WILDERNESS_ZONES[req.session.wildernessMode.townId];
      if (zone) return res.json(getWildernessVictoryScreen(player, monster, log, round, history, zone));
    }
    return res.json(getForestCombatScreen(player, monster, log, true, false, round, history, depth));
  }

  // Monster poison DOT from previous rounds (Necromancer Death Coil)
  if (combat.monsterPoisoned && !fled && !monsterFled) {
    const dotDmg = Math.max(1, Math.floor(monster.maxHp * 0.05));
    monster.currentHp = Math.max(0, monster.currentHp - dotDmg);
    log.push({ text: `\`2Death Coil's poison eats at the ${monster.name} for \`@${dotDmg}\`2 damage!` });
  }

  monster.currentHp = Math.max(0, monster.currentHp - finalPlayerDamage);

  // ── Power move side effects (post-hit) ──────────────────────────────────────
  if (act === 'power' && !fled && !monsterFled) {
    // Paladin Divine Smite: heal 10% max HP (20% Lay on Hands, 35% Templar spec)
    if (activePowerMove.sideEffect === 'self_heal' && finalPlayerDamage > 0) {
      const healPct = hasSpec(player, 'templar') ? 0.35
                    : hasPerk(player, 'lay_on_hands') ? 0.20 : 0.10;
      const healAmt = Math.max(1, Math.floor(player.hit_max * healPct));
      const newHp = Math.min(player.hit_max, player.hit_points + healAmt);
      await updatePlayer(player.id, { hit_points: newHp });
      player = await getPlayer(player.id);
      log.push({ text: `\`0Divine light flows through you, restoring \`$${healAmt}\`0 HP!` });
    }
    // Necromancer Death Coil: apply lingering poison to the monster
    if (activePowerMove.sideEffect === 'poison' && finalPlayerDamage > 0) {
      combat.monsterPoisoned = true;
      log.push({ text: `\`2Death Coil's poison seeps into the ${monster.name}!` });
    }
  }

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
        const wType    = getWoundType(monster);
        const location = getWoundLocation(wType);
        wounds.push({ type: wType, severity, source: monster.name, location });
        woundUpdates.wounds = JSON.stringify(wounds);
        const sevName = ['', 'scratch', 'flesh', 'deep', 'grievous', 'mortal'][severity] || 'serious';
        log.push({ text: `\`@You suffer a ${sevName} ${wType} wound to your ${location} from the ${monster.name}!` });

      // Infection roll — bites always roll; humanoid/giant wounds roll via dirty weapon chance
      const { getDirtyWeaponMod } = require('../wounds');
      const dirtyMod = getDirtyWeaponMod(monster);
      const infResult = rollInfection(monster, dirtyMod, wType);
      if (infResult) {
        const newInfType = resolveInfection(player.infection_type || '', infResult.infectionType);
        if (newInfType !== player.infection_type) {
          woundUpdates.infection_type  = newInfType;
          woundUpdates.infection_stage = 0;
          woundUpdates.infection_days  = 0;
        }
        log.push({ text: infResult.message });
      }
    }
  }

  const totalPlayerDamage = finalMonsterDamage + slashBleed;
  const newPlayerHp = Math.max(0, player.hit_points - totalPlayerDamage);
  await updatePlayer(player.id, { hit_points: newPlayerHp, ...woundUpdates });
  player = await getPlayer(player.id);
  req.session.combat = {
    monster,
    round:             round + 1,
    history:           newHistory,
    monsterPoisoned:   combat.monsterPoisoned   || false,
    monsterStunRounds: combat.monsterStunRounds  || 0,
    monsterDiseased:   combat.monsterDiseased    || false,
    warlordStacks:     combat.warlordStacks       || 0,
  };

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
    // Spec: Paladin Templar — +1 Knights and Merchants rep on every kill
    if (hasSpec(player, 'templar')) { killRep.knights = (killRep.knights || 0) + 1; killRep.merchants = (killRep.merchants || 0) + 1; }
    const repUpdates = adjustReps(player, killRep);

    // ── Perk: kill rewards ──────────────────────────────────────────────────
    let killGold = monster.gold;
    let killExp  = monster.exp;

    // Active world event multipliers
    const { getActiveWorldEvent: getWorldEvent } = require('../../db');
    const { getEventDef } = require('../world_events');
    const activeEvent = await getWorldEvent();
    if (activeEvent) {
      const def = getEventDef(activeEvent.type);
      if (def) {
        if (def.effects.forestGoldMult !== 1.0) killGold = Math.floor(killGold * def.effects.forestGoldMult);
        if (def.effects.forestExpMult  !== 1.0) killExp  = Math.floor(killExp  * def.effects.forestExpMult);
      }
    }

    // Rogue: Lucky — +30% gold
    if (hasPerk(player, 'lucky')) killGold = Math.floor(killGold * 1.30);

    // Monk: Enlightenment — +25% exp
    if (hasPerk(player, 'enlightenment')) killExp = Math.floor(killExp * 1.25);

    // Necromancer: Corpse Explosion — if flagged from last kill, +50% gold & exp
    if (req.session.corpseExplosion) {
      killGold = Math.floor(killGold * 1.50);
      killExp  = Math.floor(killExp  * 1.50);
      log.push({ text: `\`#Corpse Explosion residue! +50% gold & exp from this fight!` });
      req.session.corpseExplosion = false;
    }

    // Named enemy: +50% gold & exp bonus
    if (monster.isNamed) {
      killGold = Math.floor(killGold * 1.50);
      killExp  = Math.floor(killExp  * 1.50);
    }

    // XP tapering: smooth curve when player is 3+ levels above the monster.
    // Pushes players to explore higher-level zones rather than farming lower ones.
    // Floor of 15%; exponential curve so the drop-off feels natural, not punishing.
    const monLvl  = monster.level || player.level;
    const lvlDiff = player.level - monLvl;
    if (lvlDiff >= 3) {
      const factor = Math.max(0.15, Math.pow(0.65, lvlDiff - 2));
      killExp = Math.floor(killExp * factor);
    }

    await updatePlayer(player.id, { gold: Number(player.gold) + killGold, exp: Number(player.exp) + killExp, ...repUpdates });
    player = await getPlayer(player.id);

    // Dread Knight: Soul Hunger — heal 15% max HP on kill
    if (hasPerk(player, 'soul_hunger')) {
      const heal = Math.max(1, Math.floor(player.hit_max * 0.15));
      await updatePlayer(player.id, { hit_points: Math.min(player.hit_max, player.hit_points + heal) });
      player = await getPlayer(player.id);
      log.push({ text: `\`#Soul Hunger! You devour the life-force for \`$${heal}\`# HP!` });
    }

    // Necromancer: Corpse Explosion — flag next fight for bonus
    if (hasPerk(player, 'corpse_explosion')) {
      req.session.corpseExplosion = true;
      log.push({ text: `\`8Corpse Explosion primed — your next kill will be supercharged!` });
    }

    // Spec: Dread Knight Warlord — gain an intimidation stack on kill (max 3, persists in session)
    if (hasSpec(player, 'warlord')) {
      const prevStacks = req.session.warlordStacks || 0;
      if (prevStacks < 3) {
        req.session.warlordStacks = prevStacks + 1;
        log.push({ text: `\`@Warlord's Presence! Intimidation rises to \`$${req.session.warlordStacks}\`@ stack${req.session.warlordStacks > 1 ? 's' : ''}.` });
      }
    }

    // Named enemy kill: mark defeated, avenger check, town invader clear, news
    if (monster.isNamed && monster.namedEnemyId) {
      // Town invader: clear their reached_town on defeat
      const invaderSession = req.session.townInvaderFight;
      if (invaderSession && invaderSession.namedEnemyId === monster.namedEnemyId) {
        await updateNamedEnemy(monster.namedEnemyId, { defeated: 1, reached_town: null });
        req.session.townInvaderFight = null;
        const { TOWNS } = require('../data');
        const townName = TOWNS[invaderSession.townId]?.name || invaderSession.townId;
        log.push({ text: `\`$${monster.displayName} has been driven from ${townName}! The town is safe!` });
        await addNews(`\`$${player.handle}\`% drove \`@${monster.displayName}\`% from the gates of \`$${TOWNS[invaderSession.townId]?.name || invaderSession.townId}\`%!`);
      } else {
        await updateNamedEnemy(monster.namedEnemyId, { defeated: 1 });
      }
      // Clear any wilderness infestations this enemy caused
      const { clearEnemyInfestation } = require('../wilderness');
      await clearEnemyInfestation(monster.namedEnemyId);

      const isAvenger = Number(player.nemesis_id) === Number(monster.namedEnemyId);
      if (isAvenger) {
        await updatePlayer(player.id, { nemesis_id: null, charm: player.charm + 2 });
        player = await getPlayer(player.id);
        log.push({ text: `\`$AVENGER! You slew your nemesis — ${monster.displayName}! +2 charm!` });
        await addNews(`\`$${player.handle}\`% avenged their death by slaying the legendary \`@${monster.displayName}\`%!`);
      } else if (!invaderSession) {
        await addNews(`\`0${player.handle}\`% has slain the legendary \`@${monster.displayName}\`%!`);
      }
      log.push({ text: `\`$The legend of ${monster.displayName} ends here. Gold & exp ×1.5!` });

      // Widow's Revenge quest: auto-complete on named enemy kill
      if (player.quest_id === 'widow_revenge') {
        const qExp  = 400 * player.level;
        const qGold = 300 * player.level;
        player = await getPlayer(player.id);
        await updatePlayer(player.id, {
          quest_id: '', quest_step: 0, quest_data: '',
          charm: player.charm + 3,
          exp:  Number(player.exp)  + qExp,
          gold: Number(player.gold) + qGold,
        });
        player = await getPlayer(player.id);
        log.push({ text: `\`$QUEST COMPLETE: The Widow\'s Revenge! +${qExp.toLocaleString()} exp, +${qGold.toLocaleString()} gold, +3 charm!` });
      }
    } else if (monster.isAssassin) {
      await addNews(`\`$${player.handle}\`% defeated a ${monster.name} sent by the \`@${monster.factionId}\`% in the forest!`);
    } else {
      // Ecosystem kill tracking
      const suppressed = await trackMonsterKill(monster.name);
      if (suppressed) {
        await addNews(`\`2The \`%${suppressed}\`2 population has been decimated by hunters. They vanish from the forest for two days.`);
      } else if (Math.random() < 0.10) {
        await addNews(`\`0${player.handle}\`% slew a \`@${monster.name}\`% in the forest!`);
      }
    }

    if (Math.random() < 0.05) {
      await updatePlayer(player.id, { gems: player.gems + 1 });
      log.push({ text: '`$You find a shimmering gem on the ground!' });
      player = await getPlayer(player.id);
    }

    // Named item drop: 25% from named enemies, 1% from regular monsters
    const dropChance = monster.isNamed ? 0.25 : 0.01;
    if (!player.named_weapon_id && !player.named_armor_id && Math.random() < dropChance) {
      const drop = getNamedItemDrop(player.level);
      if (drop) {
        const dropUpdates = {};
        if (drop.type === 'weapon') {
          dropUpdates.named_weapon_id = drop.id;
          dropUpdates.strength = player.strength + drop.strength;
          if (drop.strPenalty) dropUpdates.strength += drop.strPenalty;
        } else {
          dropUpdates.named_armor_id = drop.id;
          dropUpdates.defense = player.defense + drop.defense;
          if (drop.strPenalty) dropUpdates.strength = player.strength + drop.strPenalty;
        }
        await updatePlayer(player.id, dropUpdates);
        player = await getPlayer(player.id);
        log.push({ text: `\`$★ RARE FIND! You discover \`!${drop.name}\`$!` });
        log.push({ text: `\`8  "${drop.lore}"` });
        log.push({ text: `\`!  Effect: ${drop.effectDesc}` });
        log.push({ text: `\`0  It binds to you — already active. Check [C]haracter to see it.` });
      }
    }

    // ── Weekly hunt board contribution ────────────────────────────────────────
    // Check if this monster is a hunt target; award per-kill bonus if so.
    // Skipped for named enemies (they're not in the hunt pool by name).
    if (!monster.isNamed) {
      try {
        const activeHunts = await getActiveHunts();
        const matchHunt   = activeHunts.find(h => h.target_name === monster.name);
        if (matchHunt) {
          await incrementHuntKill(matchHunt.id, player.id);
          await updatePlayer(player.id, {
            gold: Number(player.gold) + matchHunt.kill_bonus_gold,
            exp:  Number(player.exp)  + matchHunt.kill_bonus_exp,
          });
          player = await getPlayer(player.id);
          log.push({ text: `\`$★ HUNT BOARD: ${monster.name} is a this week's target! +${matchHunt.kill_bonus_gold.toLocaleString()} gold, +${matchHunt.kill_bonus_exp.toLocaleString()} exp.` });
        }
      } catch { /* non-critical — don't break combat on DB error */ }
    }

    // ── Veilborn quest step 4: ghost ship captain is a regular monster fight ──
    if (player.quest_id === 'wardens_fall' && player.quest_step === 4 && monster.isVeilbornCaptain) {
      await updatePlayer(player.id, {
        quest_step: 5,
        quest_data: JSON.stringify({ target: 'ashenfall', journal: true }),
      });
      player = await getPlayer(player.id);
      log.push({ text: '`!The Pale Captain dissolves into smoke. A waterlogged journal tumbles from the ether...' });
      log.push({ text: '`$Quest: The Warden\'s Fall — "Travel to the Ancient Forge in Ashenfall."' });
    }

    const levelUp = checkLevelUp(player);
    if (levelUp) {
      await updatePlayer(player.id, levelUp.updates);
      player = await getPlayer(player.id);
      await addNews(`\`$${player.handle}\`% has advanced to level \`$${levelUp.newLevel}\`%!`);
      return res.json({ ...getLevelUpScreen(player, levelUp.newLevel, levelUp.hpGain, levelUp.strGain, levelUp.perkPoint, levelUp.specPoint), pendingMessages: log.map(l => l.text) });
    }

    // Dungeon room advancement
    if (req.session.dungeon) {
      const { advanceDungeonRoom } = require('./dungeon');
      return advanceDungeonRoom(player, req, res, log);
    }
    // Wilderness victory screen
    if (req.session.wildernessMode) {
      const { WILDERNESS_ZONES } = require('../wilderness');
      const zone = WILDERNESS_ZONES[req.session.wildernessMode.townId];
      if (zone) return res.json(getWildernessVictoryScreen(player, monster, log, round, history, zone));
    }
    const depth = req.session.forestDepth || 0;

    // Secret event check (fires rarely, adds lines to combat log)
    try {
      const { checkSecrets } = require('../secrets');
      const secret = await checkSecrets(player, 'forest');
      if (secret) {
        if (secret.damage > 0) {
          await updatePlayer(player.id, { hit_points: Math.max(1, player.hit_points - secret.damage) });
          player = await getPlayer(player.id);
        }
        return res.json({ ...getForestCombatScreen(player, monster, log, true, false, round, history, depth), pendingMessages: secret.lines });
      }
    } catch { /* non-critical */ }

    return res.json(getForestCombatScreen(player, monster, log, true, false, round, history, depth));
  }

  if (newPlayerHp <= 0) {
    // Spec: Necromancer Lichborn — once per day, survive with 1 HP instead of dying
    const today = Math.floor(Date.now() / 86400000);
    if (hasSpec(player, 'lichborn') && (player.lich_cooldown || 0) < today) {
      await updatePlayer(player.id, { hit_points: 1, lich_cooldown: today });
      player = await getPlayer(player.id);
      log.push({ text: `\`8Death reaches for you — but Lichborn defies it. You stand at \`$1\`8 HP!` });
      req.session.combat = {
        monster,
        round:             round + 1,
        history:           [...newHistory, ...log].slice(-30),
        monsterPoisoned:   combat.monsterPoisoned  || false,
        monsterStunRounds: combat.monsterStunRounds || 0,
        monsterDiseased:   combat.monsterDiseased   || false,
        warlordStacks:     combat.warlordStacks      || 0,
      };
      const depth = req.session.forestDepth || 0;
      return res.json(getForestCombatScreen(player, monster, log, false, false, round + 1, newHistory, depth));
    }

    req.session.combat = null;
    req.session.forestDepth = 0;
    req.session.wildernessMode = null;
    req.session.dungeon = null;
    req.session.townInvaderFight = null;

    // Named enemy nemesis: level up the beast and brand the player
    if (monster.isNamed && monster.namedEnemyId) {
      const currentEnemy = await getNamedEnemy(monster.namedEnemyId);
      if (currentEnemy && !currentEnemy.defeated) {
        const newKills    = (currentEnemy.kills || 0) + 1;
        const newStrength = Math.ceil(currentEnemy.strength * 1.20);
        const newHp       = Math.ceil(currentEnemy.hp       * 1.20);
        const newGold     = Math.ceil(currentEnemy.gold     * 1.10);
        const newExp      = Math.ceil(currentEnemy.exp      * 1.10);
        const newTitle    = currentEnemy.title || pickKillTitle();
        await updateNamedEnemy(monster.namedEnemyId, {
          kills: newKills, strength: newStrength, hp: newHp,
          gold: newGold, exp: newExp, title: newTitle,
        });
        await updatePlayer(player.id, { nemesis_id: monster.namedEnemyId });
        const newDisplay = `${currentEnemy.given_name}, ${newTitle}`;
        const titleLine  = !currentEnemy.title ? ` Now known as \`@${newDisplay}\`%!` : '';
        await addNews(`\`@${monster.displayName}\`% has slain \`$${player.handle}\`% and grows stronger!${titleLine}`);
      }
    }

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
  req.session.combat = { monster, round: 1, history: [], warlordStacks: req.session.warlordStacks || 0 };
  return res.json({ ...getForestEncounterScreen(player, monster, depth), pendingMessages: [`\`@You press deeper into the forest... Depth ${depth}. The shadows thicken.`] });
}

async function forest_rage({ player, req, res }) {
  if (player.class !== 1)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`@Only Dread Knights can Rage!'] });
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
