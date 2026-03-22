// Daily reset routine for SoT
const { addNews, getAllPlayers, getWorldState, setWorldState, getActiveWorldEvent, triggerWorldEvent, expireWorldEvents, getUndefeatedNamedEnemiesWithKills, getAllUndefeatedNamedEnemies, updateNamedEnemy, getInvadingEnemies } = require('../db');
const { getEventDef, pickNextEvent, EVENT_DURATION_DAYS } = require('./world_events');
const { expForNextLevel, LEVEL_UP_GAINS, CLASS_NAMES } = require('./data');
const { parseWounds, hasSerious, hasCritical, getLocationPenalties } = require('./wounds');
const { getHostileFactions, adjustReps, FACTIONS } = require('./factions');

async function runNewDay(player, dryRun = false) {
  const news = dryRun ? async () => {} : addNews;
  const updates = {};
  const messages = [];

  const atInn = !!player.retired_today;

  // ── Daily counter resets ──────────────────────────────────────────────────
  updates.fights_left       = 10;
  updates.human_fights_left = 5;
  updates.flirted_today     = 0;
  updates.special_done_today = 0;
  updates.skill_uses_left   = Math.min(player.skill_points, 10);
  updates.rage_active       = 0;
  updates.training_today    = 0;
  updates.drinks_today      = 0;
  updates.grove_healed_today = 0;
  updates.well_used_today   = 0;
  updates.guide_hired       = 0;
  updates.road_hint         = null;
  updates.herbalist_today   = 0;
  updates.retired_today     = 0;
  updates.retired_town      = '';
  updates.ruins_visited     = '[]';
  updates.dungeon_clears    = '[]';

  // Stamina: inn sleepers recover fully; everyone else recovers 60%
  const stamMax = player.stamina_max || 10;
  updates.stamina = atInn ? stamMax : Math.max(1, Math.floor(stamMax * 0.6));

  // ── Near-death expiry ─────────────────────────────────────────────────────
  if (player.near_death) {
    updates.near_death    = 0;
    updates.near_death_by = '';
    updates.dead          = 1;
    updates.hit_points    = 0;
    messages.push('`@No one came to rescue you. You have perished in the forest...');
    await news(`\`@${player.handle}\`% perished in the forest, never to be found.`);
  }

  // ── Captive ───────────────────────────────────────────────────────────────
  if (player.captive) {
    if (Math.random() < 0.15) {
      updates.captive                = 0;
      updates.captive_location       = null;
      updates.travel_to              = null;
      updates.travel_segments_done   = 0;
      updates.travel_segments_total  = 0;
      updates.camping                = 0;
      messages.push('`0In the dead of night, a hooded figure cuts your bonds.');
      messages.push('`0"Don\'t ask questions. Go." You run.');
      await news(`\`0${player.handle}\`% escaped captivity in the night!`);
    } else {
      messages.push('`#Another day passes in captivity. Your bonds hold.');
    }
  }

  // ── Camping ───────────────────────────────────────────────────────────────
  if (player.camping && !player.captive) {
    messages.push('`6Dawn breaks over your roadside camp.');
    messages.push('`6You are rested. The road awaits.');
  }

  // ── Death / reincarnation ─────────────────────────────────────────────────
  if (player.dead || updates.dead) {
    updates.dead       = 0;
    updates.near_death = 0;
    updates.poisoned   = 0;
    updates.hit_points = Math.max(5, Math.floor(player.hit_max * 0.5));
    const goldLost = Math.floor(Number(player.gold) * 0.5);
    updates.gold = Math.max(0, Number(player.gold) - goldLost);
    if (!messages.some(m => m.includes('perished'))) {
      messages.push(`\`@You have been reincarnated!\`% You lost \`$${goldLost.toLocaleString()}\`% gold.`);
    } else {
      messages.push(`\`@You have been reincarnated...\`% You lost \`$${goldLost.toLocaleString()}\`% gold.`);
    }
    if (player.level > 1) {
      updates.level    = player.level - 1;
      const gains      = LEVEL_UP_GAINS[player.class];
      updates.hit_max  = Math.max(15, player.hit_max - gains.hp);
      updates.strength = Math.max(15, player.strength - gains.strength);
      messages.push(`\`@You lost a level!\`% You are now level \`$${updates.level}\`%.`);
    }
    if (!player.near_death) await news(`\`@${player.handle}\`% was reincarnated from the dead.`);
  } else if (!player.near_death) {
    // HP recovery: inn = 30%, no inn = 15%; grievous wounds halve inn recovery
    const wounds = parseWounds(player);
    const hasGrievous = wounds.some(w => w.severity >= 4);
    let healPct = atInn ? (hasGrievous ? 0.15 : 0.30) : (hasGrievous ? 0 : 0.15);
    // Apply active world event inn heal multiplier
    if (atInn) {
      const activeEv = await getActiveWorldEvent();
      if (activeEv) {
        const { getEventDef: getEvDef } = require('./world_events');
        const evDef = getEvDef(activeEv.type);
        if (evDef?.effects?.innHealMult) healPct *= evDef.effects.innHealMult;
      }
    }
    const healAmount = Math.floor(player.hit_max * healPct);
    if (healAmount > 0) {
      updates.hit_points = Math.min(player.hit_max, player.hit_points + healAmount);
    }
  }

  // ── Poison fades overnight ────────────────────────────────────────────────
  if ((player.poisoned || 0) > 0) {
    updates.poisoned = player.poisoned - 1;
    if (updates.poisoned === 0) {
      messages.push('`2The poison has worked its way out of your system.');
    }
  }

  // ── Wound & infection overnight processing ────────────────────────────────
  const wounds = parseWounds(player);

  // Inn overnight wound healing: tier 1-2 improve, tier 3 partially, tier 4-5 unchanged
  if (atInn && wounds.length > 0) {
    let healed = false;
    const healedWounds = wounds.map(w => {
      if (w.severity <= 0) return null;
      if (w.severity <= 3) {
        healed = true;
        return { ...w, severity: w.severity - 1 };
      }
      return w; // grievous/mortal: no natural healing
    }).filter(w => w && w.severity > 0);
    if (healed) {
      updates.wounds = JSON.stringify(healedWounds);
      messages.push('`2Your wounds have improved overnight with rest.');
    }
  }

  // Location penalties drain stamina overnight (torso wounds)
  const locPenalties = getLocationPenalties(wounds);
  if (locPenalties.staminaDrain > 0) {
    const drained = Math.min(updates.stamina, locPenalties.staminaDrain);
    updates.stamina = Math.max(1, updates.stamina - drained);
    if (drained > 0) {
      messages.push(`\`8Your torso wound drains your strength. You wake with ${drained} less stamina.`);
    }
  }

  // Inn poultice holds stage-0 infection; stage 1+ progresses regardless
  const infHeld = atInn && (player.infection_stage || 0) === 0 && player.infection_type;
  if (infHeld) {
    messages.push('`2The innkeeper\'s poultice has kept your wound from worsening through the night.');
  }

  // Critical/serious wound near-death at inn
  if (atInn && hasCritical(wounds)) {
    if (Math.random() < 0.25) {
      updates.near_death = 1;
      updates.hit_points = 1;
      messages.push('`@You wake from sleep drenched in sweat and blood. Your grievous wounds have worsened drastically overnight.');
      await news(`\`@${player.handle}\`% was found near death in their inn room.`);
    }
  } else if (atInn && hasSerious(wounds)) {
    if (Math.random() < 0.10) {
      updates.near_death = 1;
      updates.hit_points = 1;
      messages.push('`@You barely wake — your wounds have festered badly through the night.');
      await news(`\`@${player.handle}\`% collapsed from their wounds at the inn.`);
    }
  }

  // ── Infection progression (5 stages: 0-4) ────────────────────────────────
  if (player.infection_type && player.infection_type !== 'vampire' && !infHeld) {
    const days = (player.infection_days || 0) + 1;
    updates.infection_days = days;

    // rot — progresses every 2 days, causes HP damage each day
    if (player.infection_type === 'rot') {
      if (days % 2 === 0 && (player.infection_stage || 0) < 4) {
        updates.infection_stage = (player.infection_stage || 0) + 1;
        const stageNames = ['', 'Pus and fever begin.', 'The wound fever has taken hold.', 'Red lines spread up from the wound — blood poisoning.', 'The flesh blackens. Gangrene is setting in.'];
        messages.push(`\`8${stageNames[updates.infection_stage] || 'The corruption worsens.'}`);
      }
      const stage = updates.infection_stage !== undefined ? updates.infection_stage : (player.infection_stage || 0);
      const rotDmg = (stage + 1) * 5;
      const currentHp = updates.hit_points !== undefined ? updates.hit_points : player.hit_points;
      updates.hit_points = Math.max(1, currentHp - rotDmg);
      messages.push(`\`8Rot eats at your flesh for \`@${rotDmg}\`8 damage while you sleep.`);
      // Stage 4 rot triggers near-death
      if (stage >= 4 && !updates.near_death) {
        updates.near_death = 1;
        updates.hit_points = 1;
        messages.push('`@The gangrene has overwhelmed you. You collapse, barely clinging to life.');
        await news(`\`@${player.handle}\`% was struck down by gangrene!`);
      }
    }

    // rabies — progresses every 3 days, drains charm and eventually str
    if (player.infection_type === 'rabies') {
      if (days % 3 === 0 && (player.infection_stage || 0) < 4) {
        updates.infection_stage = (player.infection_stage || 0) + 1;
        const stage = updates.infection_stage;
        if (stage === 1) messages.push('`2Headaches rack you. Light stings your eyes.');
        if (stage === 2) { updates.strength = Math.max(5, player.strength - 3); messages.push('`2A strange aggression overtakes you. You feel stronger, but wrong. -3 strength lost to fever.'); }
        if (stage === 3) { updates.strength = Math.max(5, (updates.strength || player.strength) - 5); messages.push('`2Convulsions rack your body overnight. -5 strength.'); }
        if (stage === 4) {
          messages.push('`@Madness descends. You are no longer yourself.');
          updates.near_death = 1;
          updates.hit_points = 1;
          await news(`\`@${player.handle}\`% has been driven to madness by the beast-sickness!`);
        }
      }
    }

    // vampire_bite — progresses every 2 days
    if (player.infection_type === 'vampire_bite') {
      const bites = (player.vampire_bites || 0) + 1;
      updates.vampire_bites = bites;
      if (days % 2 === 0 && (player.infection_stage || 0) < 4) {
        updates.infection_stage = (player.infection_stage || 0) + 1;
        const stage = updates.infection_stage;
        if (stage === 1) messages.push('`#Blood seems interesting to you now. Sunlight makes you squint.');
        if (stage === 2) messages.push('`#You notice your canines feel sharper. The hunger grows.');
        if (stage === 3) messages.push('`#You fed on something in the night. You don\'t fully remember what.');
        if (stage === 4) {
          updates.infection_type = 'vampire';
          updates.infection_stage = 0;
          updates.is_vampire = 1;
          messages.push('`#You wake with a burning thirst. The world looks different — sharper, darker.');
          messages.push('`#You are no longer entirely human.');
          await news(`\`#${player.handle}\`% has become a creature of the night!`);
        }
      }
    }

    // werebat — progresses every 2 days; combines vampiric and lycanthropic curses
    if (player.infection_type === 'werebat') {
      if (days % 2 === 0 && (player.infection_stage || 0) < 4) {
        updates.infection_stage = (player.infection_stage || 0) + 1;
        const stage = updates.infection_stage;
        if (stage === 1) messages.push('`#Fever. In the small hours you hear things no person should hear — heartbeats through stone walls.');
        if (stage === 2) {
          messages.push('`#You wake with small patches of dark membrane stretched between your fingers. They are gone by midday. Mostly.');
        }
        if (stage === 3) {
          messages.push('`#You flew last night. You remember it clearly — the cold air, the darkness below, the hunger.');
          messages.push('`#The two curses no longer feel separate. They are becoming one thing.');
        }
        if (stage === 4) {
          updates.infection_type = 'vampire';
          updates.infection_stage = 0;
          updates.is_vampire = 1;
          updates.infection_days = 0;
          messages.push('`#The beast and the blood-curse have merged completely. You are something that has no name.');
          messages.push('`#You take to the sky. You do not come back down as a person.');
          await news(`\`#${player.handle}\`% has been consumed by the werebat's curse!`);
        }
      }
    }
  }

  // ── Faction assassin overnight ambush ─────────────────────────────────────
  const hostileFactions = getHostileFactions(player);
  for (const faction of hostileFactions) {
    if (Math.random() < 0.15) {
      const dmg = Math.max(5, Math.floor(player.hit_max * 0.25));
      const goldLost = Math.min(Number(player.gold), Math.floor(Number(player.gold) * 0.10));
      const currentHp = updates.hit_points !== undefined ? updates.hit_points : player.hit_points;
      updates.hit_points = Math.max(1, currentHp - dmg);
      updates.gold = Math.max(0, (updates.gold !== undefined ? updates.gold : Number(player.gold)) - goldLost);
      messages.push(`\`@A ${faction.assassinName} found your room while you slept.`);
      messages.push(`\`@You wake bloodied — \`@${dmg}\`% damage and \`$${goldLost.toLocaleString()}\`@ gold stolen.`);
      await news(`\`@${player.handle}\`% was attacked in the night by a ${faction.assassinName}!`);
      break;
    }
  }

  // ── Vampire transformation shifts reputation ───────────────────────────────
  if (updates.is_vampire && !player.is_vampire) {
    Object.assign(updates, adjustReps(player, { necromancers: 15, knights: -20 }));
  }

  // ── Voidplate soul drain ──────────────────────────────────────────────────
  if (player.named_armor_id === 'voidplate' && player.armor_cursed) {
    const curCharm = updates.charm !== undefined ? updates.charm : player.charm;
    updates.charm = Math.max(0, curCharm - 1);
    messages.push('\`#The Voidplate feeds on your soul while you sleep. \`@−1 Charm.');
  }

  // ── Bank interest ─────────────────────────────────────────────────────────
  if (Number.isFinite(player.bank) && player.bank > 0) {
    const interest = Math.min(10000, Math.floor(player.bank * 0.05));
    if (interest > 0) {
      updates.bank = player.bank + interest;
      messages.push(`\`$The First Bank of Dawnmark pays you \`$${interest.toLocaleString()}\`$ gold in interest.`);
    }
  }

  // ── Marriage charm bonus ───────────────────────────────────────────────────
  if ((player.married_to || -1) !== -1) {
    updates.charm = Math.min(50, (player.charm || 10) + 1);
  }

  // ── Kids cost gold ─────────────────────────────────────────────────────────
  if ((player.kids || 0) > 0) {
    const kidCost = player.kids * 20;
    const currentGold = updates.gold !== undefined ? updates.gold : player.gold;
    if (currentGold >= kidCost) {
      updates.gold = currentGold - kidCost;
      messages.push(`\`6Your ${player.kids === 1 ? 'child costs' : `${player.kids} children cost`} you \`$${kidCost}\`6 gold today.`);
    } else {
      updates.gold = 0;
      updates.kids = Math.max(0, player.kids - 1);
      messages.push(`\`@You can no longer afford to feed your ${player.kids === 1 ? 'child' : 'children'}. One has left home.`);
    }
  }

  // ── Level-up check ────────────────────────────────────────────────────────
  // Skip if the player just lost a level from death — the level penalty must stick.
  const justLostLevel = (player.dead || updates.dead === 1) && updates.level !== undefined && updates.level < player.level;
  const currentLevel = updates.level || player.level;
  if (!justLostLevel && currentLevel < 12) {
    const nextExp = expForNextLevel(currentLevel);
    if (nextExp !== null && player.exp >= nextExp) {
      const newLevel = currentLevel + 1;
      updates.level = newLevel;
      const gains = LEVEL_UP_GAINS[player.class];
      updates.hit_max  = (updates.hit_max || player.hit_max) + gains.hp + newLevel * 2;
      updates.hit_points = updates.hit_max;
      updates.strength   = (updates.strength || player.strength) + gains.strength + newLevel;
      updates.skill_points = (player.skill_points || 0) + 1;
      updates.skill_uses_left = Math.min(updates.skill_points, 10);
      messages.push(`\`$You have gained a level!\`% You are now a level \`$${newLevel}\`% \`!${CLASS_NAMES[player.class]}\`%!`);
      await news(`\`$${player.handle}\`% has reached level \`$${newLevel}\`%!`);
    }
  }

  updates.last_day = Math.floor(Date.now() / 86400000);

  // ── Town invader: passive nightly HP drain ────────────────────────────────
  if (!player.dead && !updates.dead) {
    const townInvaders = await getInvadingEnemies(player.current_town || 'dawnmark');
    if (townInvaders.length > 0) {
      const inv = townInvaders[0];
      const drain = Math.max(1, Math.floor(player.hit_max * 0.05));
      const currentHp = updates.hit_points ?? player.hit_points;
      updates.hit_points = Math.max(1, currentHp - drain);
      messages.push(`\`@${inv.given_name} haunts the town — you lose \`@${drain}\`@ HP to fear and dread overnight.`);
    }
  }

  return { updates, messages };
}

const PERK_LEVELS = new Set([3, 6, 9, 12]);

function checkLevelUp(player) {
  if (player.level >= 12) return null;
  const nextExp = expForNextLevel(player.level);
  if (nextExp === null || player.exp < nextExp) return null;

  const newLevel      = player.level + 1;
  const gains         = LEVEL_UP_GAINS[player.class];
  const hpGain        = gains.hp + newLevel * 2;
  const strGain       = gains.strength + newLevel;
  const newHpMax      = player.hit_max + hpGain;
  const newSkillPoints = (player.skill_points || 0) + 1;
  const perkPoint     = PERK_LEVELS.has(newLevel);

  return {
    newLevel,
    hpGain,
    strGain,
    newSkillPoints,
    perkPoint,
    updates: {
      level:          newLevel,
      hit_max:        newHpMax,
      hit_points:     newHpMax,
      strength:       player.strength + strGain,
      skill_points:   newSkillPoints,
      skill_uses_left: Math.min(newSkillPoints, 10),
      ...(perkPoint ? { perk_points: (player.perk_points || 0) + 1 } : {}),
    },
  };
}

// ── World day: server-wide events, invasions, dragon spread ───────────────────
// Called once per day (guarded by last_world_day in world_state)
async function runWorldDay() {
  const { TOWNS } = require('./data');
  const today = Math.floor(Date.now() / 86400000);
  const lastWorldDay = parseInt(await getWorldState('last_world_day') || '0');
  if (lastWorldDay >= today) return; // already ran today

  await setWorldState('last_world_day', today);

  // 1. Expire old events and announce their end
  const expired = await expireWorldEvents();
  for (const type of expired) {
    const def = getEventDef(type);
    if (def) await addNews(def.newsExpiry);
  }

  // 2. Start a new event if none is active
  const active = await getActiveWorldEvent();
  if (!active) {
    const nextType = pickNextEvent(expired[0] || null);
    await triggerWorldEvent(nextType, EVENT_DURATION_DAYS);
    const def = getEventDef(nextType);
    if (def) await addNews(def.newsIntro);
  }

  // 3. Named enemy invasions: enemies with 3+ kills reach a random town
  const townIds = Object.keys(TOWNS);
  const candidates = await getUndefeatedNamedEnemiesWithKills(3);
  for (const enemy of candidates) {
    const targetTown = townIds[Math.floor(Math.random() * townIds.length)];
    await updateNamedEnemy(enemy.id, { reached_town: targetTown });
    const townName = TOWNS[targetTown]?.name || targetTown;
    await addNews(`\`@${enemy.given_name}${enemy.title ? ', ' + enemy.title : ''}\`% has been sighted near \`$${townName}\`%! The town is in danger!`);
  }

  // 4. Named enemy spread: enemies alive 7+ days grow stronger
  const allEnemies = await getAllUndefeatedNamedEnemies();
  for (const enemy of allEnemies) {
    const firstSeenKey = `nemesis:first_seen:${enemy.id}`;
    let firstSeen = await getWorldState(firstSeenKey);
    if (!firstSeen) {
      await setWorldState(firstSeenKey, String(today));
      continue;
    }
    const daysAlive = today - Number(firstSeen);
    if (daysAlive === 7) {
      const newStr = Math.floor(enemy.strength * 1.10);
      const newHp  = Math.floor(enemy.hp * 1.10);
      await updateNamedEnemy(enemy.id, { strength: newStr, hp: newHp });
      const displayName = `${enemy.given_name}${enemy.title ? ', ' + enemy.title : ''}`;
      await addNews(`\`@${displayName}\`% has grown more powerful — unchecked for a week, it spreads its influence!`);
    }
  }

  // 5. Dragon spread: post escalating warnings if unchallenged
  const lastKillDay = parseInt(await getWorldState('last_dragon_kill') || '0');
  if (lastKillDay > 0) {
    const daysSince = today - lastKillDay;
    if (daysSince === 7)
      await addNews('`@The Red Dragon has not been challenged in a week. It grows bolder. Its shadow darkens the frontier.');
    else if (daysSince > 7 && daysSince % 3 === 0)
      await addNews('`@The Red Dragon continues to roam unchallenged. The frontier trembles.');
  }
}

module.exports = { runNewDay, checkLevelUp, runWorldDay };
