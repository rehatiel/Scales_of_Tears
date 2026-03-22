// Prestige handler — allows level-12 Dragonslayers to reset and ascend.
// Each prestige tier grants permanent starting bonuses and harder monsters.
const { getPlayer, updatePlayer, addNews } = require('../../db');
const { getTownScreen } = require('../engine');
const { CLASS_START_HP, CLASS_START_STR, getPrestigeTitle } = require('../data');

// Per-prestige-level permanent bonuses applied at each ascension.
const PRESTIGE_HP_BONUS  = 10;  // added to starting HP each tier
const PRESTIGE_STR_BONUS = 5;   // added to starting Strength each tier

async function prestige_confirm({ player, req, res, pendingMessages }) {
  if (player.level < 12 || (player.times_won || 0) < 1)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`@You must be level 12 and have slain the dragon to ascend.'] });

  const nextPrestige   = (player.prestige_level || 0) + 1;
  const newHp          = (CLASS_START_HP[player.class]  || 25) + nextPrestige * PRESTIGE_HP_BONUS;
  const newStr         = (CLASS_START_STR[player.class] || 18) + nextPrestige * PRESTIGE_STR_BONUS;
  const goldKept       = Math.floor(Number(player.gold) * 0.50);
  const prestigeTitle  = getPrestigeTitle(nextPrestige);
  const monsterScale   = Math.round(nextPrestige * 20);

  return res.json({
    screen: 'prestige_confirm',
    title:  'Ascend?',
    lines: [
      '`!  ══════════════════════════════════════',
      '`$        ASCENSION — PRESTIGE TIER ' + nextPrestige,
      '`!  ══════════════════════════════════════',
      '',
      '`%  You have conquered the dragon. Now choose:',
      '`%  carry your legend into a harder world, or rest.',
      '',
      '`7  ── WHAT RESETS ────────────────────────',
      '`8  Level, experience, stats, gear, skills, perks',
      '`8  Times Won counter (you\'ll face the Red Dragon again)',
      '',
      '`7  ── WHAT YOU KEEP ─────────────────────',
      '`0  Bank gold (all of it)',
      '`0  Named items you\'ve found',
      '`0  Faction reputation',
      `\`0  ${goldKept.toLocaleString()} gold (50% of pocket gold)`,
      '',
      '`7  ── YOUR PERMANENT BONUS ───────────────',
      `\`$  Title prefix: "${prestigeTitle}"`,
      `\`$  +${newHp} starting HP  (was ${CLASS_START_HP[player.class] || 25})`,
      `\`$  +${newStr} starting Strength  (was ${CLASS_START_STR[player.class] || 18})`,
      `\`@  Monsters are ${monsterScale}% stronger`,
      '',
      '`!  [Y]`% Ascend  `8— begin Prestige ' + nextPrestige,
      '`$  [N]`% Not yet — return to town',
    ],
    choices: [
      { key: 'Y', label: 'Ascend!', action: 'prestige_execute' },
      { key: 'N', label: 'Not yet', action: 'town' },
    ],
    pendingMessages: [],
  });
}

async function prestige_execute({ player, req, res, pendingMessages }) {
  if (player.level < 12 || (player.times_won || 0) < 1)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`@Ascension requires level 12 and at least one dragon kill.'] });

  const nextPrestige = (player.prestige_level || 0) + 1;
  const newHp        = (CLASS_START_HP[player.class]  || 25) + nextPrestige * PRESTIGE_HP_BONUS;
  const newStr       = (CLASS_START_STR[player.class] || 18) + nextPrestige * PRESTIGE_STR_BONUS;
  const goldKept     = Math.floor(Number(player.gold) * 0.50);
  const prestigeTitle = getPrestigeTitle(nextPrestige);

  await updatePlayer(player.id, {
    // Reset progression
    level:            1,
    exp:              0,
    hit_max:          newHp,
    hit_points:       newHp,
    strength:         newStr,
    defense:          0,
    weapon_num:       1,
    weapon_name:      'Stick',
    arm_num:          1,
    arm_name:         'Coat',
    skill_points:     0,
    skill_uses_left:  0,
    perks:            '[]',
    perk_points:      0,
    times_won:        0,
    seen_dragon:      0,
    // Clear status effects
    dead:             0,
    near_death:       0,
    poisoned:         0,
    wounds:           '[]',
    infection_type:   null,
    infection_stage:  0,
    infection_days:   0,
    is_vampire:       0,
    vampire_bites:    0,
    // Gold: keep 50% of pocket gold; bank is untouched
    gold:             goldKept,
    // Prestige tier
    prestige_level:   nextPrestige,
  });

  player = await getPlayer(player.id);
  await addNews(`\`!${player.handle}\`% has ascended to Prestige ${nextPrestige} — "${prestigeTitle}"! A new legend begins.`);

  // Clear dragon combat session in case it's still set
  req.session.dragonCombat = null;

  return res.json({
    screen: 'prestige_done',
    title:  `Prestige ${nextPrestige} — ${prestigeTitle}`,
    lines: [
      '`!  ══════════════════════════════════════',
      `\`$        ASCENSION COMPLETE`,
      '`!  ══════════════════════════════════════',
      '',
      `\`%  You are reborn as ${player.handle}, ${prestigeTitle}.`,
      '',
      `\`0  Starting HP:       ${newHp}`,
      `\`0  Starting Strength: ${newStr}`,
      `\`0  Gold carried:      ${goldKept.toLocaleString()}`,
      '',
      '`7  The world remembers what you\'ve done.',
      '`7  It will not be as forgiving this time.',
      '',
      '`$  [T]`% Begin Again',
    ],
    choices: [{ key: 'T', label: 'Begin Again', action: 'town' }],
    pendingMessages: [],
  });
}

module.exports = { prestige_confirm, prestige_execute };
