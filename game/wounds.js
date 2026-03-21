// Wound & infection system for SoT

const SEVERITY_NAMES = ['', 'Scratch', 'Flesh Wound', 'Deep Wound', 'Grievous Wound', 'Mortal Wound'];

// Derive monster family from name keywords
function getMonsterFamily(monster) {
  const n = monster.name.toLowerCase();
  if (/zombie|skeleton|ghoul|vampire|lich|wraith|shade|revenant|death knight/.test(n)) return 'undead';
  if (/rat|dog|wolf|boar|harpy|wererat|werewolf|bat|spider|hound|panther|bear/.test(n)) return 'beast';
  if (/giant|troll|ogre|cyclops|golem|titan/.test(n)) return 'giant';
  if (/slime|ooze|elemental|imp|demon|sprite|fairy|phantom|specter/.test(n)) return 'magical';
  return 'humanoid';
}

// Derive wound type from monster family
function getWoundType(monster) {
  const family = getMonsterFamily(monster);
  const n = monster.name.toLowerCase();
  if (family === 'undead') return 'bite';
  if (family === 'beast') return /rat|dog|wolf|bat|were/.test(n) ? 'bite' : 'slash';
  if (family === 'giant') return 'crush';
  if (family === 'magical') return 'bite';
  return 'slash';
}

// Severity 1-5 based on monster strength vs player
// 1=Scratch, 2=Flesh Wound, 3=Deep Wound, 4=Grievous Wound, 5=Mortal Wound
function getWoundSeverity(monster, player) {
  const ratio = monster.strength / Math.max(1, player.strength);
  if (ratio >= 3.0) return 5;
  if (ratio >= 2.0) return 4;
  if (ratio >= 1.0) return 3;
  if (ratio >= 0.5) return 2;
  return 1;
}

// Probability that a hit causes a wound (by severity tier)
function woundChance(severity, isCrit) {
  const base    = [0, 0.05, 0.10, 0.20, 0.30, 0.40][severity] || 0.05;
  const onCrit  = [0, 0.25, 0.35, 0.50, 0.65, 0.80][severity] || 0.25;
  return isCrit ? onCrit : base;
}

// Wound location weighted by attack type
function getWoundLocation(woundType) {
  const r = Math.random();
  if (woundType === 'bite') {
    // Bites target exposed areas — neck/head and arms
    if (r < 0.30) return 'head';
    if (r < 0.60) return 'arm';
    if (r < 0.85) return 'torso';
    return 'leg';
  }
  if (woundType === 'crush') {
    // Blunt force favours torso and legs
    if (r < 0.10) return 'head';
    if (r < 0.50) return 'torso';
    if (r < 0.80) return 'leg';
    return 'arm';
  }
  // Slash: relatively even distribution
  if (r < 0.15) return 'head';
  if (r < 0.40) return 'torso';
  if (r < 0.70) return 'arm';
  return 'leg';
}

// Parse wounds JSON array from player record
function parseWounds(player) {
  try { return JSON.parse(player.wounds || '[]'); } catch { return []; }
}

// Bleed HP per round for slash wounds (scales with severity)
function getBleedDamage(wound, hitMax) {
  const pcts = [0, 0.01, 0.02, 0.04, 0.07, 0.12];
  return Math.max(1, Math.floor(hitMax * (pcts[wound.severity] || 0.01)));
}

// Defense penalty from crush wounds
function getCrushDefPenalty(wounds) {
  const penByTier = [0, 0.03, 0.08, 0.18, 0.35, 0.55];
  let total = 0;
  for (const w of wounds) {
    if (w.type === 'crush') total += penByTier[w.severity] || 0;
  }
  return Math.min(0.75, total);
}

// Location-based stat penalties from wounds
function getLocationPenalties(wounds) {
  const p = { strengthPct: 0, fleePct: 0, charmPct: 0, staminaDrain: 0 };
  const strPenByTier    = [0, 0.02, 0.05, 0.10, 0.20, 0.35];
  const fleePenByTier   = [0, 0.02, 0.05, 0.12, 0.25, 0.40];
  const charmPenByTier  = [0, 0.01, 0.03, 0.07, 0.15, 0.25];
  const staminByTier    = [0, 0,    0,    1,    2,    3   ];
  for (const w of wounds) {
    const sev = Math.min(5, Math.max(1, w.severity || 1));
    switch (w.location) {
      case 'arm':   p.strengthPct += strPenByTier[sev];   break;
      case 'leg':   p.fleePct     += fleePenByTier[sev];  break;
      case 'head':  p.charmPct    += charmPenByTier[sev]; break;
      case 'torso': p.staminaDrain += staminByTier[sev];  break;
    }
  }
  p.strengthPct = Math.min(0.65, p.strengthPct);
  p.fleePct     = Math.min(0.80, p.fleePct);
  p.charmPct    = Math.min(0.50, p.charmPct);
  return p;
}

function hasSerious(wounds)  { return wounds.some(w => w.severity >= 2); }
function hasCritical(wounds) { return wounds.some(w => w.severity >= 4); }  // grievous or worse

// How "dirty" a monster's attack is — multiplies infection chance
function getDirtyWeaponMod(monster) {
  const family = getMonsterFamily(monster);
  if (family === 'undead')   return 1.0;  // supernatural, handled specifically
  if (family === 'beast')    return 1.3;  // teeth and claws are always filthy
  if (family === 'giant')    return 1.2;  // massive creatures, rarely clean
  if (family === 'magical')  return 0.7;  // magical entities have unnatural purity
  // Humanoid — weapon quality implied by monster level
  const lvl = monster.level || 1;
  if (lvl <= 2) return 1.6;  // rusty bandits, blood-caked blades
  if (lvl <= 5) return 1.2;  // mercenaries — serviceable but not clean
  if (lvl <= 8) return 1.0;  // professional fighters
  return 0.8;                // elite, disciplined soldiers
}

// Roll infection after a wound. woundType affects which infections are possible.
// dirtyMod scales infection probability for non-supernatural sources.
function rollInfection(monster, dirtyMod = 1.0, woundType = 'bite') {
  const family = getMonsterFamily(monster);
  const n = monster.name.toLowerCase();

  // ── Undead: specific supernatural infections ──────────────────────────────
  if (family === 'undead') {
    if (/werebat|vampire.*bat|bat.*vampire/.test(n)) {
      return { infectionType: 'werebat', message: '`#Two sets of fangs pierce your flesh — one cold as death, one burning with beast-sickness. The wounds feel wrong in a way that goes beyond pain.' };
    }
    if (/vampire/.test(n)) {
      return { infectionType: 'vampire_bite', message: '`#The vampire\'s fangs leave two dark marks. A strange cold spreads inward from the wound.' };
    }
    if (/zombie|ghoul/.test(n) && Math.random() < 0.35) {
      return { infectionType: 'rot', message: '`8The wound smells wrong already. Something in the creature\'s touch has fouled it.' };
    }
    return null;
  }

  // ── Beast: rabies and filth ───────────────────────────────────────────────
  if (family === 'beast' && woundType === 'bite') {
    if (/wererat|werewolf/.test(n) && Math.random() < 0.30 * dirtyMod) {
      return { infectionType: 'rabies', message: '`2The bite burns with unnatural heat. The beast-sickness is known to travel this way.' };
    }
    if (/rabid/.test(n) && Math.random() < 0.50 * dirtyMod) {
      return { infectionType: 'rabies', message: '`2Foam still flecks the creature\'s jaws. You feel the fever entering your blood even now.' };
    }
    if (Math.random() < 0.12 * dirtyMod) {
      return { infectionType: 'rot', message: '`8Wild creatures carry their own filth. The bite wound is already red and angry.' };
    }
    return null;
  }

  // ── Humanoid: dirty weapons cause festering wounds ────────────────────────
  if (family === 'humanoid' && Math.random() < 0.08 * dirtyMod) {
    const rusty = dirtyMod >= 1.4;
    const msg = rusty
      ? '`8That blade was notched and rust-red with old blood. It has left corruption behind.'
      : '`8Even a careful wound can fester. Watch it closely.';
    return { infectionType: 'rot', message: msg };
  }

  // ── Giants: crushing blows drive filth deep ───────────────────────────────
  if (family === 'giant' && woundType === 'crush' && Math.random() < 0.08 * dirtyMod) {
    return { infectionType: 'rot', message: '`8Giants wallow in filth. The crushing blow has driven grime deep into the wound.' };
  }

  return null;
}

// Resolve infection priority when a new infection is introduced
function resolveInfection(currentType, newType) {
  if (!newType) return currentType;
  if (currentType === 'vampire' || currentType === 'zombie') return currentType;
  if (newType === 'werebat') return newType;        // werebat dominates — worst of both
  if (currentType === 'werebat') return currentType;
  if (newType === 'vampire_bite') return newType;
  if (currentType === 'vampire_bite') return currentType;
  if (currentType === 'zombie' && newType === 'rabies') return currentType;
  return newType;
}

// Can the inn healer treat this infection?
// Stage 3+ vampire/werebat cannot be treated by a normal healer
function healerCanTreat(infectionType, infectionStage) {
  if (!infectionType || infectionType === 'vampire') return false;
  if (infectionType === 'werebat'      && infectionStage >= 3) return false;
  if (infectionType === 'vampire_bite' && infectionStage >= 3) return false;
  if (infectionType === 'rot'          && infectionStage >= 4) return false;
  if (infectionType === 'rabies'       && infectionStage >= 4) return false;
  return true;
}

// Can the herbalist treat this wound? Only tier 1-2.
function herbalistCanTreatWound(wound) { return wound.severity <= 2; }

// Can the herbalist treat this infection? Only rot/rabies stage 0-1.
function herbalistCanTreatInfection(infectionType, infectionStage) {
  if (!infectionType) return false;
  if (infectionType === 'vampire' || infectionType === 'vampire_bite' || infectionType === 'werebat') return false;
  return infectionStage <= 1;
}

// Gold cost for the inn healer to treat all wounds
function healerWoundCost(wounds, playerLevel) {
  const costByTier = [0, 15, 40, 100, 250, 600];
  return wounds.reduce((sum, w) => sum + (costByTier[w.severity] || 50) * playerLevel, 0);
}

// Gold cost for the inn healer to treat infection
function healerInfectionCost(infectionType, infectionStage, playerLevel) {
  const base = { rot: 80, rabies: 120, vampire_bite: 250, werebat: 450, zombie: 100 }[infectionType] || 100;
  return Math.floor(base * playerLevel * (1 + infectionStage * 0.7));
}

// Gold cost for the herbalist to treat a single wound (only tier 1-2)
function herbalistWoundCost(wound, playerLevel) {
  return wound.severity === 1 ? 10 * playerLevel : 35 * playerLevel;
}

// Gold cost for the herbalist to treat infection (only rot/rabies stage 0-1)
function herbalistInfectionCost(infectionType, infectionStage, playerLevel) {
  const base = { rot: 25, rabies: 45 }[infectionType] || 30;
  return Math.floor(base * playerLevel * (1 + infectionStage * 0.5));
}

// Human-readable wound label including location
function woundLabel(wound) {
  const sev  = SEVERITY_NAMES[wound.severity] || 'Wound';
  const type = wound.type === 'slash' ? 'Slash' : wound.type === 'crush' ? 'Crush' : 'Bite';
  const loc  = wound.location ? ` (${wound.location})` : '';
  return `${sev} — ${type}${loc} from ${wound.source}`;
}

// Human-readable infection label (5 stages, 0-4)
function infectionLabel(infectionType, infectionStage) {
  const stage = Math.min(4, Math.max(0, infectionStage || 0));
  const labels = {
    rot: [
      'Festering Wound — early (redness, warmth)',
      'Festering Wound — pus forming, fever begins',
      'Wound Fever — corruption spreading',
      'The Creeping Red — blood poisoning',
      'Blackened Flesh — gangrene (critical)',
    ],
    rabies: [
      'Beast-Sickness — bite fever',
      'Beast-Sickness — headache, light sensitivity',
      'Beast-Sickness — strange aggression',
      'Beast-Sickness — convulsions',
      'Beast-Sickness — madness (critical)',
    ],
    vampire_bite: [
      'Vampire Taint — fresh (cold wound)',
      'Vampire Taint — bloodthirst awakening',
      'Vampire Taint — physical changes beginning',
      'Vampire Taint — the hunger is overwhelming',
      'Vampire Taint — transformation imminent',
    ],
    werebat: [
      'Werebat Curse — two curses war in your blood',
      'Werebat Curse — fever, strange senses at night',
      'Werebat Curse — membranous patches appear on skin',
      'Werebat Curse — you flew last night (you remember it)',
      'Werebat Curse — transformation imminent',
    ],
    zombie: [
      'Zombie Plague — early taint',
      'Zombie Plague — spreading',
      'Zombie Plague — advanced',
      'Zombie Plague — severe',
      'Zombie Plague — terminal',
    ],
    vampire: [
      'Vampire (transformed)',
      'Vampire (transformed)',
      'Vampire (transformed)',
      'Vampire (transformed)',
      'Vampire (transformed)',
    ],
  };
  return (labels[infectionType] || [])[stage] || infectionType;
}

module.exports = {
  getMonsterFamily,
  getWoundType,
  getWoundSeverity,
  getWoundLocation,
  woundChance,
  parseWounds,
  getBleedDamage,
  getCrushDefPenalty,
  getLocationPenalties,
  hasSerious,
  hasCritical,
  getDirtyWeaponMod,
  rollInfection,
  resolveInfection,
  healerCanTreat,
  herbalistCanTreatWound,
  herbalistCanTreatInfection,
  healerWoundCost,
  healerInfectionCost,
  herbalistWoundCost,
  herbalistInfectionCost,
  woundLabel,
  infectionLabel,
};
