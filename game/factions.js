// Faction system for Scales of Tears

const FACTIONS = {
  knights: {
    id: 'knights',
    name: 'Knights of Silverkeep',
    shortName: 'Knights',
    homeTown: 'silverkeep',
    houseName: "The Knight's Bastion",
    repColumn: 'rep_knights',
    houseKeeper: 'Commander Aldric Vale',
    welcomePositive: '"The realm needs warriors of honour. You have proven yourself."',
    welcomeNeutral:  '"Stand tall. Show us your worth and Silverkeep\'s gates open wider."',
    welcomeNegative: '"Your reputation precedes you. Not favourably."',
    assassinName: 'Silverkeep Inquisitor',
    assassinWeapon: 'a blessed longsword',
  },
  guild: {
    id: 'guild',
    name: "Thieves' Guild",
    shortName: "Thieves' Guild",
    homeTown: 'duskveil',
    houseName: 'The Shadowhouse',
    repColumn: 'rep_guild',
    houseKeeper: 'The Underboss',
    welcomePositive: '"You\'ve earned the Guild\'s trust. Don\'t waste it."',
    welcomeNeutral:  '"Prove your worth and we\'ll have work for you."',
    welcomeNegative: '"You\'ve made enemies here. Tread carefully."',
    assassinName: 'Guild Silencer',
    assassinWeapon: 'a poisoned blade',
  },
  druids: {
    id: 'druids',
    name: 'Druid Circle',
    shortName: 'Druid Circle',
    homeTown: 'thornreach',
    houseName: 'The Sacred Circle',
    repColumn: 'rep_druids',
    houseKeeper: 'Elder Mosswhisper',
    welcomePositive: '"The forest speaks well of you, traveller."',
    welcomeNeutral:  '"Walk gently. The Circle watches all who pass through."',
    welcomeNegative: '"You have wounded the forest. The Circle does not forget."',
    assassinName: 'Thornreach Avenger',
    assassinWeapon: 'a twisted thornwood staff',
  },
  necromancers: {
    id: 'necromancers',
    name: "Necromancers' Conclave",
    shortName: 'Conclave',
    homeTown: 'graveport',
    houseName: 'The Conclave Vault',
    repColumn: 'rep_necromancers',
    houseKeeper: 'Archmagus Dreveth',
    welcomePositive: '"Death is merely a doorway. You understand this."',
    welcomeNeutral:  '"We deal in secrets. Come back when you have something to offer."',
    welcomeNegative: '"You have made an enemy of death itself. Unwise."',
    assassinName: 'Conclave Shade',
    assassinWeapon: 'a soul-draining dagger',
  },
  merchants: {
    id: 'merchants',
    name: "Merchants' League",
    shortName: "Merchants' League",
    homeTown: 'velmora',
    houseName: 'The League Hall',
    repColumn: 'rep_merchants',
    houseKeeper: 'Guildmaster Tessara',
    welcomePositive: '"Profit and partnership. You understand the League\'s way."',
    welcomeNeutral:  '"Gold opens doors. Bring us enough and we\'ll open ours."',
    welcomeNegative: '"You\'ve cost us money. That is unforgivable."',
    assassinName: 'League Enforcer',
    assassinWeapon: 'a weighted cudgel',
  },
};

// Starting rep bonuses by class (designed to be extended as class system grows)
const CLASS_STARTING_REP = {
  1:  { necromancers: 10, knights: -5 },           // Dread Knight — dark arts, distrusted by Knights
  2:  { knights: 10 },                             // Warrior — lawful fighter, Knights approve
  3:  { guild: 10, merchants: -5 },                // Rogue — Guild connected, League distrusts
  4:  { necromancers: 5, druids: 5 },              // Mage — arcane straddles nature and darkness
  5:  { druids: 10 },                              // Ranger — deep forest bond with Druid Circle
  6:  { knights: 15, necromancers: -10 },          // Paladin — holy warrior, anathema to Conclave
  7:  { druids: 15 },                              // Druid — obvious
  8:  { necromancers: 15, knights: -10 },          // Necromancer — Conclave ally, Knight enemy
  9:  { necromancers: 5 },                         // Elementalist — arcane, leans toward Conclave
  10: {},                                          // Monk — spiritual neutrality, no faction ties
};

function getFactionRep(player, factionId) {
  const faction = FACTIONS[factionId];
  if (!faction) return 0;
  return player[faction.repColumn] || 0;
}

// Returns a partial update object with the new rep value clamped to [-100, 100]
function adjustRep(player, factionId, delta) {
  const faction = FACTIONS[factionId];
  if (!faction) return {};
  const current = getFactionRep(player, factionId);
  return { [faction.repColumn]: Math.max(-100, Math.min(100, current + delta)) };
}

// Apply multiple rep adjustments at once, returns merged update object
function adjustReps(player, adjustments) {
  return Object.entries(adjustments).reduce((acc, [id, delta]) => {
    return Object.assign(acc, adjustRep(player, id, delta));
  }, {});
}

function getRepLabel(score) {
  if (score >= 75)  return 'Exalted';
  if (score >= 50)  return 'Allied';
  if (score >= 25)  return 'Friendly';
  if (score >= -24) return 'Neutral';
  if (score >= -49) return 'Unfriendly';
  if (score >= -74) return 'Hostile';
  return 'Nemesis';
}

// Returns factions where player rep is <= -75 (assassins sent)
function getHostileFactions(player) {
  return Object.values(FACTIONS).filter(f => getFactionRep(player, f.id) <= -75);
}

// Returns factions where player rep is <= -50 (shops refuse)
function getRefusingFactions(player) {
  return Object.values(FACTIONS).filter(f => getFactionRep(player, f.id) <= -50);
}

// Is the player refused service by a shopkeeper with this faction allegiance?
function isRefused(player, factionId) {
  if (!factionId) return false;
  return getFactionRep(player, factionId) <= -50;
}

// Generate an assassin monster object scaled to player level
function makeAssassin(faction, playerLevel) {
  return {
    name: faction.assassinName,
    weapon: faction.assassinWeapon,
    strength: Math.floor(playerLevel * 14 * 1.25),
    defense: Math.floor(playerLevel * 6 * 1.1),
    maxHp: Math.floor(playerLevel * 22 * 1.3),
    currentHp: Math.floor(playerLevel * 22 * 1.3),
    gold: playerLevel * 60,
    exp: 0,
    behavior: 'aggressive',
    meet: `A ${faction.assassinName} steps from the shadows. "This ends here."`,
    factionId: faction.id,
    isAssassin: true,
  };
}

// Mutates FACTIONS and CLASS_STARTING_REP in-place from DB rows (called at startup and after admin edits)
function loadFactionsData({ factions, classReps }) {
  for (const k of Object.keys(FACTIONS)) delete FACTIONS[k];
  for (const k of Object.keys(CLASS_STARTING_REP)) delete CLASS_STARTING_REP[k];
  for (const f of factions) {
    FACTIONS[f.id] = {
      id: f.id,
      name: f.name,
      shortName: f.short_name,
      homeTown: f.home_town,
      houseName: f.house_name,
      houseKeeper: f.house_keeper,
      repColumn: f.rep_column,
      welcomePositive: f.welcome_positive,
      welcomeNeutral: f.welcome_neutral,
      welcomeNegative: f.welcome_negative,
      assassinName: f.assassin_name,
      assassinWeapon: f.assassin_weapon,
    };
  }
  for (const row of classReps) {
    if (!CLASS_STARTING_REP[row.class_num]) CLASS_STARTING_REP[row.class_num] = {};
    if (row.rep_delta !== 0) CLASS_STARTING_REP[row.class_num][row.faction_id] = row.rep_delta;
  }
}

// Returns DB update object for starting rep based on class
function getStartingRepUpdates(cls) {
  const bonuses = CLASS_STARTING_REP[cls] || {};
  return Object.entries(bonuses).reduce((acc, [factionId, delta]) => {
    const faction = FACTIONS[factionId];
    if (faction) acc[faction.repColumn] = delta;
    return acc;
  }, {});
}

module.exports = {
  FACTIONS,
  CLASS_STARTING_REP,
  loadFactionsData,
  getFactionRep,
  adjustRep,
  adjustReps,
  getRepLabel,
  getHostileFactions,
  getRefusingFactions,
  isRefused,
  makeAssassin,
  getStartingRepUpdates,
};
