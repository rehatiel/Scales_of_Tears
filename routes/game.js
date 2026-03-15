const express = require('express');
const { getPlayer, updatePlayer, getAllPlayers, getNearDeathPlayers, getRecentNews, addNews, getHallOfKings, addToHallOfKings, TODAY } = require('../db');
const { getRandomMonster, RED_DRAGON, WEAPONS, ARMORS, CLASS_NAMES, expForNextLevel, getWeaponByNum, getArmorByNum } = require('../game/data');
const { resolveRound, resolvePvP } = require('../game/combat');
const { checkLevelUp, runNewDay } = require('../game/newday');
const { FOREST_EVENTS } = require('../game/forest_events');
const {
  getTownScreen, getForestEncounterScreen, getForestCombatScreen,
  getWeaponShopScreen, getArmorShopScreen, getInnScreen, getBankScreen,
  getMasterScreen, getTavernScreen, getGardenScreen, getBardScreen,
  getNewsScreen, getCharacterScreen, getSetupScreen, getDragonScreen,
  getLevelUpScreen, getForestEventScreen, getRescueOpportunityScreen,
  getNearDeathWaitingScreen, getNpcRescueScreen, getNearDeathScreen,
  renderBanner, getCrierScreen,
} = require('../game/engine');

const router = express.Router();

// Async wrapper for clean error propagation
const ar = fn => (req, res, next) => fn(req, res, next).catch(next);

// Auth guard
router.use((req, res, next) => {
  if (!req.session.playerId) return res.status(401).json({ error: 'Not logged in.' });
  next();
});

// Character setup flow
router.post('/setup', ar(async (req, res) => {
  const player = await getPlayer(req.session.playerId);
  const { action, param } = req.body;

  // Single-call setup (used by the wizard UI)
  if (action === 'setup_all') {
    const name = (req.body.name || '').trim();
    const sex = parseInt(req.body.sex) === 5 ? 5 : 0;
    const cls = [1, 2, 3].includes(parseInt(req.body.classNum)) ? parseInt(req.body.classNum) : 1;
    if (name.length < 2 || name.length > 20)
      return res.status(400).json({ error: 'Name must be 2–20 characters.' });
    const classHp  = { 1: 20, 2: 17, 3: 15 };
    const classStr = { 1: 18, 2: 15, 3: 15 };
    await updatePlayer(player.id, {
      handle: name, sex, class: cls,
      hit_points: classHp[cls], hit_max: classHp[cls],
      strength: classStr[cls], setup_complete: 1, last_day: TODAY(),
    });
    return res.json(getTownScreen(await getPlayer(player.id)));
  }

  if (action === 'setup_name') {
    const name = (param || '').trim();
    if (name.length < 2 || name.length > 20) return res.json(getSetupScreen('name'));
    await updatePlayer(player.id, { handle: name });
    return res.json(getSetupScreen('sex'));
  }

  if (action === 'setup_sex') {
    await updatePlayer(player.id, { sex: parseInt(param) === 5 ? 5 : 0 });
    return res.json(getSetupScreen('class'));
  }

  if (action === 'setup_class') {
    const cls = [1, 2, 3].includes(parseInt(param)) ? parseInt(param) : 1;
    const classHp  = { 1: 20, 2: 17, 3: 15 };
    const classStr = { 1: 18, 2: 15, 3: 15 };
    await updatePlayer(player.id, {
      class: cls,
      hit_points: classHp[cls],
      hit_max: classHp[cls],
      strength: classStr[cls],
      setup_complete: 1,
      last_day: TODAY(),
    });
    return res.json(getTownScreen(await getPlayer(player.id)));
  }

  res.json(getSetupScreen('name'));
}));

// Load initial screen on page refresh
router.get('/state', ar(async (req, res) => {
  const player = await getPlayer(req.session.playerId);
  if (!player) return res.status(401).json({ error: 'Player not found.' });
  if (!player.setup_complete) return res.json(getSetupScreen('name'));
  if (player.near_death) return res.json(getNearDeathWaitingScreen(player));
  return res.json(getTownScreen(player));
}));

// Main action endpoint
router.post('/action', ar(async (req, res) => {
  let player = await getPlayer(req.session.playerId);
  if (!player) return res.status(401).json({ error: 'Player not found.' });
  if (!player.setup_complete) return res.json(getSetupScreen('name'));

  // Run new-day routine if needed
  const today = TODAY();
  let pendingMessages = [];
  if (player.last_day < today) {
    const { updates, messages } = await runNewDay(player);
    await updatePlayer(player.id, updates);
    player = await getPlayer(player.id);
    pendingMessages = messages;
  }

  const { action, param } = req.body;

  // Near-death players can only wait or be rescued
  if (player.near_death && action !== 'near_death_wait' && action !== 'town' && action !== 'logout') {
    return res.json({ ...getNearDeathWaitingScreen(player), pendingMessages });
  }

  switch (action) {

    // ── TOWN ──────────────────────────────────────────────────────────────
    case 'town':
      if (player.near_death) return res.json({ ...getNearDeathWaitingScreen(player), pendingMessages });
      return res.json({ ...getTownScreen(player), pendingMessages });

    case 'near_death_wait':
      return res.json(getNearDeathWaitingScreen(player));

    // ── FOREST ────────────────────────────────────────────────────────────
    case 'forest': {
      if (player.dead)
        return res.json({ ...getTownScreen(player), pendingMessages: [`\`@You are dead! Come back tomorrow.`] });
      if (player.fights_left <= 0)
        return res.json({ ...getTownScreen(player), pendingMessages: [`\`@You have no forest fights left today!`] });

      // Check if any player is near death — chance to encounter them first
      const nearDeathList = await getNearDeathPlayers(player.id);
      if (nearDeathList.length > 0 && Math.random() < 0.5) {
        const victim = nearDeathList[0];
        req.session.rescueTarget = victim.id;
        return res.json({ ...getRescueOpportunityScreen(player, victim), pendingMessages });
      }

      // Consume one forest trip
      await updatePlayer(player.id, { fights_left: player.fights_left - 1 });
      player = await getPlayer(player.id);

      // 30% chance of a non-combat forest event
      const eligibleEvents = FOREST_EVENTS.filter(e =>
        e.minLevel <= player.level &&
        (!e.classOnly || e.classOnly === player.class)
      );
      if (eligibleEvents.length > 0 && Math.random() < 0.30) {
        const event = eligibleEvents[Math.floor(Math.random() * eligibleEvents.length)];
        req.session.forestEvent = { eventId: event.id };
        return res.json({ ...getForestEventScreen(player, event), pendingMessages });
      }

      // Normal monster fight
      req.session.forestDepth = 0;
      const monster = getRandomMonster(Number(player.level));
      req.session.combat = { monster, round: 1, history: [] };
      return res.json({ ...getForestEncounterScreen(player, monster), pendingMessages });
    }

    // ── FOREST EVENT ──────────────────────────────────────────────────────
    case 'forest_event': {
      const { eventId } = req.session.forestEvent || {};
      if (!eventId) return res.json({ ...getTownScreen(player), pendingMessages });

      const event = FOREST_EVENTS.find(e => e.id === eventId);
      if (!event) return res.json({ ...getTownScreen(player), pendingMessages });

      const choiceKey = param;
      let outcome = event.outcomes[choiceKey];
      if (!outcome) return res.json({ ...getTownScreen(player), pendingMessages });

      // Charm gate check
      if (outcome.charmCheck && player.charm < outcome.charmCheck) {
        outcome = outcome.charmFail || { fight: true, msg: ['Your charm fails you!'] };
      }

      req.session.forestEvent = null;
      const msgs = [...(outcome.msg || [])];
      const updates = {};

      if (outcome.goldFlat) {
        const delta = outcome.goldFlat < 0
          ? Math.max(-Number(player.gold), outcome.goldFlat)
          : outcome.goldFlat;
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
      // HP changes: apply hpPct first, then flat hp, chaining updates
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
      if (outcome.hpPct || outcome.hp) {
        updates.hit_points = hpBase;
      }
      if (outcome.charm) {
        updates.charm = player.charm + outcome.charm;
        msgs.push(outcome.charm > 0
          ? `\`#Your charm increased by ${outcome.charm}!`
          : `\`@Your charm decreased by ${Math.abs(outcome.charm)}!`);
      }
      if (outcome.gem) {
        if (outcome.gem < 0 && player.gems <= 0) {
          msgs.push(`\`7You have no gems to offer.`);
          // Redirect to refuse outcome if possible
          const refuseOutcome = event.outcomes.refuse || event.outcomes.leave;
          if (refuseOutcome) {
            msgs.push(...(refuseOutcome.msg || []));
          }
        } else {
          updates.gems = Math.max(0, player.gems + outcome.gem);
          if (outcome.gem > 0) msgs.push(`\`0You found ${outcome.gem} gem${outcome.gem > 1 ? 's' : ''}!`);
        }
      }

      // Poison outcome
      if (outcome.poison) {
        updates.poisoned = 3;
        msgs.push(`\`2Poison seeps into your wounds...`);
      }

      // Quest start
      if (outcome.questStart) {
        updates.quest_id = outcome.questStart;
        updates.quest_step = 1;
        msgs.push(`\`$A new quest has begun: ${outcome.questStart.replace(/_/g, ' ')}`);
      }

      if (Object.keys(updates).length) {
        await updatePlayer(player.id, updates);
        player = await getPlayer(player.id);
      }

      // Level up check after exp gain
      if (outcome.expMult) {
        const levelUp = checkLevelUp(player);
        if (levelUp) {
          await updatePlayer(player.id, levelUp.updates);
          player = await getPlayer(player.id);
          await addNews(`\`$${player.handle}\`% has advanced to level \`$${levelUp.newLevel}\`%!`);
          if (!outcome.fight) {
            return res.json({ ...getLevelUpScreen(player, levelUp.newLevel, levelUp.hpGain, levelUp.strGain), pendingMessages: msgs });
          }
        }
      }

      // If this outcome triggers a fight
      if (outcome.fight) {
        const monster = getRandomMonster(Number(player.level));
        req.session.combat = { monster, round: 1, history: [] };
        // Don't decrement fights_left again — already consumed on forest entry
        player = await getPlayer(player.id);
        return res.json({ ...getForestEncounterScreen(player, monster), pendingMessages: msgs });
      }

      return res.json({ ...getTownScreen(player), pendingMessages: msgs });
    }

    // ── RESCUE ────────────────────────────────────────────────────────────
    case 'rescue': {
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
      await updatePlayer(player.id, { exp: Number(player.exp) + expGain, charm: player.charm + 1 });
      await addNews(`\`0${player.handle}\`% heroically rescued \`$${victim.handle}\`% from death in the forest!`);
      player = await getPlayer(player.id);

      const levelUp = checkLevelUp(player);
      if (levelUp) {
        await updatePlayer(player.id, levelUp.updates);
        player = await getPlayer(player.id);
        await addNews(`\`$${player.handle}\`% has advanced to level \`$${levelUp.newLevel}\`%!`);
        return res.json({ ...getLevelUpScreen(player, levelUp.newLevel, levelUp.hpGain, levelUp.strGain),
          pendingMessages: [
            `\`0You carry ${victim.handle} to safety! They owe you their life.`,
            `\`$You gain ${expGain.toLocaleString()} experience and +1 charm for your heroism!`,
          ]
        });
      }

      return res.json({ ...getTownScreen(player), pendingMessages: [
        `\`0You carry ${victim.handle} to safety! They owe you their life.`,
        `\`$You gain ${expGain.toLocaleString()} experience and +1 charm for your heroism!`,
      ]});
    }

    case 'rescue_skip': {
      req.session.rescueTarget = null;
      // Proceed to a normal forest fight (uses one fight slot)
      if (player.fights_left <= 0)
        return res.json({ ...getTownScreen(player), pendingMessages: [`\`@No forest fights left today.`] });
      await updatePlayer(player.id, { fights_left: player.fights_left - 1 });
      player = await getPlayer(player.id);
      const skipMonster = getRandomMonster(Number(player.level));
      req.session.combat = { monster: skipMonster, round: 1, history: [] };
      return res.json({ ...getForestEncounterScreen(player, skipMonster), pendingMessages });
    }

    case 'forest_attack':
    case 'forest_run':
    case 'forest_power': {
      const combat = req.session.combat;
      if (!combat) return res.json(getTownScreen(player));

      const monster = combat.monster;
      const round = combat.round || 1;
      const history = combat.history || [];
      const act = { forest_attack: 'attack', forest_run: 'run', forest_power: 'power' }[action];

      if (act === 'power' && player.skill_uses_left <= 0) {
        return res.json({ ...getForestEncounterScreen(player, monster), pendingMessages: [`\`@No skill uses left!`] });
      }
      if (act === 'power') {
        await updatePlayer(player.id, { skill_uses_left: player.skill_uses_left - 1 });
        player = await getPlayer(player.id);
      }

      const { playerDamage, monsterDamage, poisonDamage, fled, monsterFled, appliedPoison, log } = resolveRound(player, monster, act);
      const newHistory = [...history, ...log].slice(-30);

      // Apply rage if active (Death Knight)
      let finalPlayerDamage = playerDamage;
      if (act !== 'run' && (player.rage_active || req.session.raging)) {
        finalPlayerDamage = Math.floor(playerDamage * 2.0);
        log.push({ text: `\`@RAGE UNLEASHED! You strike for \`$${finalPlayerDamage}\`@ damage!` });
        await updatePlayer(player.id, { rage_active: 0 });
        req.session.raging = false;
      }

      // Weapon bonus effects
      const weaponBonus = getWeaponByNum(player.weapon_num)?.bonus;
      if (!fled && !monsterFled && act !== 'run') {
        if (weaponBonus === 'double_strike' && Math.random() < 0.20) {
          const bonus = Math.floor(finalPlayerDamage * 0.5);
          finalPlayerDamage += bonus;
          log.push({ text: `\`$Double Strike! You hit again for \`$${bonus}\`$ extra damage!` });
        }
        if (weaponBonus === 'armor_pierce') {
          // 30% bonus damage (already applied via reduced defense in combat)
          // just a flavor nudge — no extra calc needed here since applyDefense already ran
        }
        if (weaponBonus === 'stun' && Math.random() < 0.12) {
          log.push({ text: `\`$You stun the ${monster.name}! It staggers!` });
          // Reduce monster damage this round
        }
      }

      // Armor bonus effects
      const armorBonus = getArmorByNum(player.arm_num)?.bonus;
      let finalMonsterDamage = monsterDamage + (poisonDamage || 0);
      if (!fled && !monsterFled) {
        if (armorBonus === 'regen') {
          const regenHeal = 2;
          // Apply as negative damage offset
          finalMonsterDamage = Math.max(0, finalMonsterDamage - regenHeal);
          if (regenHeal > 0) log.push({ text: `\`2Your armour regenerates 2 HP.` });
        }
        if (armorBonus === 'evasion' && Math.random() < 0.15) {
          log.push({ text: `\`2You evade the attack! No damage taken.` });
          finalMonsterDamage = poisonDamage || 0; // only take poison damage
        }
        if (armorBonus === 'thorns' && monsterDamage > 0) {
          const thorns = 10;
          monster.currentHp = Math.max(0, monster.currentHp - thorns);
          log.push({ text: `\`2Your armour spikes reflect ${thorns} damage!` });
        }
      }

      // Handle poison resist
      let willPoison = appliedPoison;
      if (appliedPoison && armorBonus === 'poison_resist' && Math.random() < 0.50) {
        log.push({ text: `\`2Your armour resists the poison!` });
        willPoison = false;
      }
      if (willPoison) {
        await updatePlayer(player.id, { poisoned: 3 });
      }

      if (fled) {
        req.session.combat = null;
        return res.json(getForestCombatScreen(player, monster, log, false, false, round, history));
      }

      // Handle monster fled (treat as partial win — 50% loot)
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
      const newPlayerHp = Math.max(0, player.hit_points - finalMonsterDamage);
      await updatePlayer(player.id, { hit_points: newPlayerHp });
      player = await getPlayer(player.id);
      req.session.combat = { monster, round: round + 1, history: newHistory };

      if (monster.currentHp <= 0) {
        req.session.combat = null;
        await updatePlayer(player.id, { gold: Number(player.gold) + monster.gold, exp: Number(player.exp) + monster.exp });
        player = await getPlayer(player.id);
        await addNews(`\`0${player.handle}\`% slew a \`@${monster.name}\`% in the forest!`);

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
        const npcSavers = [
          'A passing healer', 'A wandering monk', 'A forest ranger',
          'A traveling merchant', 'A grizzled veteran', 'A mysterious stranger',
        ];
        const saver = npcSavers[Math.floor(Math.random() * npcSavers.length)];

        if (deathRoll < 0.20) {
          // Lucky — NPC saves them on the spot
          const savedHp = Math.max(1, Math.floor(player.hit_max * 0.15));
          await updatePlayer(player.id, { hit_points: savedHp });
          player = await getPlayer(player.id);
          await addNews(`\`0${player.handle}\`% was pulled from death's door by ${saver}!`);
          return res.json(getNpcRescueScreen(player, saver, monster, log, round, history));
        } else if (deathRoll < 0.45) {
          // Near death — waiting for a player to find and rescue them
          await updatePlayer(player.id, { near_death: 1, near_death_by: monster.name, hit_points: 0 });
          player = await getPlayer(player.id);
          await addNews(`\`@${player.handle}\`% lies near death in the forest, felled by a \`@${monster.name}\`%!`);
          return res.json(getNearDeathScreen(player, monster, log, round, history));
        } else {
          // Dead outright
          await updatePlayer(player.id, { dead: 1 });
          player = await getPlayer(player.id);
          await addNews(`\`@${player.handle}\`% was slain by a \`@${monster.name}\`% in the forest!`);
          return res.json(getForestCombatScreen(player, monster, log, false, true, round, history));
        }
      }

      const depth = req.session.forestDepth || 0;
      return res.json(getForestCombatScreen(player, monster, log, false, false, round, history, depth));
    }

    // ── WEAPON SHOP ───────────────────────────────────────────────────────
    case 'weapon_shop':
      return res.json({ ...getWeaponShopScreen(player), pendingMessages });

    case 'buy_weapon': {
      const num = parseInt(param);
      if (!num || num === 0) return res.json(getTownScreen(player));
      const weapon = getWeaponByNum(num);
      if (!weapon) return res.json(getWeaponShopScreen(player));
      if (Number(player.gold) < weapon.price)
        return res.json({ ...getWeaponShopScreen(player), pendingMessages: [`\`@You can't afford that!`] });
      if (player.weapon_num === weapon.num)
        return res.json({ ...getWeaponShopScreen(player), pendingMessages: [`\`7You already have that weapon.`] });

      const currentWeapon = getWeaponByNum(player.weapon_num);
      let newStr = Number(player.strength);
      if (currentWeapon) newStr -= currentWeapon.strength;
      newStr += weapon.strength;

      await updatePlayer(player.id, {
        gold: Number(player.gold) - weapon.price,
        strength: newStr,
        weapon_num: weapon.num,
        weapon_name: weapon.name,
      });
      player = await getPlayer(player.id);
      return res.json({ ...getWeaponShopScreen(player), pendingMessages: [`\`0You purchased a ${weapon.name}!`] });
    }

    // ── ARMOR SHOP ────────────────────────────────────────────────────────
    case 'armor_shop':
      return res.json({ ...getArmorShopScreen(player), pendingMessages });

    case 'buy_armor': {
      const num = parseInt(param);
      if (!num || num === 0) return res.json(getTownScreen(player));
      const armor = getArmorByNum(num);
      if (!armor) return res.json(getArmorShopScreen(player));
      if (Number(player.gold) < armor.price)
        return res.json({ ...getArmorShopScreen(player), pendingMessages: [`\`@You can't afford that!`] });
      if (player.arm_num === armor.num)
        return res.json({ ...getArmorShopScreen(player), pendingMessages: [`\`7You already have that armour.`] });

      const currentArmor = getArmorByNum(player.arm_num);
      let newDef = Number(player.defense);
      if (currentArmor) newDef -= currentArmor.defense;
      newDef += armor.defense;

      await updatePlayer(player.id, {
        gold: Number(player.gold) - armor.price,
        defense: newDef,
        arm_num: armor.num,
        arm_name: armor.name,
      });
      player = await getPlayer(player.id);
      return res.json({ ...getArmorShopScreen(player), pendingMessages: [`\`0You purchased ${armor.name}!`] });
    }

    // ── INN ───────────────────────────────────────────────────────────────
    case 'inn': {
      // Quest completion check
      if (player.quest_id === 'wounded_knight' && player.quest_step >= 1) {
        await updatePlayer(player.id, {
          quest_id: '',
          quest_step: 0,
          charm: player.charm + 2,
          exp: Number(player.exp) + 500 * player.level,
          gold: Number(player.gold) + 200 * player.level,
        });
        player = await getPlayer(player.id);
        pendingMessages = [...pendingMessages, `\`0The knight from the forest finds you here! "I kept my promise." He presses ${(200 * player.level).toLocaleString()} gold into your hands. +2 charm, +${(500 * player.level).toLocaleString()} exp!`];
      }
      return res.json({ ...getInnScreen(player), pendingMessages });
    }

    case 'inn_rest': {
      const cost = Math.max(50, Math.floor(player.level * 50 * (player.class === 2 ? 0.9 : 1.0)));
      if (Number(player.gold) < cost)
        return res.json({ ...getInnScreen(player), pendingMessages: [`\`@Not enough gold! Costs ${cost} gold.`] });
      if (player.hit_points >= player.hit_max)
        return res.json({ ...getInnScreen(player), pendingMessages: [`\`7You are already at full health!`] });
      await updatePlayer(player.id, { gold: Number(player.gold) - cost, hit_points: player.hit_max });
      player = await getPlayer(player.id);
      return res.json({ ...getInnScreen(player), pendingMessages: [`\`0You sleep peacefully and wake fully restored!`] });
    }

    case 'inn_gem': {
      if (player.gems <= 0)
        return res.json({ ...getInnScreen(player), pendingMessages: [`\`@You have no gems!`] });
      await updatePlayer(player.id, { gems: player.gems - 1, hit_points: player.hit_max });
      player = await getPlayer(player.id);
      return res.json({ ...getInnScreen(player), pendingMessages: [`\`0The gem glows and you are fully healed!`] });
    }

    // ── BANK ──────────────────────────────────────────────────────────────
    case 'bank':
      return res.json({ ...getBankScreen(player), pendingMessages });

    case 'bank_deposit': {
      const amount = Math.max(0, parseInt(param) || 0);
      if (!amount) return res.json({ ...getBankScreen(player), pendingMessages: [`\`7No amount specified.`] });
      if (amount > Number(player.gold))
        return res.json({ ...getBankScreen(player), pendingMessages: [`\`@You don't have that much gold!`] });
      await updatePlayer(player.id, { gold: Number(player.gold) - amount, bank: Number(player.bank) + amount });
      player = await getPlayer(player.id);
      return res.json({ ...getBankScreen(player), pendingMessages: [`\`0Deposited \`$${amount.toLocaleString()}\`0 gold.`] });
    }

    case 'bank_withdraw': {
      const amount = Math.max(0, parseInt(param) || 0);
      if (!amount) return res.json({ ...getBankScreen(player), pendingMessages: [`\`7No amount specified.`] });
      if (amount > Number(player.bank))
        return res.json({ ...getBankScreen(player), pendingMessages: [`\`@You don't have that much in the bank!`] });
      await updatePlayer(player.id, { gold: Number(player.gold) + amount, bank: Number(player.bank) - amount });
      player = await getPlayer(player.id);
      return res.json({ ...getBankScreen(player), pendingMessages: [`\`0Withdrew \`$${amount.toLocaleString()}\`0 gold.`] });
    }

    // ── MASTER ────────────────────────────────────────────────────────────
    case 'master': {
      // Quest completion check
      if (player.quest_id === 'wounded_knight' && player.quest_step >= 1) {
        await updatePlayer(player.id, {
          quest_id: '',
          quest_step: 0,
          charm: player.charm + 2,
          exp: Number(player.exp) + 500 * player.level,
          gold: Number(player.gold) + 200 * player.level,
        });
        player = await getPlayer(player.id);
        pendingMessages = [...pendingMessages, `\`0The knight from the forest finds you here! "I kept my promise." He presses ${(200 * player.level).toLocaleString()} gold into your hands. +2 charm, +${(500 * player.level).toLocaleString()} exp!`];
      }
      return res.json({ ...getMasterScreen(player), pendingMessages });
    }

    case 'master_train': {
      const stat = (req.body.inputParam || '').toLowerCase();
      const points = Math.max(1, parseInt(req.body.inputValue || param) || 1);
      const cost = player.level * 75 * points;
      if (!['strength', 'defense'].includes(stat)) return res.json(getMasterScreen(player));
      if (Number(player.gold) < cost)
        return res.json({ ...getMasterScreen(player), pendingMessages: [`\`@Not enough gold! Costs \`$${cost.toLocaleString()}\`@ gold.`] });
      await updatePlayer(player.id, { gold: Number(player.gold) - cost, [stat]: Number(player[stat]) + points });
      player = await getPlayer(player.id);
      return res.json({ ...getMasterScreen(player), pendingMessages: [`\`0Seth nods approvingly. Your ${stat} increased by ${points}!`] });
    }

    // ── TAVERN / PLAYERS ──────────────────────────────────────────────────
    case 'tavern':
    case 'players': {
      const others = await getAllPlayers();
      return res.json({ ...getTavernScreen(player, others), pendingMessages });
    }

    case 'tavern_attack': {
      const idx = parseInt(param) - 1;
      const others = (await getAllPlayers()).filter(p => p.id !== player.id);
      const target = others[idx];
      if (!target)
        return res.json({ ...getTavernScreen(player, await getAllPlayers()), pendingMessages: [`\`@Invalid target.`] });
      if (player.human_fights_left <= 0)
        return res.json({ ...getTavernScreen(player, await getAllPlayers()), pendingMessages: [`\`@No human fights left today!`] });
      if (target.dead)
        return res.json({ ...getTavernScreen(player, await getAllPlayers()), pendingMessages: [`\`7${target.handle} is already dead.`] });

      const fullTarget = await getPlayer(target.id);
      const { attackerWon, log } = resolvePvP(player, fullTarget);
      await updatePlayer(player.id, { human_fights_left: player.human_fights_left - 1 });

      const msgs = [...log.slice(-5)];
      if (attackerWon) {
        const stolen = Math.floor(Number(fullTarget.gold) * 0.25);
        await updatePlayer(player.id, { kills: player.kills + 1, gold: Number(player.gold) + stolen });
        await updatePlayer(target.id, { dead: 1, gold: Math.max(0, Number(fullTarget.gold) - stolen) });
        await addNews(`\`@${player.handle}\`% defeated \`@${fullTarget.handle}\`% in the tavern and stole \`$${stolen.toLocaleString()}\`% gold!`);
        msgs.push(`\`$You defeated ${fullTarget.handle} and stole ${stolen.toLocaleString()} gold!`);
      } else {
        const hpLost = Math.floor(player.hit_points * 0.5);
        await updatePlayer(player.id, { hit_points: Math.max(1, player.hit_points - hpLost) });
        await addNews(`\`@${player.handle}\`% was defeated by \`$${fullTarget.handle}\`% in the tavern!`);
        msgs.push(`\`@You were defeated! You lost ${hpLost} HP.`);
      }

      player = await getPlayer(player.id);
      return res.json({ ...getTavernScreen(player, await getAllPlayers()), pendingMessages: msgs });
    }

    // ── VIOLET'S GARDEN ───────────────────────────────────────────────────
    case 'garden':
      return res.json({ ...getGardenScreen(player), pendingMessages });

    case 'garden_female': {
      await updatePlayer(player.id, { charm: player.charm + 1, flirted_today: 1 });
      player = await getPlayer(player.id);
      return res.json({ ...getTownScreen(player), pendingMessages: [`\`#Violet gives you a rose. Your charm is now ${player.charm}!`] });
    }

    case 'garden_flower': {
      await updatePlayer(player.id, { flirted_today: 1 });
      const good = Math.random() < 0.3;
      if (good) {
        await updatePlayer(player.id, { charm: player.charm + 1 });
        player = await getPlayer(player.id);
        return res.json({ ...getTownScreen(player), pendingMessages: [`\`#"How sweet of you!" Violet smiles. Your charm is now ${player.charm}!`] });
      }
      player = await getPlayer(player.id);
      return res.json({ ...getTownScreen(player), pendingMessages: [`\`#Violet blushes and accepts the flower gracefully.`] });
    }

    case 'garden_compliment': {
      await updatePlayer(player.id, { flirted_today: 1 });
      const boost = player.charm >= 15 && Math.random() < 0.4;
      if (boost) {
        await updatePlayer(player.id, { charm: player.charm + 1 });
        player = await getPlayer(player.id);
        return res.json({ ...getTownScreen(player), pendingMessages: [`\`#"Flattery will get you everywhere." Your charm is now ${player.charm}!`] });
      }
      player = await getPlayer(player.id);
      return res.json({ ...getTownScreen(player), pendingMessages: [`\`#Violet raises an eyebrow. "Flattery will get you everywhere."`] });
    }

    case 'garden_kiss': {
      await updatePlayer(player.id, { flirted_today: 1 });
      const success = player.charm >= 12 && Math.random() < 0.3;
      if (success) {
        await updatePlayer(player.id, { charm: player.charm + 2, lays: player.lays + 1 });
        player = await getPlayer(player.id);
        return res.json({ ...getTownScreen(player), pendingMessages: [
          `\`#Violet leans in and kisses your cheek. Your charm soars! Now ${player.charm}.`
        ]});
      }
      player = await getPlayer(player.id);
      return res.json({ ...getTownScreen(player), pendingMessages: [
        `\`#Violet steps back laughing. "Perhaps when you're more... charming."`,
        `\`7(You need at least 12 charm to have a chance.)`
      ]});
    }

    // ── BARD ──────────────────────────────────────────────────────────────
    case 'bard': {
      const kings = await getHallOfKings();
      return res.json({ ...getBardScreen(kings), pendingMessages });
    }

    // ── NEWS ──────────────────────────────────────────────────────────────
    case 'news': {
      const newsList = await getRecentNews(20);
      return res.json({ ...getNewsScreen(newsList), pendingMessages });
    }

    // ── CHARACTER ─────────────────────────────────────────────────────────
    case 'character':
      return res.json({ ...getCharacterScreen(player), pendingMessages });

    // ── FOREST DEEPER ─────────────────────────────────────────────────────
    case 'forest_deeper': {
      if (player.fights_left <= 0)
        return res.json({ ...getTownScreen(player), pendingMessages: [`\`@No forest fights left today!`] });
      await updatePlayer(player.id, { fights_left: player.fights_left - 1 });
      player = await getPlayer(player.id);

      const depth = (req.session.forestDepth || 0) + 1;
      req.session.forestDepth = depth;

      // Deeper monsters are harder but drop more loot
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

    // ── FOREST RAGE ───────────────────────────────────────────────────────
    case 'forest_rage': {
      if (player.class !== 1)
        return res.json({ ...getTownScreen(player), pendingMessages: [`\`@Only Death Knights can Rage!`] });
      const combat = req.session.combat;
      if (!combat) return res.json(getTownScreen(player));

      const rageCost = Math.floor(player.hit_max * 0.15);
      const newHp = Math.max(1, player.hit_points - rageCost);
      await updatePlayer(player.id, { hit_points: newHp, rage_active: 1 });
      player = await getPlayer(player.id);
      req.session.raging = true;

      const depth = req.session.forestDepth || 0;
      return res.json({
        ...getForestEncounterScreen(player, combat.monster, depth),
        pendingMessages: [`\`@You enter a blood rage! Lost ${rageCost} HP. Your next strike will be devastating!`],
      });
    }

    // ── SHOP STEAL ────────────────────────────────────────────────────────
    case 'shop_steal_weapon':
    case 'shop_steal_armor': {
      if (player.class !== 3)
        return res.json({ ...getTownScreen(player), pendingMessages: [`\`@Only Thieves can attempt this!`] });

      const isWeapon = action === 'shop_steal_weapon';
      const items = isWeapon ? WEAPONS : ARMORS;

      // Try to steal a random item one tier above current
      const currentNum = isWeapon ? player.weapon_num : player.arm_num;
      const nextTierItems = items.filter(w => w && w.tier === (currentNum + 1));

      if (nextTierItems.length === 0) {
        const screen = isWeapon ? getWeaponShopScreen(player) : getArmorShopScreen(player);
        return res.json({ ...screen, pendingMessages: [`\`7Nothing worth stealing here.`] });
      }

      const target = nextTierItems[Math.floor(Math.random() * nextTierItems.length)];

      if (Math.random() < 0.20) {
        // Success!
        if (isWeapon) {
          const currentWeapon = getWeaponByNum(player.weapon_num);
          let newStr = Number(player.strength);
          if (currentWeapon) newStr -= currentWeapon.strength;
          newStr += target.strength;
          await updatePlayer(player.id, { strength: newStr, weapon_num: target.num, weapon_name: target.name });
        } else {
          const currentArmor = getArmorByNum(player.arm_num);
          let newDef = Number(player.defense);
          if (currentArmor) newDef -= currentArmor.defense;
          newDef += target.defense;
          await updatePlayer(player.id, { defense: newDef, arm_num: target.num, arm_name: target.name });
        }
        player = await getPlayer(player.id);
        const screen = isWeapon ? getWeaponShopScreen(player) : getArmorShopScreen(player);
        await addNews(`\`3${player.handle}\`% quietly liberated a ${target.name} from Ignacius's shop...`);
        return res.json({ ...screen, pendingMessages: [`\`3Smooth. You walk out with a ${target.name}. No one saw a thing.`] });
      } else {
        // Caught!
        const penalty = Math.floor(player.hit_max * 0.20);
        const newHp = Math.max(1, player.hit_points - penalty);
        await updatePlayer(player.id, { hit_points: newHp });
        player = await getPlayer(player.id);
        const screen = isWeapon ? getWeaponShopScreen(player) : getArmorShopScreen(player);
        return res.json({ ...screen, pendingMessages: [`\`@Caught! The shopkeeper throws you out. You lost ${penalty} HP in the scuffle.`] });
      }
    }

    // ── TAVERN INTIMIDATE ─────────────────────────────────────────────────
    case 'tavern_intimidate': {
      if (player.class !== 1)
        return res.json({ ...getTavernScreen(player, await getAllPlayers()), pendingMessages: [`\`@Only Death Knights can Intimidate!`] });
      if (player.human_fights_left <= 0)
        return res.json({ ...getTavernScreen(player, await getAllPlayers()), pendingMessages: [`\`@No human fights left today!`] });

      const idx = parseInt(param) - 1;
      const others = (await getAllPlayers()).filter(p => p.id !== player.id);
      const target = others[idx];
      if (!target)
        return res.json({ ...getTavernScreen(player, await getAllPlayers()), pendingMessages: [`\`@Invalid target.`] });
      if (target.dead)
        return res.json({ ...getTavernScreen(player, await getAllPlayers()), pendingMessages: [`\`7${target.handle} is already dead.`] });

      await updatePlayer(player.id, { human_fights_left: player.human_fights_left - 1 });

      const successChance = Math.min(0.80, 0.40 + (player.strength - (target.strength || 15)) / 200);
      if (Math.random() < successChance) {
        const stolen = Math.floor(Number(target.gold) * 0.15);
        await updatePlayer(player.id, { gold: Number(player.gold) + stolen });
        await updatePlayer(target.id, { gold: Math.max(0, Number(target.gold) - stolen) });
        await addNews(`\`@${player.handle}\`% intimidated \`@${target.handle}\`% and seized \`$${stolen.toLocaleString()}\`% gold!`);
        player = await getPlayer(player.id);
        return res.json({ ...getTavernScreen(player, await getAllPlayers()), pendingMessages: [
          `\`@You loom over ${target.handle} with a death stare.`,
          `\`@They hand over ${stolen.toLocaleString()} gold without a word.`,
        ]});
      } else {
        return res.json({ ...getTavernScreen(player, await getAllPlayers()), pendingMessages: [
          `\`7${target.handle} meets your gaze and doesn't flinch.`,
          `\`7Even a Death Knight needs more than a stare to shake this one.`,
        ]});
      }
    }

    // ── TOWN CRIER ────────────────────────────────────────────────────────
    case 'crier':
      return res.json({ ...getCrierScreen(player), pendingMessages });

    case 'post_crier': {
      const TODAY_VAL = Math.floor(Date.now() / 86400000);
      const msg = (param || '').trim().substring(0, 60);
      if (!msg) return res.json({ ...getCrierScreen(player), pendingMessages: [`\`7No message entered.`] });
      if (Number(player.gold) < 50)
        return res.json({ ...getCrierScreen(player), pendingMessages: [`\`@Not enough gold! Town crier costs 50 gold.`] });
      await updatePlayer(player.id, { gold: Number(player.gold) - 50, crier_message: msg, crier_day: TODAY_VAL });
      await addNews(`\`6[CRIER]\`% ${player.handle}: "${msg}"`);
      player = await getPlayer(player.id);
      return res.json({ ...getTownScreen(player), pendingMessages: [`\`6The town crier bellows your message across Harood!`] });
    }

    // ── RED DRAGON ────────────────────────────────────────────────────────
    case 'dragon': {
      if (player.level < 12)
        return res.json({ ...getTownScreen(player), pendingMessages: [`\`@You must reach level 12 to challenge the Red Dragon!`] });
      return res.json({ ...getDragonScreen(player), pendingMessages });
    }

    case 'dragon_fight':
    case 'dragon_continue': {
      if (player.level < 12) return res.json(getTownScreen(player));
      if (!req.session.dragonCombat && action === 'dragon_continue') return res.json(getTownScreen(player));

      const dragonHp = req.session.dragonCombat ? req.session.dragonCombat.dragonHp : RED_DRAGON.hp;
      const dragon = { ...RED_DRAGON, currentHp: dragonHp, maxHp: RED_DRAGON.hp };

      const { playerDamage, monsterDamage, log } = resolveRound(player, dragon, 'attack');
      dragon.currentHp = Math.max(0, dragon.currentHp - playerDamage);
      const newHp = Math.max(0, player.hit_points - monsterDamage);
      await updatePlayer(player.id, { hit_points: newHp });
      player = await getPlayer(player.id);

      if (dragon.currentHp <= 0) {
        req.session.dragonCombat = null;
        await updatePlayer(player.id, { times_won: player.times_won + 1, seen_dragon: 5, is_legend: 1 });
        await addToHallOfKings(player);
        await addNews(`\`$*** ${player.handle} has slain the Red Dragon and is crowned King! ***`);
        player = await getPlayer(player.id);
        return res.json({
          screen: 'dragon_win', title: 'Victory!',
          lines: [
            ...renderBanner('dragon'),
            `\`$              *** YOU WIN! ***`,
            '', ...log.map(l => `  ${l.text}`), '',
            `\`$  ${RED_DRAGON.death}`, '',
            `\`%  Congratulations, ${player.handle}!`,
            `\`$  *** YOU ARE NOW KING OF THE REALM! ***`,
            `\`%  This is win number \`$${player.times_won}\`% for you!`,
            '', `\`$  [T]\`% Return to Town`,
          ],
          choices: [{ key: 'T', label: 'Return to Town', action: 'town' }],
          pendingMessages: [],
        });
      }

      if (newHp <= 0) {
        req.session.dragonCombat = null;
        await updatePlayer(player.id, { dead: 1 });
        await addNews(`\`@The Red Dragon slew ${player.handle} in glorious combat!`);
        return res.json({
          screen: 'dragon_death', title: 'Defeated...',
          lines: [
            ...renderBanner('dragon'),
            `\`@            *** THE DRAGON WINS ***`,
            '', ...log.map(l => `  ${l.text}`), '',
            `\`@  The Red Dragon laughs. "Pathetic."`,
            `\`%  You have been slain. Return tomorrow.`,
            '', `\`$  [T]\`% Return to Town`,
          ],
          choices: [{ key: 'T', label: 'Return to Town', action: 'town' }],
          pendingMessages: [],
        });
      }

      req.session.dragonCombat = { dragonHp: dragon.currentHp };
      const hpClass = newHp < player.hit_max * 0.3 ? '@' : '0';
      return res.json({
        screen: 'dragon_combat', title: 'Fighting the Dragon!',
        lines: [
          ...renderBanner('dragon'),
          `\`@              *** DRAGON COMBAT ***`,
          '', ...log.map(l => `  ${l.text}`), '',
          `\`!  Dragon HP: \`@${dragon.currentHp.toLocaleString()}\`!/2,000`,
          `\`!  Your HP:   \`${hpClass}${newHp.toLocaleString()}\`!/\`%${player.hit_max.toLocaleString()}`,
          '', `\`$  [F]\`% Continue Fighting!`, `\`$  [R]\`% Flee!`,
        ],
        choices: [
          { key: 'F', label: 'Fight On!', action: 'dragon_continue' },
          { key: 'R', label: 'Flee!', action: 'dragon_flee' },
        ],
        pendingMessages: [],
      });
    }

    case 'dragon_flee': {
      req.session.dragonCombat = null;
      const goldLost = Math.floor(Number(player.gold) * 0.5);
      await updatePlayer(player.id, { gold: Number(player.gold) - goldLost });
      player = await getPlayer(player.id);
      return res.json({ ...getTownScreen(player), pendingMessages: [`\`@You flee! You lose ${goldLost.toLocaleString()} gold in your panic!`] });
    }

    // ── LOGOUT ────────────────────────────────────────────────────────────
    case 'logout':
      req.session.destroy();
      return res.json({ screen: 'login', lines: [], choices: [], pendingMessages: [] });

    default:
      return res.json({ ...getTownScreen(player), pendingMessages });
  }
}));

module.exports = router;
