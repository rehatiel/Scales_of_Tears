// Static game data for SoT

const WEAPONS = [
  null,
  { num: 1,  name: 'Stick',           price: 200,        strength: 5,    tier: 1  },
  { num: 2,  name: 'Dagger',          price: 1000,       strength: 10,   tier: 2  },
  { num: 3,  name: 'Short Sword',     price: 3000,       strength: 20,   tier: 3  },
  { num: 4,  name: 'Long Sword',      price: 10000,      strength: 30,   tier: 4  },
  { num: 5,  name: 'Huge Axe',        price: 30000,      strength: 40,   tier: 5  },
  { num: 6,  name: 'Bone Cruncher',   price: 100000,     strength: 60,   tier: 6  },
  { num: 7,  name: 'Twin Swords',     price: 150000,     strength: 80,   tier: 7  },
  { num: 8,  name: 'Power Axe',       price: 200000,     strength: 120,  tier: 8  },
  { num: 9,  name: "Able's Sword",    price: 400000,     strength: 180,  tier: 9  },
  { num: 10, name: "Wan's Weapon",    price: 1000000,    strength: 250,  tier: 10 },
  { num: 11, name: 'Spear Of Gold',   price: 4000000,    strength: 350,  tier: 11 },
  { num: 12, name: 'Crystal Shard',   price: 10000000,   strength: 500,  tier: 12 },
  { num: 13, name: "Nira's Teeth",    price: 40000000,   strength: 800,  tier: 13 },
  { num: 14, name: 'Blood Sword',     price: 100000000,  strength: 1200, tier: 14 },
  { num: 15, name: 'Death Sword',     price: 400000000,  strength: 1800, tier: 15 },
  { num: 16, name: 'Hunting Spear',   price: 3200,       strength: 17,   tier: 3,  bonus: 'flee_bonus',    bonusDesc: 'Lightweight — +8% flee chance' },
  { num: 17, name: 'War Mace',        price: 9800,       strength: 28,   tier: 4,  bonus: 'stun',          bonusDesc: '12% chance to stun foe for one round' },
  { num: 18, name: 'Battlehammer',    price: 29000,      strength: 35,   tier: 5,  bonus: 'armor_pierce',  bonusDesc: 'Ignores 30% of enemy armor' },
  { num: 19, name: 'Twin Daggers',    price: 95000,      strength: 55,   tier: 6,  bonus: 'double_strike', bonusDesc: '20% chance to strike twice' },
];

const ARMORS = [
  null,
  { num: 1,  name: 'Coat',             price: 200,        defense: 1,    tier: 1  },
  { num: 2,  name: 'Heavy Coat',       price: 1000,       defense: 3,    tier: 2  },
  { num: 3,  name: 'Leather Vest',     price: 3000,       defense: 10,   tier: 3  },
  { num: 4,  name: 'Bronze Armour',    price: 10000,      defense: 15,   tier: 4  },
  { num: 5,  name: 'Iron Armour',      price: 30000,      defense: 25,   tier: 5  },
  { num: 6,  name: 'Graphite Armour',  price: 100000,     defense: 35,   tier: 6  },
  { num: 7,  name: "Erdrick's Armour", price: 150000,     defense: 50,   tier: 7  },
  { num: 8,  name: 'Armour Of Death',  price: 200000,     defense: 75,   tier: 8  },
  { num: 9,  name: "Able's Armour",    price: 400000,     defense: 100,  tier: 9  },
  { num: 10, name: 'Full Body Armour', price: 1000000,    defense: 150,  tier: 10 },
  { num: 11, name: 'Blood Armour',     price: 4000000,    defense: 225,  tier: 11 },
  { num: 12, name: 'Magic Protection', price: 10000000,   defense: 300,  tier: 12 },
  { num: 13, name: "Belar's Mail",     price: 40000000,   defense: 400,  tier: 13 },
  { num: 14, name: 'Golden Armour',    price: 100000000,  defense: 600,  tier: 14 },
  { num: 15, name: 'Armour Of Lore',   price: 400000000,  defense: 1000, tier: 15 },
  { num: 16, name: 'Scale Mail',       price: 3200,       defense: 8,    tier: 3,  bonus: 'poison_resist', bonusDesc: '50% chance to resist poison' },
  { num: 17, name: 'Padded Armour',    price: 9500,       defense: 12,   tier: 4,  bonus: 'regen',         bonusDesc: 'Recover 2 HP per combat round' },
  { num: 18, name: 'Studded Leather',  price: 28000,      defense: 22,   tier: 5,  bonus: 'evasion',       bonusDesc: '15% chance to evade monster attack' },
  { num: 19, name: 'Battle Plate',     price: 95000,      defense: 32,   tier: 6,  bonus: 'thorns',        bonusDesc: 'Reflect 10 damage to attacker per hit' },
];

// 11 monsters per level, 12 levels of play.
// meet   = dramatic first-encounter line
// death  = power-move kill flavour text
// strMult/hpMult/goldMult/expMult scale the base stats for that level
const MONSTER_TEMPLATES = [
  // ── Level 1 ──────────────────────────────────────────────────────────────
  [
    { name: 'Forest Sprite',   weapon: 'tiny claws',       strMult:0.5, hpMult:0.6, goldMult:0.8, expMult:0.8, behavior: 'fleeing',
      meet:  'A Forest Sprite darts from the shadows, claws crackling with dark energy!',
      death: 'The sprite bursts into a shower of coloured sparks!' },
    { name: 'Giant Rat',       weapon: 'sharp teeth',      strMult:0.6, hpMult:0.7, goldMult:0.7, expMult:0.7,
      meet:  'An enormous yellow-eyed Giant Rat erupts from the undergrowth, teeth snapping!',
      death: 'The rat lets out one final squeal and goes still!' },
    { name: 'Cave Goblin',     weapon: 'crude club',       strMult:0.8, hpMult:0.9, goldMult:1.0, expMult:1.0,
      meet:  'A Cave Goblin drops from the branches above with a blood-curdling shriek!',
      death: 'The goblin crumples to the earth with a satisfying thud!' },
    { name: 'Rabid Dog',       weapon: 'vicious bite',     strMult:0.7, hpMult:0.8, goldMult:0.6, expMult:0.8, behavior: 'aggressive',
      meet:  'A foam-mouthed Rabid Dog charges straight for your throat!',
      death: 'The dog yelps once and collapses in a heap!' },
    { name: 'Zombie',          weapon: 'rotting claws',    strMult:0.9, hpMult:1.2, goldMult:0.9, expMult:1.1,
      meet:  'A Zombie hauls itself out of the rotting leaves and staggers toward you!',
      death: 'The zombie finally, mercifully, stays dead!' },
    { name: 'Wild Boar',       weapon: 'razor tusks',      strMult:1.0, hpMult:1.1, goldMult:0.8, expMult:1.0, behavior: 'aggressive',
      meet:  'A Wild Boar crashes through the bushes, razor tusks gleaming and aimed at you!',
      death: 'The boar squeals, tumbles, and lies still!' },
    { name: 'Dark Fairy',      weapon: 'poison barb',      strMult:0.7, hpMult:0.6, goldMult:1.2, expMult:1.2, behavior: 'venomous',
      meet:  'A Dark Fairy materialises in a burst of black sparks, grinning with wicked intent!',
      death: 'The dark fairy shrieks and dissolves into smoke and shadow!' },
    { name: 'Skeleton',        weapon: 'bone sword',       strMult:0.9, hpMult:0.9, goldMult:0.9, expMult:0.9,
      meet:  'Bones scatter and reassemble — a Skeleton lurches upright and raises its sword!',
      death: 'The skeleton shatters into a pile of harmless bones!' },
    { name: 'Slime Monster',   weapon: 'acidic touch',     strMult:0.4, hpMult:1.5, goldMult:0.5, expMult:0.7, behavior: 'venomous',
      meet:  'The ground bubbles and heaves as a Slime Monster oozes hungrily toward you!',
      death: 'The slime splashes apart with a nauseating wet sound!' },
    { name: 'Lost Beggar',     weapon: 'broken bottle',    strMult:0.6, hpMult:0.7, goldMult:0.4, expMult:0.6, behavior: 'fleeing',
      meet:  'A wild-eyed Beggar leaps from the shadows, clutching a jagged bottle!',
      death: 'The beggar collapses face-first and does not rise!' },
    { name: 'Wererat',         weapon: 'filthy claws',     strMult:1.1, hpMult:1.0, goldMult:1.1, expMult:1.3,
      meet:  'A hunched figure shudders and transforms horribly into a Wererat — then lunges!',
      death: 'The wererat transforms back into a very dead man!' },
  ],
  // ── Level 2 ──────────────────────────────────────────────────────────────
  [
    { name: 'Orc Warrior',     weapon: 'jagged axe',       strMult:0.9, hpMult:1.0, goldMult:1.0, expMult:1.0,
      meet:  'An Orc Warrior steps from behind a gnarled oak, war axe already raised!',
      death: 'The orc gurgles, drops its axe, and falls!' },
    { name: 'Harpy',           weapon: 'razor talons',     strMult:0.8, hpMult:0.8, goldMult:1.1, expMult:1.1, behavior: 'fleeing',
      meet:  'A Harpy dives from the canopy with a screech that shakes the very leaves!',
      death: 'The harpy plummets from the air, dead before it hits the ground!' },
    { name: 'Bandit',          weapon: 'short sword',      strMult:1.0, hpMult:0.9, goldMult:1.5, expMult:1.0, behavior: 'fleeing',
      meet:  '"Your gold or your life!" A scarred Bandit steps onto the path, blade drawn.',
      death: 'The bandit clutches his chest and crumples to the forest floor!' },
    { name: 'Lizard Man',      weapon: 'stone spear',      strMult:0.9, hpMult:1.1, goldMult:0.9, expMult:0.9,
      meet:  'A Lizard Man rises from the swamp mud, hissing, spear leveled at your chest!',
      death: 'The lizard man hisses its last rattling breath!' },
    { name: 'Ghoul',           weapon: 'paralyzing touch', strMult:1.0, hpMult:1.2, goldMult:0.8, expMult:1.2,
      meet:  'A Ghoul lurches from an open grave, its paralyzing touch already reaching for you!',
      death: 'The ghoul dissolves into foul-smelling smoke and rags!' },
    { name: 'Dark Elf',        weapon: 'shadow blade',     strMult:1.1, hpMult:0.9, goldMult:1.3, expMult:1.3,
      meet:  'A Dark Elf melts from the shadows, shadow blade humming with dark energy!',
      death: 'The dark elf crumbles into darkness with a final curse!' },
    { name: 'Imp',             weapon: 'fire breath',      strMult:0.7, hpMult:0.7, goldMult:0.7, expMult:0.8, behavior: 'fleeing',
      meet:  'A tiny red Imp pops into existence with a BANG, fire already billowing from its maw!',
      death: 'The imp pops out of existence with an anticlimactic bang!' },
    { name: 'Werewolf',        weapon: 'savage claws',     strMult:1.2, hpMult:1.1, goldMult:0.9, expMult:1.4, behavior: 'aggressive',
      meet:  'The moon breaks through the canopy — too late you realise what that means. A Werewolf howls!',
      death: 'The werewolf collapses and transforms back into a peaceful-looking corpse!' },
    { name: 'Vampire Bat',     weapon: 'draining bite',    strMult:0.8, hpMult:0.7, goldMult:0.8, expMult:0.9, behavior: 'venomous',
      meet:  'A Vampire Bat drops silently from above, fangs gleaming in the moonlight!',
      death: 'The vampire bat bursts into flame and collapses to ash!' },
    { name: 'Gnoll',           weapon: 'bone flail',       strMult:1.0, hpMult:1.0, goldMult:1.0, expMult:1.0,
      meet:  'A Gnoll warrior blocks the path, bone flail swinging in lazy confident circles!',
      death: 'The gnoll crashes to the earth with a thunderous boom!' },
    { name: 'Forest Witch',    weapon: 'dark magic',       strMult:1.1, hpMult:0.8, goldMult:1.4, expMult:1.5,
      meet:  'An ancient Forest Witch materialises from the mist, dark spells coiling around her fingers!',
      death: 'The witch shrieks, explodes in a flash of sickly light, and is gone!' },
  ],
  // ── Level 3 ──────────────────────────────────────────────────────────────
  [
    { name: 'Orc Chief',       weapon: 'war hammer',       strMult:1.1, hpMult:1.2, goldMult:1.2, expMult:1.1,
      meet:  'The Orc Chief roars a war cry that echoes through the entire forest!',
      death: 'The orc chief falls with a ground-shaking crash!' },
    { name: 'Gargoyle',        weapon: 'stone claws',      strMult:1.0, hpMult:1.4, goldMult:0.9, expMult:1.0,
      meet:  'Stone chips fly as a Gargoyle tears itself from its perch and dives straight at you!',
      death: 'The gargoyle shatters into a hundred stone pieces!' },
    { name: 'Bandit King',     weapon: 'enchanted blade',  strMult:1.2, hpMult:1.0, goldMult:1.8, expMult:1.2,
      meet:  '"Finally, a worthy victim." The Bandit King steps forward, enchanted blade gleaming.',
      death: 'The bandit king dies cursing your name — and meaning it as a compliment!' },
    { name: 'Cave Troll',      weapon: 'massive fists',    strMult:1.3, hpMult:1.5, goldMult:0.8, expMult:1.1,
      meet:  'The ground trembles as a Cave Troll crashes through the undergrowth straight at you!',
      death: 'The cave troll topples like a great tree — slowly, then all at once!' },
    { name: 'Ghast',           weapon: 'necrotic claws',   strMult:1.1, hpMult:1.1, goldMult:0.9, expMult:1.3,
      meet:  'A wave of sickening cold washes over you as a Ghast rises from the earth!',
      death: 'The ghast screams in silence and fades to nothing!' },
    { name: 'Dark Elf Mage',   weapon: 'shadow spells',    strMult:1.2, hpMult:0.9, goldMult:1.5, expMult:1.5,
      meet:  'A Dark Elf Mage steps through a rift of shadow, death spells already forming!',
      death: 'The dark elf mage implodes in a supernova of shadow!' },
    { name: 'Succubus',        weapon: 'charm touch',      strMult:1.0, hpMult:0.9, goldMult:1.6, expMult:1.4,
      meet:  'The air shimmers and a Succubus appears — her smile is beautiful, and utterly deadly!',
      death: 'The succubus wails and vanishes in a pillar of hellfire!' },
    { name: 'Gnoll Champion',  weapon: 'serrated axe',     strMult:1.2, hpMult:1.2, goldMult:1.1, expMult:1.2,
      meet:  'The Gnoll Champion beats its chest once and charges with terrifying speed!',
      death: 'The gnoll champion dies with a warrior\'s honour!' },
    { name: 'Giant Spider',    weapon: 'venomous fangs',   strMult:0.9, hpMult:1.0, goldMult:0.7, expMult:0.9, behavior: 'venomous',
      meet:  'Eight cold eyes glitter in the dark above — a Giant Spider descends on silken thread!',
      death: 'The giant spider writhes, curls its legs, and goes still!' },
    { name: 'Forest Ogre',     weapon: 'spiked club',      strMult:1.3, hpMult:1.4, goldMult:0.9, expMult:1.0,
      meet:  'A Forest Ogre rips up a young oak and hurls it aside as it spots you!',
      death: 'The ogre crashes to the ground and shakes the trees for a hundred yards!' },
    { name: 'Wraith',          weapon: 'life drain',       strMult:1.1, hpMult:1.0, goldMult:1.3, expMult:1.6,
      meet:  'The temperature plummets — a Wraith rises from the earth, reaching for your very soul!',
      death: 'The wraith lets out a silent scream and dissipates into cold air!' },
  ],
  // ── Level 4 ──────────────────────────────────────────────────────────────
  [
    { name: 'Troll Warrior',   weapon: 'iron maul',        strMult:1.2, hpMult:1.3, goldMult:1.1, expMult:1.1,
      meet:  'A Troll Warrior bellows and swings its iron maul in a deadly arc toward you!',
      death: 'The troll warrior falls face-first into the mud!' },
    { name: 'Stone Golem',     weapon: 'granite fists',    strMult:1.1, hpMult:1.8, goldMult:0.8, expMult:1.0, behavior: 'defensive',
      meet:  'Ancient runes flare as a Stone Golem lurches to life, hollow eyes fixing on you!',
      death: 'The stone golem cracks and crumbles to a pile of rubble!' },
    { name: 'Wyvern',          weapon: 'acid spit',        strMult:1.3, hpMult:1.2, goldMult:1.4, expMult:1.4, behavior: 'venomous',
      meet:  'A Wyvern plummets from the treetops, acid already dripping from its jaws!',
      death: 'The wyvern crashes to earth with a tremendous, final boom!' },
    { name: 'Dark Wizard',     weapon: 'death bolt',       strMult:1.4, hpMult:0.9, goldMult:1.7, expMult:1.6,
      meet:  'A Dark Wizard steps from a portal of shadow, death bolt crackling in his hand!',
      death: 'The dark wizard explodes in a shower of dark energy!' },
    { name: 'Lich',            weapon: 'soul siphon',      strMult:1.3, hpMult:1.1, goldMult:1.5, expMult:1.7,
      meet:  'The stench of ages overwhelms you as a Lich rises, hollow sockets locked on your soul!',
      death: 'The lich crumbles to ancient dust and silence!' },
    { name: 'Minotaur',        weapon: 'battleaxe',        strMult:1.4, hpMult:1.3, goldMult:1.0, expMult:1.2, behavior: 'aggressive',
      meet:  'Trees splinter as a raging Minotaur plows through the forest straight at you!',
      death: 'The minotaur bellows once and falls — shaking the ground!' },
    { name: 'Manticore',       weapon: 'poison spines',    strMult:1.2, hpMult:1.2, goldMult:1.3, expMult:1.3, behavior: 'venomous',
      meet:  'A Manticore lands in your path, poison spines fanned out, tail poised to strike!',
      death: 'The manticore collapses in a writhing, poisonous heap!' },
    { name: 'Weredragon',      weapon: 'fire breath',      strMult:1.5, hpMult:1.2, goldMult:1.2, expMult:1.5,
      meet:  'A man screams as he transforms into a horrifying Weredragon before your eyes!',
      death: 'The weredragon transforms back into a very dead man!' },
    { name: 'Cyclops',         weapon: 'giant boulder',    strMult:1.3, hpMult:1.4, goldMult:1.1, expMult:1.1,
      meet:  'A Cyclops spots you with its bloodshot eye and reaches for a boulder the size of a cart!',
      death: 'The cyclops topples with a rumble that shakes the forest floor!' },
    { name: 'Forest Giant',    weapon: 'uprooted tree',    strMult:1.2, hpMult:1.6, goldMult:0.9, expMult:1.0,
      meet:  'The sky darkens as a Forest Giant looms over the treeline, massive fist already swinging!',
      death: 'The giant falls and levels a dozen trees on the way down!' },
    { name: 'Gorgon',          weapon: 'petrifying gaze',  strMult:1.1, hpMult:1.0, goldMult:1.4, expMult:1.4,
      meet:  'You avert your eyes just in time as a Gorgon\'s petrifying gaze sweeps toward you!',
      death: 'The gorgon shatters like the statues it creates!' },
  ],
  // ── Level 5 ──────────────────────────────────────────────────────────────
  [
    { name: 'Mountain Troll',  weapon: 'spiked maul',      strMult:1.3, hpMult:1.4, goldMult:1.1, expMult:1.1,
      meet:  'A Mountain Troll tears itself from the cliff face and lands with a thunderous crash!',
      death: 'The mountain troll crashes down like a landslide!' },
    { name: 'Earth Golem',     weapon: 'crushing fists',   strMult:1.2, hpMult:2.0, goldMult:0.9, expMult:1.0, behavior: 'defensive',
      meet:  'The earth itself rises and reshapes — an Earth Golem stands before you, fists like boulders!',
      death: 'The earth golem fractures and falls apart piece by piece!' },
    { name: 'Basilisk',        weapon: 'stone gaze',       strMult:1.2, hpMult:1.3, goldMult:1.3, expMult:1.3, behavior: 'venomous',
      meet:  'A Basilisk slithers from beneath a slab of stone, its deadly gaze sweeping toward you!',
      death: 'The basilisk thrashes wildly and lies still!' },
    { name: 'Necromancer',     weapon: 'death wave',       strMult:1.5, hpMult:1.0, goldMult:1.8, expMult:1.8,
      meet:  'A Necromancer materialises from black smoke, death wave rippling from his fingertips!',
      death: 'The necromancer screams — and the dead do not rise again!' },
    { name: 'Death Knight',    weapon: 'soul reaper',      strMult:1.6, hpMult:1.3, goldMult:1.5, expMult:1.6,
      meet:  'A Death Knight of the dark realm steps through shadow, soul reaper humming!',
      death: 'The death knight falls, his dark armour clattering to the ground!' },
    { name: 'Iron Golem',      weapon: 'iron fists',       strMult:1.3, hpMult:1.8, goldMult:1.0, expMult:1.1, behavior: 'defensive',
      meet:  'A screech of metal on metal heralds an Iron Golem as it lumbers from between the trees!',
      death: 'The iron golem seizes up and topples to the earth!' },
    { name: 'Chimera',         weapon: 'triple strike',    strMult:1.4, hpMult:1.4, goldMult:1.4, expMult:1.4, behavior: 'aggressive',
      meet:  'Three heads snarl in unison as a Chimera rounds a boulder and charges!',
      death: 'Each of the chimera\'s three heads lets out its own dying scream!' },
    { name: 'Blood Elemental', weapon: 'hemorrhage',       strMult:1.3, hpMult:1.5, goldMult:1.2, expMult:1.5, behavior: 'aggressive',
      meet:  'The air reeks of copper as a Blood Elemental materialises, crimson and ravenous!',
      death: 'The blood elemental splashes apart in a crimson wave!' },
    { name: 'Frost Giant',     weapon: 'glacier club',     strMult:1.4, hpMult:1.5, goldMult:1.0, expMult:1.1,
      meet:  'The temperature plummets as a Frost Giant steps from the frozen north, club raised!',
      death: 'The frost giant shatters like an avalanche!' },
    { name: 'Storm Giant',     weapon: 'lightning bolt',   strMult:1.5, hpMult:1.4, goldMult:1.1, expMult:1.2,
      meet:  'Lightning splits a tree as a Storm Giant leaps down from the storm clouds above!',
      death: 'The storm giant falls with a crack of thunder that shakes the sky!' },
    { name: 'Shadow Demon',    weapon: 'void touch',       strMult:1.4, hpMult:1.2, goldMult:1.6, expMult:1.7,
      meet:  'Your shadow detaches from the ground and lunges — a Shadow Demon, wearing your own form!',
      death: 'The shadow demon dissolves as the light catches it!' },
  ],
  // ── Level 6 ──────────────────────────────────────────────────────────────
  [
    { name: 'Greater Troll',   weapon: 'runed maul',       strMult:1.4, hpMult:1.5, goldMult:1.2, expMult:1.2,
      meet:  'A Greater Troll shakes the earth with each step as it bears down on you!',
      death: 'The greater troll lets out its last bellow and falls!' },
    { name: 'Fire Golem',      weapon: 'magma fists',      strMult:1.4, hpMult:1.7, goldMult:1.0, expMult:1.1,
      meet:  'The forest ignites around you as a Fire Golem steps from the inferno, fists of magma raised!',
      death: 'The fire golem cools and crumbles to slag!' },
    { name: 'Medusa',          weapon: 'stone gaze',       strMult:1.3, hpMult:1.2, goldMult:1.7, expMult:1.6,
      meet:  'You keep your eyes averted as Medusa\'s serpentine hair hisses around her, seeking your gaze!',
      death: 'Medusa\'s head falls — and her terrible gaze is extinguished forever!' },
    { name: 'Arch Lich',       weapon: 'death cascade',    strMult:1.6, hpMult:1.2, goldMult:2.0, expMult:2.0,
      meet:  'Reality cracks as an Arch Lich tears its way into your world, death cascade already beginning!',
      death: 'The arch lich crumbles to dust and silence!' },
    { name: "Dark Lord's Knight", weapon:'cursed lance',   strMult:1.7, hpMult:1.4, goldMult:1.6, expMult:1.6,
      meet:  'The Dark Lord\'s Knight rides a shadow stallion from the darkness, cursed lance leveled at you!',
      death: 'The dark knight falls, black armour clanging!' },
    { name: 'Mithril Golem',   weapon: 'mithril fists',    strMult:1.5, hpMult:2.0, goldMult:1.1, expMult:1.2, behavior: 'defensive',
      meet:  'The sound of tolling bells accompanies a Mithril Golem as it strides from the ancient ruin!',
      death: 'The mithril golem seizes up and topples with a bell-like crash!' },
    { name: 'Hydra',           weapon: 'seven-head bite',  strMult:1.5, hpMult:1.8, goldMult:1.3, expMult:1.4,
      meet:  'Seven heads snap and weave as a Hydra erupts from the dark pool, all eyes locked on you!',
      death: 'All seven heads of the hydra droop and go still at last!' },
    { name: 'War Daemon',      weapon: 'hellfire strike',  strMult:1.7, hpMult:1.3, goldMult:1.5, expMult:1.7,
      meet:  'The sky tears open and a War Daemon drops through the wound, hellfire raging around it!',
      death: 'The war daemon howls and is dragged screaming back to the Abyss!' },
    { name: 'Frost Dragon',    weapon: 'blizzard breath',  strMult:1.6, hpMult:1.6, goldMult:1.8, expMult:1.8,
      meet:  'A Frost Dragon explodes from beneath the frozen lake, ice and fury!',
      death: 'The frost dragon crashes to earth in a shower of ice and silence!' },
    { name: 'Thunder Giant',   weapon: 'storm hammer',     strMult:1.5, hpMult:1.6, goldMult:1.1, expMult:1.2,
      meet:  'A Thunder Giant descends from storm clouds on a bolt of lightning, hammer raised!',
      death: 'The thunder giant falls and shakes the ground for miles!' },
    { name: 'Greater Shadow',  weapon: 'soul rend',        strMult:1.5, hpMult:1.4, goldMult:1.9, expMult:1.9,
      meet:  'The world dims as a Greater Shadow swells from every dark corner, surrounding you!',
      death: 'The greater shadow shreds apart as the light of dawn touches it!' },
  ],
  // ── Level 7 ──────────────────────────────────────────────────────────────
  [
    { name: 'Elder Troll',     weapon: 'ancient maul',     strMult:1.5, hpMult:1.6, goldMult:1.3, expMult:1.3,
      meet:  'An Elder Troll, ancient as the mountains, rises from its centuries-long slumber!',
      death: 'The elder troll falls with a titanic crash!' },
    { name: 'Chaos Elemental', weapon: 'chaos storm',      strMult:1.6, hpMult:1.5, goldMult:1.4, expMult:1.5,
      meet:  'Reality splinters as a Chaos Elemental tears itself into existence, howling!',
      death: 'The chaos elemental unravels into nothing!' },
    { name: 'Dragon Spawn',    weapon: 'claw and fang',    strMult:1.7, hpMult:1.6, goldMult:1.7, expMult:1.7,
      meet:  'A Dragon Spawn crashes through an ancient wall, roaring its terrible heritage!',
      death: 'The dragon spawn lets out a dying roar that shakes the sky!' },
    { name: 'Lich King',       weapon: 'oblivion',         strMult:1.8, hpMult:1.3, goldMult:2.2, expMult:2.2,
      meet:  'Silence falls like a hammer as the Lich King materialises, reality rotting around it!',
      death: 'The lich king dissolves, releasing countless bound souls!' },
    { name: 'Demon Lord',      weapon: 'hellgate slash',   strMult:1.9, hpMult:1.5, goldMult:1.8, expMult:1.8,
      meet:  'The sky goes black as a Demon Lord tears its way from the Abyss, hellgate slash raised!',
      death: 'The demon lord roars and is banished back to the pit!' },
    { name: 'Ancient Golem',   weapon: 'titan fists',      strMult:1.6, hpMult:2.2, goldMult:1.1, expMult:1.2, behavior: 'defensive',
      meet:  'The earth heaves as an Ancient Golem, dormant for millennia, finally rises!',
      death: 'The ancient golem shatters into a thousand shards!' },
    { name: 'Void Weaver',     weapon: 'reality tear',     strMult:1.7, hpMult:1.4, goldMult:1.9, expMult:2.0,
      meet:  'Reality tears as a Void Weaver threads the seams of the world apart from within!',
      death: 'The void weaver collapses as reality repairs itself around it!' },
    { name: 'Storm Dragon',    weapon: 'lightning storm',  strMult:1.8, hpMult:1.7, goldMult:1.9, expMult:1.9,
      meet:  'The heavens erupt as a Storm Dragon descends through the lightning, roaring in fury!',
      death: 'The storm dragon crashes to earth with a thunderclap heard for leagues!' },
    { name: 'Giant Destroyer', weapon: 'sky boulder',      strMult:1.6, hpMult:1.8, goldMult:1.2, expMult:1.3,
      meet:  'The horizon darkens as a Giant Destroyer clears the treeline in a single stride!',
      death: 'The giant destroyer falls and levels the forest for a mile around!' },
    { name: 'Shadow Titan',    weapon: 'darkness',         strMult:1.7, hpMult:1.6, goldMult:2.0, expMult:2.0,
      meet:  'The sun goes out as a Shadow Titan rises, its darkness absolute and total!',
      death: 'The shadow titan crumbles as dawn breaks through!' },
    { name: 'Abyssal Horror',  weapon: 'sanity shatter',   strMult:1.8, hpMult:1.5, goldMult:2.1, expMult:2.1,
      meet:  'The ground cracks open and an Abyssal Horror pulls itself up from the void below!',
      death: 'The abyssal horror collapses back into the void with a shriek!' },
  ],
  // ── Level 8 ──────────────────────────────────────────────────────────────
  [
    { name: 'Titan Troll',     weapon: 'legendary maul',   strMult:1.7, hpMult:1.8, goldMult:1.4, expMult:1.4,
      meet:  'The mountain itself shakes as a Titan Troll stands and turns its ancient fury on you!',
      death: 'The titan troll falls and the earth cracks beneath it!' },
    { name: 'Doomsday Golem',  weapon: 'apocalypse fists', strMult:1.7, hpMult:2.5, goldMult:1.2, expMult:1.2, behavior: 'defensive',
      meet:  'Runes of apocalypse blaze as a Doomsday Golem completes its terrible awakening!',
      death: 'The doomsday golem splits apart with a sound like the world ending!' },
    { name: 'Elder Dragon',    weapon: 'inferno breath',   strMult:2.0, hpMult:2.0, goldMult:2.0, expMult:2.0,
      meet:  'The world shakes as an Elder Dragon descends from the storm clouds, ancient wrath unveiled!',
      death: 'The elder dragon plummets from the sky, shaking the earth on impact!' },
    { name: 'Ancient Lich',    weapon: 'world end',        strMult:2.1, hpMult:1.5, goldMult:2.5, expMult:2.5,
      meet:  'Centuries of death magic coalesce as an Ancient Lich awakens from its long-planned slumber!',
      death: 'The ancient lich lets out a final curse and crumbles to forgotten dust!' },
    { name: 'Pit Fiend',       weapon: 'hellfire barrage', strMult:2.2, hpMult:1.7, goldMult:2.0, expMult:2.0,
      meet:  'The ground tears open and a Pit Fiend heaves itself out of the fiery abyss!',
      death: 'The pit fiend roars and is dragged back to Hell!' },
    { name: 'Death Lord',      weapon: 'reaper touch',     strMult:2.0, hpMult:1.6, goldMult:2.2, expMult:2.3,
      meet:  'Every living thing within miles withers as the Death Lord extends its hand toward you!',
      death: 'The death lord falls, releasing all its stolen lives at once!' },
    { name: 'Archdemon',       weapon: 'dark annihilation',strMult:2.1, hpMult:1.8, goldMult:2.1, expMult:2.2,
      meet:  'The sky blackens as an Archdemon tears through the veil between worlds, its gaze on you!',
      death: 'The archdemon is banished in a column of holy fire!' },
    { name: 'Chaos Dragon',    weapon: 'chaos inferno',    strMult:2.1, hpMult:2.0, goldMult:2.1, expMult:2.1,
      meet:  'Reality collapses inward as a Chaos Dragon tears itself free from the laws of physics!',
      death: 'The chaos dragon explodes in a storm of chaotic energy!' },
    { name: 'Titan Giant',     weapon: 'mountain',         strMult:1.9, hpMult:2.2, goldMult:1.4, expMult:1.4,
      meet:  'The world tilts as a Titan Giant steps from behind a mountain range, fist swinging!',
      death: 'The titan giant falls and splits the earth!' },
    { name: 'Void Lord',       weapon: 'cosmic void',      strMult:2.0, hpMult:1.9, goldMult:2.3, expMult:2.4,
      meet:  'Space itself groans as a Void Lord pulls nothingness around itself and strides toward you!',
      death: 'The void lord collapses as the void itself recoils!' },
    { name: 'Nightmare Beast', weapon: 'fear incarnate',   strMult:2.0, hpMult:2.0, goldMult:2.0, expMult:2.2,
      meet:  'Your deepest fears coalesce into flesh and muscle — a Nightmare Beast, born of your own terror!',
      death: 'The nightmare beast dissolves as you conquer the fear that gave it life!' },
  ],
  // ── Level 9 ──────────────────────────────────────────────────────────────
  [
    { name: 'Dread Titan',     weapon: 'world maul',       strMult:2.0, hpMult:2.0, goldMult:1.5, expMult:1.5,
      meet:  'The stars themselves flinch as a Dread Titan rises from the abyss!',
      death: 'The dread titan collapses in epic, earth-shaking fashion!' },
    { name: 'Eternal Golem',   weapon: 'oblivion fists',   strMult:1.9, hpMult:3.0, goldMult:1.3, expMult:1.3, behavior: 'defensive',
      meet:  'Before time itself began, the Eternal Golem was waiting for this moment. Now it moves.',
      death: 'The eternal golem finally, impossibly, stops moving!' },
    { name: 'Ancient Dragon',  weapon: 'ancient fire',     strMult:2.3, hpMult:2.3, goldMult:2.3, expMult:2.3,
      meet:  'Mountains crumble in the wake of an Ancient Dragon as it descends, ancient fire raging!',
      death: 'The ancient dragon falls with a sound like the end of the world!' },
    { name: 'Elder Lich',      weapon: 'eternity',         strMult:2.4, hpMult:1.7, goldMult:2.8, expMult:2.8,
      meet:  'Reality unravels for miles around as an Elder Lich opens its eyes after an aeon of sleep!',
      death: 'The elder lich screams and turns to ash — and the eons of undeath end!' },
    { name: 'Greater Demon',   weapon: 'hellfire nova',    strMult:2.5, hpMult:2.0, goldMult:2.3, expMult:2.3,
      meet:  'The fabric of existence screams as a Greater Demon tears through it with casual contempt!',
      death: 'The greater demon is banished with a thunderclap that shakes the heavens!' },
    { name: 'Soul Eater',      weapon: 'devour',           strMult:2.3, hpMult:2.2, goldMult:2.4, expMult:2.5,
      meet:  'Screaming souls trail in the wake of the Soul Eater as it advances, hungry for yours!',
      death: 'The soul eater implodes, releasing every soul it ever consumed!' },
    { name: 'World Destroyer', weapon: 'annihilation',     strMult:2.4, hpMult:2.1, goldMult:2.4, expMult:2.4,
      meet:  'The horizon catches fire as the World Destroyer turns its attention to this world — and to you!',
      death: 'The world destroyer falls — and the world survives!' },
    { name: 'Inferno Drake',   weapon: 'solar breath',     strMult:2.4, hpMult:2.4, goldMult:2.4, expMult:2.4,
      meet:  'The sky becomes an ocean of flame as an Inferno Drake descends, solar breath blazing!',
      death: 'The inferno drake crashes down in a blaze of glory!' },
    { name: 'Titan King',      weapon: 'cosmic hammer',    strMult:2.2, hpMult:2.6, goldMult:1.6, expMult:1.6,
      meet:  'The cosmos shudders as the Titan King strides from between galaxies, hammer raised!',
      death: 'The titan king falls and shakes the stars!' },
    { name: 'Chaos God',       weapon: 'reality end',      strMult:2.3, hpMult:2.3, goldMult:2.6, expMult:2.7,
      meet:  'Every law of nature shatters as the Chaos God unmakes the sky and remakes it as a weapon!',
      death: 'The chaos god falls — and for a moment, order reigns supreme!' },
    { name: 'Death Incarnate', weapon: 'true death',       strMult:2.3, hpMult:2.3, goldMult:2.5, expMult:2.6,
      meet:  'Every living thing within a thousand miles takes one last breath. Then silence. Death Incarnate has arrived.',
      death: 'Death itself dies... for now.' },
  ],
  // ── Level 10 ─────────────────────────────────────────────────────────────
  [
    { name: 'Primordial Titan',  weapon: 'beginning maul',  strMult:2.2, hpMult:2.2, goldMult:1.6, expMult:1.6,
      meet:  'The Primordial Titan — as old as creation — stirs from its rest and regards you with cosmic fury!',
      death: 'The primordial titan falls, ending an age!' },
    { name: 'Apocalypse Golem', weapon: 'end fists',        strMult:2.1, hpMult:3.5, goldMult:1.4, expMult:1.4, behavior: 'defensive',
      meet:  'The word END is carved across every inch of the Apocalypse Golem as it raises its fists!',
      death: 'The apocalypse golem finally crumbles!' },
    { name: 'Legendary Dragon', weapon: 'legend fire',      strMult:2.6, hpMult:2.6, goldMult:2.6, expMult:2.6,
      meet:  'Songs have been written about this moment — the Legendary Dragon descends, and history holds its breath!',
      death: 'The legendary dragon falls, becoming legend itself!' },
    { name: 'Lich Emperor',     weapon: 'imperial death',   strMult:2.7, hpMult:2.0, goldMult:3.2, expMult:3.2,
      meet:  'Every lich in the world bows its head as the Lich Emperor arrives!',
      death: 'The lich emperor shatters in a final flash of dark light!' },
    { name: 'Demon Emperor',    weapon: 'inferno empire',   strMult:2.8, hpMult:2.3, goldMult:2.7, expMult:2.7,
      meet:  'The entire demonic hierarchy trembles as the Demon Emperor descends from its infernal throne!',
      death: 'The demon emperor is finally, definitively cast down!' },
    { name: 'Void Emperor',     weapon: 'nothingness',      strMult:2.6, hpMult:2.5, goldMult:2.8, expMult:2.9,
      meet:  'Space and time fold themselves out of the way as the Void Emperor steps into existence!',
      death: 'The void emperor collapses into the void it came from!' },
    { name: 'True Dragon',      weapon: 'true fire',        strMult:2.8, hpMult:2.8, goldMult:2.8, expMult:2.8,
      meet:  'The True Dragon has existed since the first sunrise. Its roar shakes the foundations of the world.',
      death: 'The true dragon falls, shaking the heavens!' },
    { name: 'Shadow Emperor',   weapon: 'shadow empire',    strMult:2.7, hpMult:2.6, goldMult:2.9, expMult:2.9,
      meet:  'Every shadow in existence becomes the Shadow Emperor, surrounding you completely!',
      death: 'The shadow emperor dissolves as light floods the world!' },
    { name: 'Titan Emperor',    weapon: 'titan will',       strMult:2.5, hpMult:3.0, goldMult:1.8, expMult:1.8,
      meet:  'The universe itself bows as the Titan Emperor arrives — the most powerful giant ever known!',
      death: 'The titan emperor falls and the mountains tremble!' },
    { name: 'Chaos Emperor',    weapon: 'chaos empire',     strMult:2.6, hpMult:2.6, goldMult:3.0, expMult:3.1,
      meet:  'The laws of reality dissolve as the Chaos Emperor unmakes everything and reconstructs it as a battlefield!',
      death: 'The chaos emperor is destroyed — and order reigns for the first time in aeons!' },
    { name: 'Death Emperor',    weapon: 'mortal end',       strMult:2.6, hpMult:2.6, goldMult:2.9, expMult:3.0,
      meet:  'Every soul ever claimed by death answers to the Death Emperor. Now it wants yours.',
      death: 'The death emperor falls — and life wins the day!' },
  ],
  // ── Level 11 ─────────────────────────────────────────────────────────────
  [
    { name: 'Dragon Patriarch', weapon: 'patriarch fire',   strMult:2.5, hpMult:2.5, goldMult:2.0, expMult:2.0,
      meet:  'The Dragon Patriarch — father of all dragons — descends with a roar that splits the sky!',
      death: 'The dragon patriarch falls with a final, noble, earth-shaking roar!' },
    { name: 'Godlike Golem',    weapon: 'divine fists',     strMult:2.3, hpMult:4.0, goldMult:1.6, expMult:1.6, behavior: 'defensive',
      meet:  'It was built before the gods, by something older. Nothing has ever destroyed it. Until today, perhaps.',
      death: 'The godlike golem shatters into divine shards!' },
    { name: 'Dragon God',       weapon: 'divine fire',      strMult:3.0, hpMult:3.0, goldMult:3.0, expMult:3.0,
      meet:  'The Dragon God descends from the celestial realm, its divine fire painting the sky gold and red!',
      death: 'The dragon god falls, and the heavens themselves weep!' },
    { name: 'Lich God',         weapon: 'divine death',     strMult:3.1, hpMult:2.3, goldMult:3.6, expMult:3.6,
      meet:  'The accumulated death of every universe ever destroyed fuels the Lich God as it opens its eyes!',
      death: 'The lich god dissolves with a cosmic scream!' },
    { name: 'Demon God',        weapon: 'divine hellfire',  strMult:3.2, hpMult:2.6, goldMult:3.1, expMult:3.1,
      meet:  'The Demon God — ruler of all damnation — descends to face you personally. A supreme honour and a death sentence.',
      death: 'The demon god is cast down for the last time!' },
    { name: 'Void God',         weapon: 'divine void',      strMult:3.0, hpMult:2.9, goldMult:3.2, expMult:3.3,
      meet:  'The Void God does not arrive. It simply removes everything else until only it and you remain.',
      death: 'The void god collapses — and everything that was removed returns!' },
    { name: 'Dragon King',      weapon: 'king fire',        strMult:3.1, hpMult:3.1, goldMult:3.1, expMult:3.1,
      meet:  'The Dragon King roars and the mountain range behind it crumbles to announce its presence!',
      death: 'The dragon king crashes to earth — long live the king!' },
    { name: 'Shadow God',       weapon: 'divine darkness',  strMult:3.0, hpMult:3.0, goldMult:3.3, expMult:3.3,
      meet:  'The Shadow God does not approach. It is already everywhere. And now it focuses entirely on you.',
      death: 'The shadow god is extinguished by the light!' },
    { name: 'Titan God',        weapon: 'titan divinity',   strMult:2.8, hpMult:3.4, goldMult:2.1, expMult:2.1,
      meet:  'The Titan God picks up a star and uses it as a weapon. You are impossibly outmatched. And yet, here you are.',
      death: 'The titan god falls — and the world is reborn in its wake!' },
    { name: 'Chaos God Prime',  weapon: 'prime chaos',      strMult:3.0, hpMult:3.0, goldMult:3.4, expMult:3.5,
      meet:  'The Chaos God Prime — the source of all chaos since before time — finally deigns to notice you.',
      death: 'The chaos god prime is undone by order itself!' },
    { name: 'Death God',        weapon: 'divine end',       strMult:3.0, hpMult:3.0, goldMult:3.3, expMult:3.4,
      meet:  'Death itself has taken form. And that form is looking directly at you with the full weight of eternity.',
      death: 'The death god falls... and death itself weeps.' },
  ],
];

const RED_DRAGON = {
  name: 'The Red Dragon',
  weapon: 'claw, fang, and inferno',
  hp: 2000, maxHp: 2000, currentHp: 2000,
  strength: 500,
  gold: 500000,
  exp: 1000000,
  meet: 'Two enormous eyes open in the darkness of the cave, glowing like hot coals. A voice like grinding boulders speaks: "SO. ANOTHER WORM DARES TO FACE ME."',
  death: 'The Red Dragon shudders. Its great wings fold. It crashes to earth with a sound like the end of an age. With its last breath it whispers... "Well done, Warrior."',
};

// Champion dragon tiers — fought after slaying the Red Dragon at least once.
const CHAMPION_DRAGONS = [
  {
    // times_won === 1 → "The Ancient Dragon"
    name: 'The Ancient Dragon',
    hp: 3500, strength: 700,
    gold: 1000000, exp: 1500000,
    meet: '"YOU RETURN. I HAVE HAD TIME TO THINK ON OUR LAST MEETING. AND TO CHANGE."',
    death: 'The Ancient Dragon crashes to earth trailing smoke. "Stronger than you were. Good."',
  },
  {
    // times_won === 2 → "The Eternal Dragon"
    name: 'The Eternal Dragon',
    hp: 6000, strength: 1000,
    gold: 2000000, exp: 3000000,
    meet: '"TWICE. YOU HAVE SLAIN ME TWICE. I ALMOST ADMIRE YOU."',
    death: 'The Eternal Dragon dissolves into a pillar of fire. The echo of laughter lingers.',
  },
  {
    // times_won >= 3 → "The Primordial Dragon" (scales further each win)
    name: 'The Primordial Dragon',
    hp: 10000, strength: 1500,
    gold: 4000000, exp: 6000000,
    meet: '"YOU. AGAIN. I NO LONGER HAVE WORDS. ONLY THIS."',
    death: 'The Primordial Dragon collapses. The mountain groans. A strange silence falls.',
  },
];

// Returns the appropriate champion dragon for a given times_won count.
// For times_won >= 4, power scales by ×1.30 per win beyond 3.
function getChampionDragon(timesWon) {
  if (timesWon <= 1) return { ...CHAMPION_DRAGONS[0] };
  if (timesWon === 2) return { ...CHAMPION_DRAGONS[1] };
  const base = { ...CHAMPION_DRAGONS[2] };
  const extra = timesWon - 3;
  if (extra > 0) {
    const m = Math.pow(1.30, extra);
    base.hp       = Math.floor(base.hp       * m);
    base.strength = Math.floor(base.strength * m);
    base.gold     = Math.floor(base.gold     * m);
    base.exp      = Math.floor(base.exp      * m);
  }
  return base;
}

// Starting stats per class — mirrors the setup route so prestige can reuse them.
const CLASS_START_HP  = { 1: 28, 2: 35, 3: 22, 4: 20, 5: 25, 6: 32, 7: 25, 8: 22, 9: 18, 10: 26 };
const CLASS_START_STR = { 1: 20, 2: 16, 3: 17, 4: 22, 5: 17, 6: 17, 7: 18, 8: 19, 9: 23, 10: 18 };

// Title prefix shown next to the player's name at each prestige tier.
const PRESTIGE_TITLES = ['', 'Reborn', 'Twice-Forged', 'Ancient', 'Eternal'];
function getPrestigeTitle(n) { return PRESTIGE_TITLES[Math.min(n, PRESTIGE_TITLES.length - 1)] || 'Eternal'; }

function getMonster(level, index) {
  const lvl = Math.min(level, 11) - 1;
  const tmpl = MONSTER_TEMPLATES[lvl][index];
  const base = {
    hp:       Math.floor((15 + level * 18) * tmpl.hpMult),
    strength: Math.floor((8  + level * 10) * tmpl.strMult),
    gold:     Math.floor((10 + level * 22) * tmpl.goldMult),
    exp:      Math.floor((15 + level * 22) * tmpl.expMult),
  };
  // currentHp is set here so it's always defined — this was the NaN source
  // level is included so XP tapering and hunt matching can reference it.
  return { ...tmpl, ...base, maxHp: base.hp, currentHp: base.hp, level };
}

function getRandomMonster(level) {
  return getMonster(level, Math.floor(Math.random() * 11));
}

const EXP_TABLE = [
  0, 100, 400, 1000, 2500, 6250, 15000, 37500, 75000, 150000, 300000, 600000,
];

function expForLevel(level)     { return EXP_TABLE[Math.min(level, 12) - 1] || 600000; }
function expForNextLevel(level) { return level >= 12 ? null : EXP_TABLE[level]; }

const CLASS_NAMES = {
  1: 'Dread Knight',
  2: 'Warrior',
  3: 'Rogue',
  4: 'Mage',
  5: 'Ranger',
  6: 'Paladin',
  7: 'Druid',
  8: 'Necromancer',
  9: 'Elementalist',
  10: 'Monk',
};

// damageMult: power move damage multiplier
// sideEffect: optional secondary effect applied after the power move
//   'self_heal'   — heals player for 10% of max HP
//   'poison'      — applies poison to monster (3 rounds)
//   'hp_cost'     — player spends 10% max HP to unleash the attack
const CLASS_POWER_MOVES = {
  1:  { name: 'Soul Rend',       desc: 'Tears the soul from your foe, leaving them broken and bleeding.', damageMult: 3.0 },
  2:  { name: 'Shield Slam',     desc: 'A crushing blow from your shield that drives back even giants.',   damageMult: 2.0 },
  3:  { name: 'Backstab',        desc: 'A precise strike from an unexpected angle — never misses.',        damageMult: 2.5 },
  4:  { name: 'Arcane Surge',    desc: 'Raw arcane force condensed into a single devastating blast.',      damageMult: 2.5 },
  5:  { name: 'Aimed Shot',      desc: 'A perfectly placed strike that finds every gap in the armour.',    damageMult: 2.5 },
  6:  { name: 'Divine Smite',    desc: 'Holy power floods through your weapon — and back into your veins.', damageMult: 2.0, sideEffect: 'self_heal' },
  7:  { name: 'Thornlash',       desc: 'The forest itself lashes out through you in a surge of fury.',     damageMult: 2.0 },
  8:  { name: 'Death Coil',      desc: 'A coil of necrotic energy that rots the target from within.',     damageMult: 2.5, sideEffect: 'poison' },
  9:  { name: 'Elemental Fury',  desc: 'You burn from the inside out to unleash catastrophic elemental force.', damageMult: 3.5, sideEffect: 'hp_cost' },
  10: { name: 'Ki Strike',       desc: 'A focused burst of inner energy delivered in a single perfect blow.', damageMult: 2.5 },
};

const LEVEL_UP_GAINS = {
  1:  { hp: 7,  strength: 4 },  // Dread Knight   — high power growth
  2:  { hp: 8,  strength: 3 },  // Warrior         — highest HP growth
  3:  { hp: 5,  strength: 3 },  // Rogue           — low HP, agile
  4:  { hp: 4,  strength: 4 },  // Mage            — low HP, high spell power
  5:  { hp: 5,  strength: 3 },  // Ranger          — balanced
  6:  { hp: 7,  strength: 3 },  // Paladin         — high HP, moderate power
  7:  { hp: 6,  strength: 3 },  // Druid           — balanced
  8:  { hp: 5,  strength: 4 },  // Necromancer     — low HP, high power
  9:  { hp: 3,  strength: 5 },  // Elementalist    — extreme glass cannon
  10: { hp: 6,  strength: 4 },  // Monk            — balanced, high power growth
};

// ── World map ─────────────────────────────────────────────────────────────────
// connections: direct one-hop travel routes (bidirectional)
// shopMaxTier: highest weapon/armor tier available in this town's shops
// minLevel:    minimum player level required to enter (0 = no gate)
const TOWNS = {
  dawnmark: {
    id: 'dawnmark', name: 'Town of Dawnmark',
    tagline: 'The frontier holds no promises — only opportunities.',
    connections: ['thornreach', 'silverkeep', 'bracken_hollow'],
    shopMaxTier: 7, minLevel: 1,
  },
  stormwatch: {
    id: 'stormwatch', name: 'Stormwatch',
    tagline: 'Reality bends here. The wise tread carefully.',
    connections: ['frostmere', 'thornreach', 'ironhold'],
    shopMaxTier: 11, minLevel: 4,
  },
  ironhold: {
    id: 'ironhold', name: 'Ironhold Bastion',
    tagline: 'Strength is the only currency that matters.',
    connections: ['stormwatch', 'silverkeep', 'velmora', 'old_karth'],
    shopMaxTier: 12, minLevel: 3,
  },
  old_karth: {
    id: 'old_karth', name: 'Old Karth',
    tagline: 'What was buried here should have stayed buried.',
    connections: ['ironhold', 'ashenfall'],
    shopMaxTier: 10, minLevel: 5,
  },
  thornreach: {
    id: 'thornreach', name: 'Thornreach',
    tagline: 'The forest does not forgive those who ignore it.',
    connections: ['stormwatch', 'dawnmark', 'silverkeep'],
    shopMaxTier: 7, minLevel: 1,
  },
  silverkeep: {
    id: 'silverkeep', name: 'Silverkeep',
    tagline: 'Justice is absolute. So is its price.',
    connections: ['thornreach', 'dawnmark', 'ironhold', 'velmora', 'duskveil'],
    shopMaxTier: 9, minLevel: 1,
  },
  velmora: {
    id: 'velmora', name: 'Velmora',
    tagline: 'Everything has a price. Most things have several.',
    connections: ['ironhold', 'silverkeep', 'graveport'],
    shopMaxTier: 13, minLevel: 2,
  },
  bracken_hollow: {
    id: 'bracken_hollow', name: 'Bracken Hollow',
    tagline: 'Small town, big problems.',
    connections: ['dawnmark'],
    shopMaxTier: 3, minLevel: 1,
  },
  duskveil: {
    id: 'duskveil', name: 'Duskveil',
    tagline: 'In the perpetual twilight, secrets thrive.',
    connections: ['silverkeep', 'graveport', 'mirefen'],
    shopMaxTier: 10, minLevel: 5,
  },
  graveport: {
    id: 'graveport', name: 'Graveport',
    tagline: 'The dead make good sailors. They never complain.',
    connections: ['velmora', 'duskveil', 'mirefen'],
    shopMaxTier: 8, minLevel: 3,
  },
  mirefen: {
    id: 'mirefen', name: 'Mirefen',
    tagline: 'The swamp takes what it wants. And it keeps it.',
    connections: ['duskveil', 'graveport', 'ashenfall'],
    shopMaxTier: 6, minLevel: 4,
  },
  ashenfall: {
    id: 'ashenfall', name: 'Ashenfall',
    tagline: 'Everything here has already burned once.',
    connections: ['mirefen', 'old_karth'],
    shopMaxTier: 15, minLevel: 7,
  },
  frostmere: {
    id: 'frostmere', name: 'Frostmere',
    tagline: 'Isolation is the oldest survival strategy.',
    connections: ['stormwatch'],
    shopMaxTier: 5, minLevel: 2,
  },
};

// ── City social spaces ────────────────────────────────────────────────────────
// One unique location per town shown as the [G] option on the town screen
const SOCIAL_SPACES = {
  dawnmark:         { name: "Lysa's Garden",      action: 'garden' },
  velmora:        { name: 'The Silken Chamber', action: 'social_velmora' },
  ironhold:       { name: 'The Fighting Pit',   action: 'social_ironhold' },
  silverkeep:     { name: 'Temple of Valor',    action: 'social_silverkeep' },
  thornreach:     { name: 'The Ancient Grove',  action: 'social_thornreach' },
  duskveil:       { name: 'The Shadow Market',  action: 'social_duskveil' },
  graveport:      { name: 'The Drowned Man',    action: 'social_graveport' },
  stormwatch:     { name: 'The Arcane Library', action: 'social_stormwatch' },
  old_karth:      { name: 'The Crypts',         action: 'social_old_karth' },
  ashenfall:      { name: 'The Forge of Ruin',  action: 'social_ashenfall' },
  bracken_hollow: { name: 'The Village Well',   action: 'social_bracken_hollow' },
  mirefen:        { name: "The Bog Witch's Hut", action: 'social_mirefen' },
  frostmere:      { name: 'The Hearthfire Inn', action: 'social_frostmere' },
};

// ── Shop owners ────────────────────────────────────────────────────────────────
// weaponMult/armorMult: price multiplier when buying (0.90 = 10% off)
// sellMult: fraction of original price returned as trade-in when buying new gear
// tierCap: if set, only applies discounts on items up to this tier
// Special flags: charmBonus, dailyDiscount, poisonGearDiscount, fleeDiscount, forgeUpgrade, stocksBonus
const SHOP_OWNERS = {
  dawnmark:         { name: 'Silas',        title: 'the Old Soldier',     quote: '"Fought for thirty years. Sells for fifty."',           weaponMult: 0.90, armorMult: 1.00, sellMult: 0.40, tierCap: 5,  faction: null },
  silverkeep:       { name: 'Lady Maren',   title: "the Noble's Factor",  quote: '"Quality at a fair price. No haggling."',               weaponMult: 1.00, armorMult: 1.00, sellMult: 0.40, charmBonus: true,  faction: 'knights' },
  velmora:          { name: 'Kess',         title: 'the Sharp Merchant',  quote: '"I buy high. Unusual, I know."',                        weaponMult: 1.00, armorMult: 1.00, sellMult: 0.55, faction: 'merchants' },
  ironhold:         { name: 'Brennar',      title: 'the Armorer',         quote: '"Armor first. Weapons are for showing off."',            weaponMult: 1.05, armorMult: 0.90, sellMult: 0.40, faction: null },
  thornreach:       { name: 'Aldric',       title: 'the Woodsman',        quote: '"Practical gear for practical work."',                   weaponMult: 0.92, armorMult: 0.92, sellMult: 0.40, tierCap: 7,  faction: 'druids' },
  stormwatch:       { name: 'Zathis',       title: 'the Arcane Merchant', quote: '"My stock is... eclectic."',                             weaponMult: 1.00, armorMult: 1.00, sellMult: 0.40, stocksBonus: true, faction: null },
  duskveil:         { name: 'No Name',      title: 'ask no questions',    quote: '"One item. One day. Discounted. That\'s the deal."',     weaponMult: 1.00, armorMult: 1.00, sellMult: 0.40, dailyDiscount: true, faction: 'guild' },
  graveport:        { name: 'Marek',        title: 'the Smuggler',        quote: '"Fell off a ship. No questions."',                       weaponMult: 0.88, armorMult: 1.00, sellMult: 0.40, faction: 'necromancers' },
  mirefen:          { name: 'Old Petra',    title: 'the Swamp Trader',    quote: '"I smell gold on you. Good."',                           weaponMult: 1.00, armorMult: 1.00, sellMult: 0.40, poisonGearDiscount: true, faction: null },
  old_karth:        { name: 'the Dealer',   title: 'of relics',           quote: '"These have outlived their owners. Maybe you won\'t."',  weaponMult: 1.15, armorMult: 1.15, sellMult: 0.60, faction: null },
  ashenfall:        { name: 'Vorn',         title: 'the Master Forger',   quote: '"I built the weapons that broke the last king."',         weaponMult: 1.00, armorMult: 1.00, sellMult: 0.40, faction: null },
  bracken_hollow:   { name: 'Marta',        title: "the Farmer's Wife",   quote: '"It\'s not fancy. But it\'ll hold."',                    weaponMult: 0.80, armorMult: 0.80, sellMult: 0.40, tierCap: 3,  faction: null },
  frostmere:        { name: 'Bjarne',       title: 'the Hunter',          quote: '"Built for the cold. Built to last."',                   weaponMult: 1.00, armorMult: 1.00, sellMult: 0.40, fleeDiscount: true, faction: null },
};

// ── Road segment map ──────────────────────────────────────────────────────────
// Key = sorted town ids joined by '-'; value = number of walking segments
const ROADS = {
  'bracken_hollow-dawnmark':    2,
  'dawnmark-thornreach':        3,
  'dawnmark-silverkeep':        4,
  'silverkeep-thornreach':    3,
  'stormwatch-thornreach':    4,
  'frostmere-stormwatch':     3,
  'ironhold-stormwatch':      4,
  'ironhold-silverkeep':      4,
  'silverkeep-velmora':       4,
  'duskveil-silverkeep':      3,
  'ironhold-velmora':         3,
  'ironhold-old_karth':       5,
  'graveport-velmora':        4,
  'duskveil-graveport':       3,
  'duskveil-mirefen':         3,
  'graveport-mirefen':        3,
  'ashenfall-mirefen':        5,
  'ashenfall-old_karth':      4,
};

function getRoadSegments(fromId, toId) {
  const key = [fromId, toId].sort().join('-');
  return ROADS[key] || 3;
}

function getWeaponByNum(num) {
  return WEAPONS.find(w => w && w.num === num) || null;
}
function getArmorByNum(num) {
  return ARMORS.find(a => a && a.num === num) || null;
}

// ── Perk system ───────────────────────────────────────────────────────────────
// Perks are earned at levels 3, 6, 9, 12 (one per perk-level milestone).
// Passive stat perks (hp_bonus, def_bonus, str_bonus) are applied immediately
// on selection. Active perks are checked during combat via hasPerk().

const PERKS = {
  // Dread Knight (class 1)
  soul_hunger:       { class: 1, name: 'Soul Hunger',        desc: 'Each kill heals 15% of your max HP.',                                   effect: 'kill_heal' },
  iron_will:         { class: 1, name: 'Iron Will',          desc: '+30 to maximum Hit Points.',                                            effect: 'hp_bonus',  value: 30 },
  terrify:           { class: 1, name: 'Terrify',            desc: 'Your presence causes enemies to flee more often.',                      effect: 'terrify' },
  // Warrior (class 2)
  unbreakable:       { class: 2, name: 'Unbreakable',        desc: 'Shield Slam has a 35% chance to stun the enemy for one round.',        effect: 'power_stun' },
  fortress_stance:   { class: 2, name: 'Fortress Stance',    desc: '+25 permanent Defense.',                                               effect: 'def_bonus', value: 25 },
  battle_cry:        { class: 2, name: 'Battle Cry',         desc: 'Critical hits deal bonus damage equal to 5× your level.',              effect: 'battle_cry' },
  // Rogue (class 3)
  poisoned_blade:    { class: 3, name: 'Poisoned Blade',     desc: 'Your attacks have a 25% chance to poison enemies.',                    effect: 'blade_poison' },
  shadow_step:       { class: 3, name: 'Shadow Step',        desc: 'You deal a free ambush strike at the start of every fight.',           effect: 'first_strike' },
  lucky:             { class: 3, name: 'Lucky',              desc: 'Find 30% more gold from every monster.',                               effect: 'gold_bonus', value: 0.30 },
  // Mage (class 4)
  spell_surge:       { class: 4, name: 'Spell Surge',        desc: 'Your Arcane Surge hits twice.',                                        effect: 'power_double' },
  arcane_skin:       { class: 4, name: 'Arcane Skin',        desc: '+20 permanent Defense from magical wards.',                            effect: 'def_bonus', value: 20 },
  foresight:         { class: 4, name: 'Foresight',          desc: '+20% base flee chance.',                                               effect: 'flee_bonus', value: 0.20 },
  // Ranger (class 5)
  armor_pierce:      { class: 5, name: 'Armor Pierce',       desc: 'Your attacks deal 35% more damage, cutting through all resistance.',   effect: 'armor_pierce', value: 0.35 },
  animal_bond:       { class: 5, name: 'Animal Bond',        desc: 'A wolf companion fights beside you, dealing bonus damage each round.', effect: 'companion' },
  hunters_eye:       { class: 5, name: "Hunter's Eye",       desc: '+8% critical hit chance.',                                             effect: 'crit_bonus', value: 0.08 },
  // Paladin (class 6)
  consecrate:        { class: 6, name: 'Consecrate',         desc: 'Deal double damage to undead enemies.',                                effect: 'undead_bonus' },
  aura_courage:      { class: 6, name: 'Aura of Courage',    desc: '+15 permanent Strength from divine conviction.',                       effect: 'str_bonus', value: 15 },
  lay_on_hands:      { class: 6, name: 'Lay on Hands',       desc: 'Divine Smite heals 20% of max HP instead of 10%.',                    effect: 'smite_heal_boost' },
  // Druid (class 7)
  shapeshift:        { class: 7, name: 'Shapeshift',         desc: 'Bear Form: +40 max HP. The wild also guides your escapes (+15% flee).', effect: 'shapeshift', value: 40 },
  regrowth:          { class: 7, name: 'Regrowth',           desc: 'Regenerate 3% of max HP at the start of each combat round.',           effect: 'round_regen', value: 0.03 },
  thorns:            { class: 7, name: 'Thorns',             desc: 'Reflect 15% of all damage taken back at your attacker.',               effect: 'thorns', value: 0.15 },
  // Necromancer (class 8)
  bone_shield:       { class: 8, name: 'Bone Shield',        desc: 'Absorb up to 20 damage each combat round.',                           effect: 'absorb', value: 20 },
  corpse_explosion:  { class: 8, name: 'Corpse Explosion',   desc: 'On kill, necrotic energy grants +50% gold & exp from the next fight.', effect: 'kill_explosion' },
  dark_pact:         { class: 8, name: 'Dark Pact',          desc: 'Death Coil deals 50% more damage, but costs an additional 10% max HP.', effect: 'dark_pact' },
  // Elementalist (class 9)
  overload:          { class: 9, name: 'Overload',           desc: 'Each attack deals +20% damage, but costs 2% of your max HP.',          effect: 'overload', value: 0.20 },
  elemental_mastery: { class: 9, name: 'Elemental Mastery',  desc: 'Elemental Fury no longer costs HP to cast.',                           effect: 'no_hp_cost' },
  storm_call:        { class: 9, name: 'Storm Call',         desc: 'Your attacks strike in a 2–3 hit chain of lightning.',                 effect: 'multi_hit' },
  // Monk (class 10)
  ki_shield:         { class: 10, name: 'Ki Shield',         desc: '25% chance to completely block an incoming attack.',                   effect: 'block', value: 0.25 },
  pressure_points:   { class: 10, name: 'Pressure Points',   desc: 'Your attacks have a 20% chance to stun the enemy for one round.',     effect: 'stun_chance', value: 0.20 },
  enlightenment:     { class: 10, name: 'Enlightenment',     desc: 'Gain 25% bonus experience from all kills.',                           effect: 'exp_bonus', value: 0.25 },
};

const CLASS_PERKS = {
  1:  ['soul_hunger',  'iron_will',          'terrify'],
  2:  ['unbreakable',  'fortress_stance',    'battle_cry'],
  3:  ['poisoned_blade','shadow_step',       'lucky'],
  4:  ['spell_surge',  'arcane_skin',        'foresight'],
  5:  ['armor_pierce', 'animal_bond',        'hunters_eye'],
  6:  ['consecrate',   'aura_courage',       'lay_on_hands'],
  7:  ['shapeshift',   'regrowth',           'thorns'],
  8:  ['bone_shield',  'corpse_explosion',   'dark_pact'],
  9:  ['overload',     'elemental_mastery',  'storm_call'],
  10: ['ki_shield',    'pressure_points',    'enlightenment'],
};

function getPerksForClass(classId) {
  return (CLASS_PERKS[classId] || []).map(id => ({ id, ...PERKS[id] }));
}

// ── Specialisation (skill tree) system ────────────────────────────────────────
// Players choose one of two paths at level 6 (one-time, permanent).
// Passive stat bonuses (def_bonus, str_bonus, hp_bonus) are applied on selection.
// Active effects are checked during combat via hasSpec().

const SPECIALIZATIONS = {
  // Dread Knight (class 1)
  berserker:    { class: 1, name: 'Berserker',     desc: 'Each round costs 3% max HP, but all attacks deal +50% damage. Pure aggression.' },
  warlord:      { class: 1, name: 'Warlord',       desc: 'Each kill builds Intimidation (max 3 stacks). Each stack adds +10% damage to the next fight.' },
  // Warrior (class 2)
  guardian:     { class: 2, name: 'Guardian',      desc: '+30 permanent Defense. Shield Slam stun chance increases to 60%.', effect: 'def_bonus', value: 30 },
  champion:     { class: 2, name: 'Champion',      desc: '+20 permanent Strength. Guaranteed critical hit when you drop below 35% HP.', effect: 'str_bonus', value: 20 },
  // Rogue (class 3)
  assassin:     { class: 3, name: 'Assassin',      desc: 'Shadow Step ambush is always a critical hit. +15% base crit chance on all attacks.' },
  trickster:    { class: 3, name: 'Trickster',     desc: '30% chance to dodge all incoming damage each round. Dodges trigger a counter-attack.' },
  // Mage (class 4)
  conjurer:     { class: 4, name: 'Conjurer',      desc: 'A shadow minion fights beside you, dealing 15% of your Strength as bonus damage each round.' },
  enchanter:    { class: 4, name: 'Enchanter',     desc: '25% chance each fight to charm the enemy — it flees for full gold and exp without combat.' },
  // Ranger (class 5)
  beastmaster:  { class: 5, name: 'Beastmaster',   desc: 'Animal Bond companion deals double damage. 20% chance per round the companion intercepts monster attacks.' },
  strider:      { class: 5, name: 'Strider',       desc: 'You always strike first in combat. +10% flee chance.' },
  // Paladin (class 6)
  inquisitor:   { class: 6, name: 'Inquisitor',    desc: 'Triple damage vs undead (×6 with Consecrate). 15% stun chance on every hit.' },
  templar:      { class: 6, name: 'Templar',       desc: 'Each kill grants +1 Knights and Merchants rep. Divine Smite heals 35% HP instead of 20%.' },
  // Druid (class 7)
  shapeshifter: { class: 7, name: 'Shapeshifter',  desc: 'Shapeshift grants +20 additional max HP. You are immune to poison in combat.', effect: 'hp_bonus', value: 20 },
  stormcaller:  { class: 7, name: 'Stormcaller',   desc: 'Regrowth also zaps the enemy for 3% of your max HP as lightning damage each round.' },
  // Necromancer (class 8)
  lichborn:     { class: 8, name: 'Lichborn',      desc: 'Once per day, instead of dying, you survive with 1 HP. Death does not claim you easily.' },
  plague_doctor:{ class: 8, name: 'Plague Doctor', desc: 'Poisoned Blade ticks twice per round. Attacks have a 25% chance to disease enemies, reducing their damage by 15%.' },
  // Elementalist (class 9)
  invoker:      { class: 9, name: 'Invoker',       desc: 'Elemental Fury deals double damage, but always costs 15% max HP — even with Elemental Mastery.' },
  arcanist:     { class: 9, name: 'Arcanist',      desc: 'Power moves have a 35% chance to trigger a free second cast at half power.' },
  // Monk (class 10)
  iron_fist:    { class: 10, name: 'Iron Fist',    desc: 'All attacks deal +25% damage. Pressure Points stuns last 2 rounds instead of 1.' },
  wind_walker:  { class: 10, name: 'Wind Walker',  desc: 'Ki Shield block chance increased to 40%. Blocked attacks trigger a counter-strike.' },
};

const CLASS_SPECS = {
  1:  ['berserker',    'warlord'],
  2:  ['guardian',     'champion'],
  3:  ['assassin',     'trickster'],
  4:  ['conjurer',     'enchanter'],
  5:  ['beastmaster',  'strider'],
  6:  ['inquisitor',   'templar'],
  7:  ['shapeshifter', 'stormcaller'],
  8:  ['lichborn',     'plague_doctor'],
  9:  ['invoker',      'arcanist'],
  10: ['iron_fist',    'wind_walker'],
};

function getSpecsForClass(classId) {
  return (CLASS_SPECS[classId] || []).map(id => ({ id, ...SPECIALIZATIONS[id] }));
}

function hasSpec(player, specId) {
  return (player.specialization || '') === specId;
}

// ── Named enemy name generation ───────────────────────────────────────────────

const NAMED_ENEMY_POOL = {
  firstNames: [
    'Gorath', 'Silkfang', 'Krix', 'Morrigan', 'Vorn', 'Thrak',
    'Grimtooth', 'Venomtail', 'Plaguerot', 'Wretchwail', 'Brutus',
    'Hexor', 'Gnarlfang', 'Ashbane', 'Skullrot', 'Dreadmaw',
    'Gutripper', 'Ironhide', 'Shadowfen', 'Coldblood', 'Wraithbone',
    'Thornback', 'Bleakfang', 'Scelus', 'Ravagore',
  ],
  epithets: [
    'the Bonebreaker', 'the Merciless', 'the Undying', 'the Accursed',
    'the Ancient', 'the Forsaken', 'the Pale', 'the Cruel',
    'the Ravager', 'the Desolate', 'the Damned', 'the Eternal',
    'the Dreadful', 'the Vile', 'the Hollow', 'the Hateful',
  ],
  killTitles: [
    'Dragonkiller', 'Bloodsoaked', 'Manslayer', 'Doombranded',
    'Deathbringer', 'Soulreaper', 'Fleshrender', 'Warbringer',
    'the Notorious', 'the Infamous', 'the Feared',
  ],
};

function generateNamedEnemyName() {
  const { firstNames, epithets } = NAMED_ENEMY_POOL;
  const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
  const ep = epithets[Math.floor(Math.random() * epithets.length)];
  return `${fn} ${ep}`;
}

function pickKillTitle() {
  const { killTitles } = NAMED_ENEMY_POOL;
  return killTitles[Math.floor(Math.random() * killTitles.length)];
}

// ── Named & cursed items ──────────────────────────────────────────────────────
// Named items drop from named enemies (25%) or rare forest chance (1%).
// Cursed items are sold only at the Duskveil black market.
// Cursed items cannot be unequipped once worn.
const NAMED_ITEMS = {
  // ── Hunt reward weapons (top weekly hunter) ───────────────────────────────
  pale_wanderer_fang: {
    type: 'weapon', name: 'Fang of the Pale Wanderer', cursed: false,
    strength: 60, tier: 5,
    effect: 'poison_on_hit', effectDesc: '35% chance to poison on hit',
    lore: "The tooth of a legendary wraith, still cold to the touch.",
  },
  goraths_club: {
    type: 'weapon', name: "Gorath's Bonebreaker", cursed: false,
    strength: 95, tier: 7,
    effect: 'stun', effectDesc: '15% chance to stun the enemy on hit',
    lore: "The war-club of Gorath the legendary troll. Heavier than it looks.",
  },
  silkfangs_stinger: {
    type: 'weapon', name: "Silkfang's Stinger", cursed: false,
    strength: 65, tier: 5,
    effect: 'poison_on_hit', effectDesc: '40% chance to poison; always poisons on power strike',
    lore: "Harvested from the queen of spiders at the moment of her death.",
  },
  hunters_iron: {
    type: 'weapon', name: "The Hunter's Iron", cursed: false,
    strength: 85, tier: 6,
    effect: 'double_strike', effectDesc: '25% chance to strike twice per attack',
    lore: "Awarded only to the greatest hunter of the week. The weight of reputation.",
  },
  wardens_edge: {
    type: 'weapon', name: "Warden's Edge", cursed: false,
    strength: 110, tier: 8,
    effect: 'warden_seal', effectDesc: '+30% damage; glows bright near void creatures',
    lore: "One of the last blades forged by the Wardens. It still remembers its purpose.",
  },

  // ── Named weapons ────────────────────────────────────────────────────────────
  widows_fang: {
    type: 'weapon', name: "Widow's Fang", cursed: false,
    strength: 45, tier: 4,
    effect: 'poison_on_hit', effectDesc: '25% chance to poison the enemy on hit',
    lore: "A slender blade the colour of a clouded moon. The edge never quite loses its venom.",
  },
  sunbreaker: {
    type: 'weapon', name: 'Sunbreaker', cursed: false,
    strength: 80, tier: 6,
    effect: 'undead_bonus', effectDesc: '+60% damage vs undead enemies',
    lore: "Forged under a solar eclipse. The runes on the flat glow faintly near the undead.",
  },
  oathkeeper: {
    type: 'weapon', name: 'Oathkeeper', cursed: false,
    strength: 120, tier: 8,
    effect: 'oath_break', effectDesc: 'Shatters permanently if you commit a chaotic act',
    lore: "Sworn blades cannot serve the faithless. It will know if you break yours.",
  },
  // ── Cursed weapons ────────────────────────────────────────────────────────────
  blooddrinker: {
    type: 'weapon', name: 'Blooddrinker', cursed: true,
    strength: 200, tier: 10,
    effect: 'life_drain', effectDesc: 'Drains 15% of damage dealt back as HP',
    lore: "A blackened blade that seems to lean toward living things. It is never sated.",
  },
  // ── Named armors ─────────────────────────────────────────────────────────────
  cowards_cloak: {
    type: 'armor', name: "The Coward's Cloak", cursed: false,
    defense: 15, tier: 3, strPenalty: -10,
    effect: 'flee_bonus', effectDesc: '+25% flee chance, −10 Strength (permanent while worn)',
    lore: "Enchanted to blur the outline of the wearer. The enchantment has opinions about fighting.",
  },
  // ── Cursed armors ─────────────────────────────────────────────────────────────
  voidplate: {
    type: 'armor', name: 'Voidplate', cursed: true,
    defense: 500, tier: 13,
    effect: 'soul_drain', effectDesc: '−1 Charm per day',
    lore: "Armour hammered from condensed shadow. It hungers. Every day, a little more.",
  },
};

// Returns a random non-cursed named item suitable for a drop at the given level.
// includeCursed is only set true for the Duskveil market flow (not drops).
function getNamedItemDrop(level, includeCursed = false) {
  const pool = Object.entries(NAMED_ITEMS)
    .filter(([, item]) => !item.cursed || includeCursed)
    .map(([id, item]) => ({ id, ...item }));
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function hasPerk(player, perkId) {
  try {
    const perks = typeof player.perks === 'string' ? JSON.parse(player.perks) : (player.perks || []);
    return Array.isArray(perks) && perks.includes(perkId);
  } catch { return false; }
}

// ── Weekly hunt monster pool ──────────────────────────────────────────────────
// Monsters that can appear as weekly hunt targets, grouped by rough difficulty.
const HUNT_MONSTER_POOL = [
  // Tier 1 — early-game creatures
  { name: 'Giant Rat',      rank: 1 },
  { name: 'Cave Goblin',    rank: 1 },
  { name: 'Zombie',         rank: 1 },
  { name: 'Skeleton',       rank: 1 },
  // Tier 2
  { name: 'Orc Warrior',    rank: 2 },
  { name: 'Ghoul',          rank: 2 },
  { name: 'Wererat',        rank: 2 },
  { name: 'Harpy',          rank: 2 },
  // Tier 3
  { name: 'Dark Elf',       rank: 3 },
  { name: 'Werewolf',       rank: 3 },
  { name: 'Gnoll',          rank: 3 },
  { name: 'Forest Witch',   rank: 3 },
  // Tier 4
  { name: 'Cave Troll',     rank: 4 },
  { name: 'Orc Chief',      rank: 4 },
  { name: 'Ghast',          rank: 4 },
  { name: 'Dark Elf Mage',  rank: 4 },
  // Tier 5 — late-game
  { name: 'Bandit King',    rank: 5 },
  { name: 'Gargoyle',       rank: 5 },
];

// Hunt rewards scale with difficulty rank
const HUNT_RANK_REWARDS = {
  1: { kill_bonus_gold:   500, kill_bonus_exp:   250 },
  2: { kill_bonus_gold:  1500, kill_bonus_exp:   750 },
  3: { kill_bonus_gold:  4000, kill_bonus_exp:  2000 },
  4: { kill_bonus_gold: 10000, kill_bonus_exp:  5000 },
  5: { kill_bonus_gold: 25000, kill_bonus_exp: 12500 },
};

// Unique hunt weapons cycled as top-hunter prizes (week_number % length)
const HUNT_PRIZE_ITEMS = [
  'pale_wanderer_fang',
  'goraths_club',
  'silkfangs_stinger',
  'hunters_iron',
  'wardens_edge',
];

module.exports = {
  WEAPONS, ARMORS, RED_DRAGON, CHAMPION_DRAGONS, getChampionDragon,
  CLASS_START_HP, CLASS_START_STR, PRESTIGE_TITLES, getPrestigeTitle,
  MONSTER_TEMPLATES, TOWNS, ROADS,
  SOCIAL_SPACES, SHOP_OWNERS,
  getMonster, getRandomMonster,
  getWeaponByNum, getArmorByNum,
  getRoadSegments,
  expForLevel, expForNextLevel, EXP_TABLE,
  CLASS_NAMES, CLASS_POWER_MOVES, LEVEL_UP_GAINS,
  PERKS, CLASS_PERKS, getPerksForClass, hasPerk,
  SPECIALIZATIONS, CLASS_SPECS, getSpecsForClass, hasSpec,
  NAMED_ENEMY_POOL, generateNamedEnemyName, pickKillTitle,
  NAMED_ITEMS, getNamedItemDrop,
  HUNT_MONSTER_POOL, HUNT_RANK_REWARDS, HUNT_PRIZE_ITEMS,
};
