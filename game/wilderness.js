// Wilderness zones — one per town (Dawnmark uses the existing forest system)
// Monster format mirrors MONSTER_TEMPLATES: { name, weapon, behavior, strMult, hpMult, goldMult, expMult, meet, death }
// Names are chosen to match getMonsterArt() regex patterns — no new art needed.

const { getWorldState, setWorldState } = require('../db');

// ── Infestation cache ─────────────────────────────────────────────────────────
// When a named enemy spreads (7 days alive), adjacent town wilderness zones are
// marked as infested — a 30% chance to spawn that enemy's monster type instead.
let _infestations    = {};  // { townId: [{ enemyId, monsterName, level, templateIndex, expiresDay }] }
let _infLoadedDay    = -1;

async function loadInfestationsIfNeeded() {
  const today = Math.floor(Date.now() / 86400000);
  if (_infLoadedDay === today) return;
  const raw = await getWorldState('eco:infestations');
  _infestations = {};
  if (raw) {
    for (const [tid, list] of Object.entries(JSON.parse(raw))) {
      const active = list.filter(e => e.expiresDay > today);
      if (active.length) _infestations[tid] = active;
    }
  }
  _infLoadedDay = today;
}

async function clearEnemyInfestation(enemyId) {
  const raw = await getWorldState('eco:infestations');
  if (!raw) return;
  const parsed = JSON.parse(raw);
  let changed = false;
  for (const tid of Object.keys(parsed)) {
    const before = parsed[tid].length;
    parsed[tid] = parsed[tid].filter(e => e.enemyId !== enemyId);
    if (parsed[tid].length !== before) changed = true;
    if (!parsed[tid].length) delete parsed[tid];
  }
  if (changed) {
    await setWorldState('eco:infestations', JSON.stringify(parsed));
    _infLoadedDay = -1; // invalidate cache
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Base stat formula (same as getMonster in data.js)
// ─────────────────────────────────────────────────────────────────────────────
async function getWildernessMonster(townId, level, prestigeLevel = 0) {
  const zone = WILDERNESS_ZONES[townId];
  if (!zone) return null;

  const baseStr  = 10 + level * 8;
  const baseHp   = 20 + level * 15;
  const baseGold = 5  + level * 12;
  const baseExp  = 8  + level * 10;

  // 30% chance to spawn an infesting monster if this zone is affected
  await loadInfestationsIfNeeded();
  const today = Math.floor(Date.now() / 86400000);
  const active = (_infestations[townId] || []).filter(e => e.expiresDay > today);
  const scale = prestigeLevel > 0 ? 1 + prestigeLevel * 0.20 : 1;

  if (active.length && Math.random() < 0.30) {
    const inf = active[Math.floor(Math.random() * active.length)];
    const { getMonster } = require('./data');
    const base = getMonster(inf.level, inf.templateIndex);
    const str = Math.floor(baseStr * (base.strMult ?? 1.0) * 1.10 * scale);
    const hp  = Math.floor(baseHp  * (base.hpMult  ?? 1.0) * 1.10 * scale);
    return {
      name:     base.name,
      weapon:   base.weapon,
      behavior: base.behavior || 'normal',
      strength: str,
      hp, maxHp: hp, currentHp: hp,
      gold:     Math.floor(baseGold * (base.goldMult ?? 1.0) * 1.20),
      exp:      Math.floor(baseExp  * (base.expMult  ?? 1.0) * 1.20),
      meet:     `A \`@${base.name}\`% has been driven here from the distant wilds — fiercer than usual.`,
      death:    base.death,
    };
  }

  const t = zone.monsters[Math.floor(Math.random() * zone.monsters.length)];
  const str = Math.floor(baseStr * (t.strMult ?? 1.0) * scale);
  const hp  = Math.floor(baseHp  * (t.hpMult  ?? 1.0) * scale);

  return {
    name:      t.name,
    weapon:    t.weapon,
    behavior:  t.behavior || 'normal',
    strength:  str,
    hp, maxHp: hp, currentHp: hp,
    gold:      Math.floor(baseGold * (t.goldMult ?? 1.0)),
    exp:       Math.floor(baseExp  * (t.expMult  ?? 1.0)),
    meet:      t.meet,
    death:     t.death,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Wilderness zone definitions
// ─────────────────────────────────────────────────────────────────────────────
const WILDERNESS_ZONES = {

  // ── IRONHOLD — The Siege Fields ───────────────────────────────────────────
  // A battlefield that has never healed. Ancient war churns the earth still.
  ironhold: {
    name: 'The Siege Fields',
    tagline: 'Every hill is a grave. The war never truly ended.',
    hasDungeon: false,
    monsters: [
      {
        name: 'Siege Wraith', weapon: 'spectral blade',
        strMult: 1.1, hpMult: 0.8, goldMult: 1.2, expMult: 1.3,
        behavior: 'aggressive',
        meet:  'A spectral soldier in shattered armour lunges from the mud!',
        death: 'The siege wraith lets out a hollow wail and dissolves into mist.',
      },
      {
        name: 'Rusted Golem', weapon: 'iron fist',
        strMult: 0.9, hpMult: 2.0, goldMult: 0.8, expMult: 1.1,
        behavior: 'defensive',
        meet:  'A war-machine golem, ancient and corroded, grinds to life before you!',
        death: 'The rusted golem locks up mid-swing and crashes to the earth.',
      },
      {
        name: 'Bone Cavalry', weapon: 'spectral lance',
        strMult: 1.3, hpMult: 0.9, goldMult: 1.1, expMult: 1.2,
        behavior: 'aggressive',
        meet:  'A skeletal horseman bearing a lance of shadow charges from the treeline!',
        death: 'Horse and rider shatter in a spray of ancient bone.',
      },
      {
        name: 'Plague Warlock', weapon: 'bone staff',
        strMult: 1.2, hpMult: 0.7, goldMult: 1.5, expMult: 1.4,
        behavior: 'normal',
        meet:  'A battlefield warlock in rotting robes raises a staff carved from femurs!',
        death: 'The plague warlock collapses mid-incantation, curse unfinished.',
      },
      {
        name: 'Iron Guard', weapon: 'siege hammer',
        strMult: 1.0, hpMult: 1.3, goldMult: 1.0, expMult: 1.0,
        behavior: 'defensive',
        meet:  'A spectral iron guardsman takes a stance in your path, hammer raised!',
        death: 'The iron guard crumbles, finally at rest after centuries of vigil.',
      },
    ],
  },

  // ── GRAVEPORT — The Drowned Marsh ─────────────────────────────────────────
  // The harbour city's hinterland is waterlogged and haunted.
  graveport: {
    name: 'The Drowned Marsh',
    tagline: 'The dead make their home in the water. They do not drown.',
    hasDungeon: false,
    monsters: [
      {
        name: 'Drowned Revenant', weapon: 'barnacled fist',
        strMult: 1.0, hpMult: 1.1, goldMult: 1.0, expMult: 1.1,
        behavior: 'normal',
        meet:  'A bloated, waterlogged revenant lurches up from the bog, trailing weed!',
        death: 'The drowned revenant collapses with a wet gurgle back into the marsh.',
      },
      {
        name: 'Marsh Serpent', weapon: 'venomous bite',
        strMult: 1.1, hpMult: 1.0, goldMult: 0.9, expMult: 1.0,
        behavior: 'venomous',
        meet:  'A serpent the length of a ship\'s mast explodes from the brackish water!',
        death: 'The marsh serpent thrashes once and sinks back into the deep.',
      },
      {
        name: 'Ghost Captain', weapon: 'phantom cutlass',
        strMult: 1.3, hpMult: 0.7, goldMult: 1.8, expMult: 1.5,
        behavior: 'fleeing',
        meet:  'The ghost of a ship\'s captain materialises, fury burning where his eyes once were!',
        death: 'The ghost captain fades with a curse on his lips and a satisfied grin.',
      },
      {
        name: 'Bog Troll', weapon: 'mud-caked club',
        strMult: 1.1, hpMult: 1.8, goldMult: 0.7, expMult: 1.0,
        behavior: 'defensive',
        meet:  'Something vast and foul rises from the bog, trailing marsh gas and malice!',
        death: 'The bog troll topples face-first into the mud with an earthshaking crash.',
      },
      {
        name: 'Silt Fiend', weapon: 'crushing tentacle',
        strMult: 1.4, hpMult: 1.2, goldMult: 1.3, expMult: 1.4,
        behavior: 'aggressive',
        meet:  'The marsh surface erupts as a fiend of silt and shadow tears free!',
        death: 'The silt fiend dissolves back into the black water with a hiss.',
      },
    ],
  },

  // ── ASHENFALL — The Scorched Wastes ───────────────────────────────────────
  // Everything burned once. Some things are still burning.
  ashenfall: {
    name: 'The Scorched Wastes',
    tagline: 'The ash remembers everything that was once alive.',
    hasDungeon: false,
    monsters: [
      {
        name: 'Ash Wraith', weapon: 'cinder touch',
        strMult: 1.2, hpMult: 0.8, goldMult: 1.1, expMult: 1.3,
        behavior: 'aggressive',
        meet:  'A column of ash twists into humanoid form — a wraith born of the great burning!',
        death: 'The ash wraith collapses into a pile of cooling embers.',
      },
      {
        name: 'Ember Drake', weapon: 'fire breath',
        strMult: 1.5, hpMult: 1.1, goldMult: 1.4, expMult: 1.5,
        behavior: 'aggressive',
        meet:  'A drake the colour of molten rock launches from a ridge of scorched stone!',
        death: 'The ember drake crashes down, its fire guttering and gone.',
      },
      {
        name: 'Cinder Golem', weapon: 'molten fist',
        strMult: 0.9, hpMult: 2.2, goldMult: 0.8, expMult: 1.0,
        behavior: 'defensive',
        meet:  'A golem of fused ash and slag heaves itself upright from the waste!',
        death: 'The cinder golem shatters into a thousand fragments of cooling rock.',
      },
      {
        name: 'Flame Warlock', weapon: 'fire lance',
        strMult: 1.3, hpMult: 0.7, goldMult: 1.6, expMult: 1.5,
        behavior: 'normal',
        meet:  'A warlock in a coat of living flame steps from the heat shimmer!',
        death: 'The flame warlock burns out all at once — a candle snuffed by the wind.',
      },
      {
        name: 'Scorch Fiend', weapon: 'hellfire claw',
        strMult: 1.6, hpMult: 1.3, goldMult: 1.5, expMult: 1.6,
        behavior: 'aggressive',
        meet:  'The earth cracks open and a fiend of pure heat and spite claws its way out!',
        death: 'The scorch fiend is extinguished with a crack of thunder.',
      },
    ],
  },

  // ── FROSTMERE — The Frozen Tundra ─────────────────────────────────────────
  // The cold preserves things that should not be preserved.
  frostmere: {
    name: 'The Frozen Tundra',
    tagline: 'Isolation is the oldest survival strategy — and the coldest.',
    hasDungeon: false,
    monsters: [
      {
        name: 'Ice Wolf', weapon: 'frost bite',
        strMult: 1.0, hpMult: 0.9, goldMult: 0.8, expMult: 1.0,
        behavior: 'normal',
        meet:  'A wolf with pale blue fur and frost-breath stalks from the drifts!',
        death: 'The ice wolf collapses in a cascade of snow and silence.',
      },
      {
        name: 'Frost Giant', weapon: 'glacier fist',
        strMult: 1.3, hpMult: 2.5, goldMult: 1.5, expMult: 1.3,
        behavior: 'defensive',
        meet:  'A giant of ice and stone steps from behind a frozen ridge, blocking the sky!',
        death: 'The frost giant falls and shakes the tundra for a mile around.',
      },
      {
        name: 'Snow Wraith', weapon: 'frozen touch',
        strMult: 0.9, hpMult: 0.7, goldMult: 1.3, expMult: 1.2,
        behavior: 'fleeing',
        meet:  'A translucent wraith spun from blizzard and lost memory howls toward you!',
        death: 'The snow wraith disperses into the wind, finally at rest.',
      },
      {
        name: 'Glacier Troll', weapon: 'ice slab',
        strMult: 1.2, hpMult: 2.0, goldMult: 1.0, expMult: 1.1,
        behavior: 'defensive',
        meet:  'A troll the colour of glacial ice emerges from a crevasse, hungry and vast!',
        death: 'The glacier troll cracks clean through and topples into the snow.',
      },
      {
        name: 'Winter Witch', weapon: 'frost bolt',
        strMult: 1.4, hpMult: 0.8, goldMult: 1.7, expMult: 1.6,
        behavior: 'aggressive',
        meet:  'A witch borne aloft on a column of frozen air descends with murder in her eyes!',
        death: 'The winter witch shatters into a spray of ice crystals and is gone.',
      },
    ],
  },

  // ── SILVERKEEP — The Temple Crypts ────────────────────────────────────────
  // The city of justice has old bones beneath it. They are restless.
  silverkeep: {
    name: 'The Temple Crypts',
    tagline: 'Justice is absolute. But the dead have their own kind of justice.',
    hasDungeon: false,
    monsters: [
      {
        name: 'Fallen Templar', weapon: 'cursed sword',
        strMult: 1.2, hpMult: 1.1, goldMult: 1.3, expMult: 1.2,
        behavior: 'aggressive',
        meet:  'A templar in blackened armour turns a hollow gaze on you — judgement without mercy!',
        death: 'The fallen templar collapses, armour clanging, the curse finally broken.',
      },
      {
        name: 'Crypt Shade', weapon: 'shadow strike',
        strMult: 1.1, hpMult: 0.7, goldMult: 1.4, expMult: 1.3,
        behavior: 'fleeing',
        meet:  'A shade slides from between the crypt stones, drawn by the warmth of your blood!',
        death: 'The crypt shade unravels like smoke in a high wind.',
      },
      {
        name: 'Stone Construct', weapon: 'stone fist',
        strMult: 0.9, hpMult: 2.0, goldMult: 0.7, expMult: 0.9,
        behavior: 'defensive',
        meet:  'A temple guardian construct stirs from centuries of stillness, eyes blazing!',
        death: 'The stone construct winds down and collapses — its charge is done.',
      },
      {
        name: 'Corrupt Paladin', weapon: 'defiled mace',
        strMult: 1.3, hpMult: 1.2, goldMult: 1.5, expMult: 1.4,
        behavior: 'normal',
        meet:  'A paladin, hollow-eyed and twisted, raises a mace that drips black ichor!',
        death: 'The corrupt paladin falls and the black light fades from their armour.',
      },
      {
        name: 'Tomb Revenant', weapon: 'grave touch',
        strMult: 1.0, hpMult: 1.4, goldMult: 1.1, expMult: 1.1,
        behavior: 'normal',
        meet:  'A revenant claws its way through the crypt floor, screaming without a mouth!',
        death: 'The tomb revenant crumbles to dust mid-scream — finally silenced.',
      },
    ],
  },

  // ── THORNREACH — The Ancient Wilds ────────────────────────────────────────
  // The forest around Thornreach is older than memory. It has teeth.
  thornreach: {
    name: 'The Ancient Wilds',
    tagline: 'The forest does not forgive those who ignore it.',
    hasDungeon: false,
    monsters: [
      {
        name: 'Wild Hunter', weapon: 'bone-tipped spear',
        strMult: 1.1, hpMult: 0.9, goldMult: 1.0, expMult: 1.1,
        behavior: 'normal',
        meet:  'A hunter in bark armour drops from the canopy, spear levelled at your throat!',
        death: 'The wild hunter falls and the forest goes utterly silent.',
      },
      {
        name: 'Fae Sprite', weapon: 'glamour bolt',
        strMult: 1.4, hpMult: 0.5, goldMult: 2.0, expMult: 1.6,
        behavior: 'fleeing',
        meet:  'A sprite the size of a cat appears — and fires a bolt of raw glamour at your face!',
        death: 'The fae sprite winks out like a candle, taking its glamour with it.',
      },
      {
        name: 'Thornback Bear', weapon: 'bone-shard claw',
        strMult: 1.3, hpMult: 1.6, goldMult: 1.0, expMult: 1.2,
        behavior: 'aggressive',
        meet:  'A bear covered in bone-white thorns rises on its hind legs with a earth-shaking roar!',
        death: 'The thornback bear crashes down, thorns and all.',
      },
      {
        name: 'Forest Titan', weapon: 'root lash',
        strMult: 1.0, hpMult: 2.8, goldMult: 0.8, expMult: 1.2,
        behavior: 'defensive',
        meet:  'The trees part and a titan woven from living wood and ancient anger steps through!',
        death: 'The forest titan cracks from crown to root and goes still.',
      },
      {
        name: 'Shadow Wraith', weapon: 'void touch',
        strMult: 1.2, hpMult: 0.8, goldMult: 1.5, expMult: 1.4,
        behavior: 'aggressive',
        meet:  'A wraith of pure forest shadow lunges from between the roots!',
        death: 'The shadow wraith dissolves as dawn light finds it through the canopy.',
      },
    ],
  },

  // ── STORMWATCH — The Arcane Wastes ────────────────────────────────────────
  // Reality bends here. Some constructs have been running since the age of sorcerers.
  stormwatch: {
    name: 'The Arcane Wastes',
    tagline: 'Reality bends here. The constructs bend with it.',
    hasDungeon: false,
    monsters: [
      {
        name: 'Rogue Construct', weapon: 'arcane fist',
        strMult: 1.0, hpMult: 1.8, goldMult: 0.9, expMult: 1.0,
        behavior: 'defensive',
        meet:  'A construct of crystal and metal, purpose-forgotten, turns its empty gaze on you!',
        death: 'The rogue construct powers down with a whine of failing crystals.',
      },
      {
        name: 'Arcane Revenant', weapon: 'mana burn',
        strMult: 1.2, hpMult: 1.0, goldMult: 1.3, expMult: 1.3,
        behavior: 'normal',
        meet:  'The revenant of a dead mage crackles with residual arcane power — and rage!',
        death: 'The arcane revenant dissipates in a burst of uncontrolled magic.',
      },
      {
        name: 'Spell Wraith', weapon: 'arcane bolt',
        strMult: 1.5, hpMult: 0.7, goldMult: 1.6, expMult: 1.5,
        behavior: 'aggressive',
        meet:  'A wraith composed entirely of raw magic hurls itself at you in a cascade of light!',
        death: 'The spell wraith detonates with a crack that rattles the air for miles.',
      },
      {
        name: 'Mana Golem', weapon: 'arcane slam',
        strMult: 1.1, hpMult: 2.2, goldMult: 1.0, expMult: 1.1,
        behavior: 'defensive',
        meet:  'A golem built from crystallised mana lurches toward you, radiating deadly power!',
        death: 'The mana golem overloads and shatters — and the air smells of lightning for hours.',
      },
      {
        name: 'Chaos Demon', weapon: 'reality tear',
        strMult: 1.6, hpMult: 1.3, goldMult: 1.8, expMult: 1.7,
        behavior: 'aggressive',
        meet:  'Reality unzips and a demon of pure chaos reaches through to take a swing at you!',
        death: 'The chaos demon is banished as the tear seals behind it.',
      },
    ],
  },

  // ── DUSKVEIL — The Shadow Alleys ──────────────────────────────────────────
  // The city's underworld bleeds into the alleyways beyond the walls.
  duskveil: {
    name: 'The Shadow Alleys',
    tagline: 'Some cities have a criminal underworld. Duskveil is one.',
    hasDungeon: false,
    monsters: [
      {
        name: 'Guild Enforcer', weapon: 'blackjack',
        strMult: 1.1, hpMult: 1.0, goldMult: 1.2, expMult: 1.0,
        behavior: 'aggressive',
        meet:  'A guild enforcer the size of a small ox steps from the shadows, cracking knuckles!',
        death: 'The guild enforcer goes down hard and doesn\'t get back up.',
      },
      {
        name: 'Shadow Phantom', weapon: 'dark blade',
        strMult: 1.3, hpMult: 0.8, goldMult: 1.5, expMult: 1.3,
        behavior: 'fleeing',
        meet:  'A phantom of shadow and knifework emerges from a pool of darkness!',
        death: 'The shadow phantom fragments and is gone, leaving only a cold feeling.',
      },
      {
        name: 'Crime Lord', weapon: 'poisoned ring',
        strMult: 1.0, hpMult: 1.5, goldMult: 2.0, expMult: 1.5,
        behavior: 'defensive',
        meet:  'A crime lord with three bodyguards (already dealt with) steps forward personally!',
        death: 'The crime lord drops and his gold falls with him. Yours now.',
      },
      {
        name: 'Guild Rogue', weapon: 'throwing knives',
        strMult: 1.4, hpMult: 0.7, goldMult: 1.3, expMult: 1.4,
        behavior: 'fleeing',
        meet:  'A guild rogue hurls a fan of knives from a rooftop and drops to face you!',
        death: 'The guild rogue miscalculates the drop on his last retreat. Fatally.',
      },
      {
        name: 'Shade Phantom', weapon: 'void slash',
        strMult: 1.5, hpMult: 0.9, goldMult: 1.6, expMult: 1.5,
        behavior: 'aggressive',
        meet:  'A phantom of the void itself surges from the shadows — this was not a normal alley!',
        death: 'The shade phantom collapses as the void reclaims it.',
      },
    ],
  },

  // ── OLD KARTH — The Buried Ruins ──────────────────────────────────────────
  // What was buried here should have stayed buried.
  old_karth: {
    name: 'The Buried Ruins',
    tagline: 'What was buried here should have stayed buried.',
    hasDungeon: true,
    dungeonId: 'old_karth_mines',
    dungeonName: 'The Old Karth Mines',
    monsters: [
      {
        name: 'Grave Guardian', weapon: 'burial axe',
        strMult: 1.1, hpMult: 1.5, goldMult: 1.2, expMult: 1.1,
        behavior: 'defensive',
        meet:  'A guardian carved from funeral stone heaves to life between you and the ruins!',
        death: 'The grave guardian settles back to earth, its ward broken.',
      },
      {
        name: 'Ancient Revenant', weapon: 'plague touch',
        strMult: 1.3, hpMult: 1.2, goldMult: 1.4, expMult: 1.4,
        behavior: 'aggressive',
        meet:  'An ancient revenant in ceremonial robes claws up from the earth screaming!',
        death: 'The ancient revenant crumbles — centuries of unrest finally ended.',
      },
      {
        name: 'Ruin Golem', weapon: 'stone fist',
        strMult: 0.8, hpMult: 2.4, goldMult: 0.7, expMult: 1.0,
        behavior: 'defensive',
        meet:  'A golem assembled from rubble and old iron lurches toward you through the ruins!',
        death: 'The ruin golem collapses into a pile of component stones.',
      },
      {
        name: 'Buried Warlock', weapon: 'death curse',
        strMult: 1.4, hpMult: 0.8, goldMult: 1.7, expMult: 1.5,
        behavior: 'normal',
        meet:  'A warlock, sealed in stone for centuries, tears free and raises both hands!',
        death: 'The buried warlock\'s curse dies with him. Finally.',
      },
      {
        name: 'Lich Acolyte', weapon: 'necrotic bolt',
        strMult: 1.2, hpMult: 1.0, goldMult: 1.5, expMult: 1.3,
        behavior: 'normal',
        meet:  'A lich\'s acolyte — failed undead, half-mad — lurches from the shadows!',
        death: 'The lich acolyte falls apart, the dark binding finally dissolved.',
      },
    ],
  },

  // ── VELMORA — The Merchant Wastes ─────────────────────────────────────────
  // Beyond the pleasure city, the roads are lawless and the djinn are angry.
  velmora: {
    name: 'The Merchant Wastes',
    tagline: 'Beyond the walls, commerce becomes something more dangerous.',
    hasDungeon: false,
    monsters: [
      {
        name: 'Road Bandit', weapon: 'rusty blade',
        strMult: 0.9, hpMult: 0.9, goldMult: 1.4, expMult: 0.9,
        behavior: 'normal',
        meet:  'A road bandit in mismatched armour steps into your path with demands and a blade!',
        death: 'The road bandit goes down in the dust of the merchant road.',
      },
      {
        name: 'Djinn Wraith', weapon: 'wish-burn',
        strMult: 1.4, hpMult: 1.0, goldMult: 1.7, expMult: 1.6,
        behavior: 'aggressive',
        meet:  'An angry djinn, cheated of its due, takes a wraith-form and comes screaming!',
        death: 'The djinn wraith is banished back to whatever lamp it escaped from.',
      },
      {
        name: 'Dust Demon', weapon: 'sandstorm claw',
        strMult: 1.3, hpMult: 1.1, goldMult: 1.3, expMult: 1.3,
        behavior: 'aggressive',
        meet:  'The desert air condenses into a demon of dust and spite!',
        death: 'The dust demon disperses on the wind — a bad dream, nothing more.',
      },
      {
        name: 'Road Phantom', weapon: 'mirage strike',
        strMult: 1.2, hpMult: 0.8, goldMult: 1.5, expMult: 1.4,
        behavior: 'fleeing',
        meet:  'A phantom of the road — a dead merchant, maybe — steps from a heat mirage!',
        death: 'The road phantom fades like a mirage at midday.',
      },
      {
        name: 'Silk Serpent', weapon: 'constrict',
        strMult: 1.1, hpMult: 1.4, goldMult: 1.2, expMult: 1.2,
        behavior: 'venomous',
        meet:  'A massive serpent draped in stolen silk uncoils from a merchant wagon!',
        death: 'The silk serpent uncoils and lies still. The silk is yours.',
      },
    ],
  },

  // ── BRACKEN HOLLOW — The Barrowfields ────────────────────────────────────
  // The old burial grounds around the village have never been completely at rest.
  bracken_hollow: {
    name: 'The Barrowfields',
    tagline: 'The old dead lie here. Some of them are not patient.',
    hasDungeon: false,
    monsters: [
      {
        name: 'Barrow Wight', weapon: 'cold grasp',
        strMult: 1.1, hpMult: 1.0, goldMult: 1.1, expMult: 1.1,
        behavior: 'normal',
        meet:  'A wight claws free of a barrow mound, grave-dirt showering from its shoulders!',
        death: 'The barrow wight collapses back into its mound at last.',
      },
      {
        name: 'Field Wraith', weapon: 'despair touch',
        strMult: 1.0, hpMult: 0.7, goldMult: 1.3, expMult: 1.2,
        behavior: 'fleeing',
        meet:  'A wraith drifts across the barrow fields toward you, trailing grief!',
        death: 'The field wraith dissipates with a sigh that sounds like relief.',
      },
      {
        name: 'Grave Robber', weapon: 'stolen blade',
        strMult: 1.0, hpMult: 0.9, goldMult: 1.6, expMult: 1.0,
        behavior: 'fleeing',
        meet:  'A grave robber caught in the act draws a very nice stolen sword and charges!',
        death: 'The grave robber drops everything — including the loot. All yours.',
      },
      {
        name: 'Pack Wolf', weapon: 'pack bite',
        strMult: 1.2, hpMult: 1.0, goldMult: 0.8, expMult: 1.0,
        behavior: 'venomous',
        meet:  'The pack alpha breaks from the barrow mist, and the rest are close behind!',
        death: 'The pack wolf falls and the howling stops — for now.',
      },
      {
        name: 'Barrow Troll', weapon: 'grave slab',
        strMult: 1.1, hpMult: 1.9, goldMult: 1.0, expMult: 1.0,
        behavior: 'defensive',
        meet:  'A troll that uses a barrow stone as a shield heaves itself into your path!',
        death: 'The barrow troll topples the grave marker it used as a shield onto itself.',
      },
    ],
  },

  // ── MIREFEN — The Bog ─────────────────────────────────────────────────────
  // The swamp takes what it wants. And it keeps it.
  mirefen: {
    name: 'The Bog',
    tagline: 'The swamp takes what it wants. And it keeps it.',
    hasDungeon: true,
    dungeonId: 'mirefen_caverns',
    dungeonName: 'The Mirefen Caverns',
    monsters: [
      {
        name: 'Bog Witch', weapon: 'hex bolt',
        strMult: 1.3, hpMult: 0.9, goldMult: 1.6, expMult: 1.5,
        behavior: 'aggressive',
        meet:  'A bog witch steps from the fog on stilts of living wood, hex already forming!',
        death: 'The bog witch sinks back into the swamp with an expression of profound irritation.',
      },
      {
        name: 'Swamp Troll', weapon: 'bog club',
        strMult: 1.1, hpMult: 2.0, goldMult: 0.8, expMult: 1.0,
        behavior: 'defensive',
        meet:  'A troll the colour of rotten moss heaves itself from the swamp, club first!',
        death: 'The swamp troll sinks back into the bog from whence it came.',
      },
      {
        name: 'Bog Wraith', weapon: 'miasma grasp',
        strMult: 1.0, hpMult: 0.8, goldMult: 1.2, expMult: 1.2,
        behavior: 'fleeing',
        meet:  'A wraith of rot and swamp-mist congeals from the fog before you!',
        death: 'The bog wraith unravels, and the smell fades soon after.',
      },
      {
        name: 'Mire Serpent', weapon: 'poisoned fang',
        strMult: 1.2, hpMult: 1.3, goldMult: 1.0, expMult: 1.1,
        behavior: 'venomous',
        meet:  'A serpent thicker than your torso coils from the black water!',
        death: 'The mire serpent thrashes once and slides back into the deep.',
      },
      {
        name: 'Swamp Giant', weapon: 'tree trunk',
        strMult: 1.4, hpMult: 2.3, goldMult: 1.1, expMult: 1.3,
        behavior: 'defensive',
        meet:  'A giant draped in swamp moss rises from the bog, casually holding a tree!',
        death: 'The swamp giant sways and topples, taking the tree with it.',
      },
    ],
  },

};

// Towns with no wilderness (Dawnmark uses existing forest system)
const WILDERNESS_NONE = new Set(['dawnmark']);

module.exports = { WILDERNESS_ZONES, WILDERNESS_NONE, getWildernessMonster, clearEnemyInfestation };
