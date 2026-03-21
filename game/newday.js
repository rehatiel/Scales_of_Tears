// Daily reset routine for SoT
const { addNews, getAllPlayers } = require('../db');
const { expForNextLevel, LEVEL_UP_GAINS, CLASS_NAMES } = require('./data');
const { parseWounds, hasSerious, hasCritical } = require('./wounds');
const { getHostileFactions, adjustReps, FACTIONS } = require('./factions');

async function runNewDay(player, dryRun = false) {
  const news = dryRun ? async () => {} : addNews;
  const updates = {};
  const messages = [];

  updates.fights_left = 10;
  updates.human_fights_left = 5;
  updates.flirted_today = 0;
  updates.special_done_today = 0;
  updates.skill_uses_left = Math.min(player.skill_points, 10);
  updates.rage_active = 0;
  updates.stamina = 10;
  updates.training_today = 0;
  updates.drinks_today = 0;
  updates.grove_healed_today = 0;
  updates.well_used_today = 0;
  updates.guide_hired = 0;
  updates.road_hint = null;

  if (player.near_death) {
    // No one came — the warrior perishes
    updates.near_death = 0;
    updates.near_death_by = '';
    updates.dead = 1;
    updates.hit_points = 0;
    messages.push(`\`@No one came to rescue you. You have perished in the forest...`);
    await news(`\`@${player.handle}\`% perished in the forest, never to be found.`);
  }

  // Captive: 15% chance of passive rescue overnight
  if (player.captive) {
    if (Math.random() < 0.15) {
      updates.captive = 0;
      updates.captive_location = null;
      updates.travel_to = null;
      updates.travel_segments_done = 0;
      updates.travel_segments_total = 0;
      updates.camping = 0;
      messages.push(`\`0In the dead of night, a hooded figure cuts your bonds.`);
      messages.push(`\`0"Don't ask questions. Go." You run.`);
      await news(`\`0${player.handle}\`% escaped captivity in the night!`);
    } else {
      messages.push(`\`#Another day passes in captivity. Your bonds hold.`);
    }
  }

  // Camping: new day restores stamina and prompts them to resume
  if (player.camping && !player.captive) {
    // Stamina already restored above via updates.stamina = 10
    messages.push(`\`6Dawn breaks over your roadside camp.`);
    messages.push(`\`6You are rested. The road awaits.`);
  }

  if (player.dead || updates.dead) {
    updates.dead = 0;
    updates.near_death = 0;
    updates.poisoned = 0;
    updates.hit_points = Math.max(5, Math.floor(player.hit_max * 0.5));
    const goldLost = Math.floor(player.gold * 0.5);
    updates.gold = player.gold - goldLost;
    if (!messages.some(m => m.includes('perished'))) {
      messages.push(`\`@You have been reincarnated!\`% You lost \`$${goldLost.toLocaleString()}\`% gold.`);
    } else {
      messages.push(`\`@You have been reincarnated...\`% You lost \`$${goldLost.toLocaleString()}\`% gold.`);
    }

    if (player.level > 1) {
      updates.level = player.level - 1;
      const gains = LEVEL_UP_GAINS[player.class];
      updates.hit_max = Math.max(15, player.hit_max - gains.hp);
      updates.strength = Math.max(15, player.strength - gains.strength);
      messages.push(`\`@You lost a level!\`% You are now level \`$${updates.level}\`%.`);
    }
    if (!player.near_death) await news(`\`@${player.handle}\`% was reincarnated from the dead.`);
  } else if (!player.near_death) {
    const healAmount = Math.floor(player.hit_max * 0.25);
    updates.hit_points = Math.min(player.hit_max, player.hit_points + healAmount);
  }

  // Poison fades by one round overnight
  if ((player.poisoned || 0) > 0) {
    updates.poisoned = player.poisoned - 1;
    if (updates.poisoned === 0) {
      messages.push(`\`2The poison has worked its way out of your system.`);
    }
  }

  // Reset retire flags each new day
  updates.retired_today = 0;
  updates.retired_town = '';

  // ── Wound & infection overnight processing ─────────────────────────────────

  const wounds = parseWounds(player);

  // Retired players with serious wounds have a chance of not waking up
  if (player.retired_today && hasCritical(wounds)) {
    if (Math.random() < 0.25) {
      updates.near_death = 1;
      updates.hit_points = 1;
      messages.push(`\`@You wake from sleep drenched in sweat and blood. Your wounds have worsened drastically overnight.`);
      await news(`\`@${player.handle}\`% was found near death in their inn room.`);
    }
  } else if (player.retired_today && hasSerious(wounds)) {
    if (Math.random() < 0.10) {
      updates.near_death = 1;
      updates.hit_points = 1;
      messages.push(`\`@You barely wake — your wounds have festered badly through the night.`);
      await news(`\`@${player.handle}\`% collapsed from their wounds at the inn.`);
    }
  }

  // Infection progression
  if (player.infection_type && player.infection_type !== 'vampire') {
    const days = (player.infection_days || 0) + 1;
    updates.infection_days = days;

    if (player.infection_type === 'rot') {
      // Rot worsens every 2 days; each stage deals HP damage
      if (days % 2 === 0 && player.infection_stage < 2) {
        updates.infection_stage = player.infection_stage + 1;
        messages.push(`\`8Your festering wounds have worsened overnight. Stage ${updates.infection_stage + 1}/3.`);
      }
      const rotDmg = (player.infection_stage + 1) * 5;
      const currentHp = updates.hit_points !== undefined ? updates.hit_points : player.hit_points;
      updates.hit_points = Math.max(1, currentHp - rotDmg);
      if (rotDmg > 0) messages.push(`\`8Rot eats at your flesh for \`@${rotDmg}\`8 damage while you sleep.`);
    }

    if (player.infection_type === 'rabies') {
      // Rabies progresses every 3 days; stat penalties at each stage
      if (days % 3 === 0 && player.infection_stage < 2) {
        updates.infection_stage = player.infection_stage + 1;
        updates.strength = Math.max(5, player.strength - 3);
        messages.push(`\`2The rabies advances. You feel weaker and more feverish. -3 strength.`);
      }
    }

    if (player.infection_type === 'vampire_bite') {
      const bites = (player.vampire_bites || 0) + 1;
      updates.vampire_bites = bites;
      if (player.infection_stage < 2 && bites >= 3) {
        updates.infection_stage = player.infection_stage + 1;
        messages.push(`\`#The vampire's taint spreads through your blood. The transformation nears.`);
      }
      // After stage 2, random transformation
      if (player.infection_stage >= 2 && Math.random() < 0.40) {
        updates.infection_type = 'vampire';
        updates.infection_stage = 0;
        updates.is_vampire = 1;
        messages.push(`\`#You wake with a burning thirst. The world looks different. Sharper. Darker.`);
        messages.push(`\`#You are no longer entirely human.`);
        await news(`\`#${player.handle}\`% has become a creature of the night!`);
      }
    }
  }

  // ── Faction assassin overnight town event ──────────────────────────────────
  // Each faction at -75 or below has a 15% chance to ambush the player overnight
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
      break; // only one ambush per night
    }
  }

  // Vampire transformation shifts reputation
  if (updates.is_vampire && !player.is_vampire) {
    Object.assign(updates, adjustReps(player, { necromancers: 15, knights: -20 }));
  }

  // Bank interest — capped at 10,000 gold per day to prevent runaway wealth
  if (player.bank > 0) {
    const interest = Math.min(10000, Math.floor(player.bank * 0.05));
    if (interest > 0) {
      updates.bank = player.bank + interest;
      messages.push(`\`$The First Bank of Dawnmark pays you \`$${interest.toLocaleString()}\`$ gold in interest.`);
    }
  }

  // Marriage charm bonus — being with someone makes you more personable
  if ((player.married_to || -1) !== -1) {
    updates.charm = Math.min(50, (player.charm || 10) + 1);
  }

  // Kids cost gold each day — they need feeding
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

  // Check for pending level-up
  const currentLevel = updates.level || player.level;
  if (currentLevel < 12) {
    const nextExp = expForNextLevel(currentLevel);
    if (nextExp !== null && player.exp >= nextExp) {
      const newLevel = currentLevel + 1;
      updates.level = newLevel;
      const gains = LEVEL_UP_GAINS[player.class];
      updates.hit_max = (updates.hit_max || player.hit_max) + gains.hp + newLevel * 2;
      updates.hit_points = updates.hit_max;
      updates.strength = (updates.strength || player.strength) + gains.strength + newLevel;
      updates.skill_points = (player.skill_points || 0) + 1;
      updates.skill_uses_left = Math.min(updates.skill_points, 10);
      messages.push(`\`$You have gained a level!\`% You are now a level \`$${newLevel}\`% \`!${CLASS_NAMES[player.class]}\`%!`);
      await news(`\`$${player.handle}\`% has reached level \`$${newLevel}\`%!`);
    }
  }

  updates.last_day = Math.floor(Date.now() / 86400000);

  return { updates, messages };
}

function checkLevelUp(player) {
  if (player.level >= 12) return null;
  const nextExp = expForNextLevel(player.level);
  if (nextExp === null || player.exp < nextExp) return null;

  const newLevel = player.level + 1;
  const gains = LEVEL_UP_GAINS[player.class];
  const hpGain = gains.hp + newLevel * 2;
  const strGain = gains.strength + newLevel;
  const newHpMax = player.hit_max + hpGain;
  const newSkillPoints = (player.skill_points || 0) + 1;

  return {
    newLevel,
    hpGain,
    strGain,
    newSkillPoints,
    updates: {
      level: newLevel,
      hit_max: newHpMax,
      hit_points: newHpMax,
      strength: player.strength + strGain,
      skill_points: newSkillPoints,
      skill_uses_left: Math.min(newSkillPoints, 10),
    },
  };
}

module.exports = { runNewDay, checkLevelUp };
