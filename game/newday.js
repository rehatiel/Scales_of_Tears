// Daily reset routine for LORD web port
const { addNews } = require('../db');
const { expForNextLevel, LEVEL_UP_GAINS, CLASS_NAMES } = require('./data');

async function runNewDay(player) {
  const updates = {};
  const messages = [];

  updates.fights_left = 10;
  updates.human_fights_left = 5;
  updates.flirted_today = 0;
  updates.special_done_today = 0;
  updates.skill_uses_left = Math.min(player.skill_points, 10);
  updates.rage_active = 0;

  if (player.near_death) {
    // No one came — the warrior perishes
    updates.near_death = 0;
    updates.near_death_by = '';
    updates.dead = 1;
    updates.hit_points = 0;
    messages.push(`\`@No one came to rescue you. You have perished in the forest...`);
    await addNews(`\`@${player.handle}\`% perished in the forest, never to be found.`);
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
    if (!player.near_death) await addNews(`\`@${player.handle}\`% was reincarnated from the dead.`);
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

  // Bank interest — capped at 10,000 gold per day to prevent runaway wealth
  if (player.bank > 0) {
    const interest = Math.min(10000, Math.floor(player.bank * 0.05));
    if (interest > 0) {
      updates.bank = player.bank + interest;
      messages.push(`\`$The First Bank of Harood pays you \`$${interest.toLocaleString()}\`$ gold in interest.`);
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
      await addNews(`\`$${player.handle}\`% has reached level \`$${newLevel}\`%!`);
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
