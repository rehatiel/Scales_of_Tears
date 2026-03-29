-- 002_seed.sql
-- All static game data for Scales of Tears.
-- Safe to re-apply — every INSERT uses ON CONFLICT DO NOTHING.

-- ── Weapons ───────────────────────────────────────────────────────────────────

INSERT INTO weapons (num, name, price, strength, tier, bonus, bonus_desc) VALUES
  (1,  'Stick',          200,        5,    1, NULL, NULL),
  (2,  'Dagger',         1000,       10,   2, NULL, NULL),
  (3,  'Short Sword',    3000,       20,   3, NULL, NULL),
  (4,  'Long Sword',     10000,      30,   4, NULL, NULL),
  (5,  'Huge Axe',       30000,      40,   5, NULL, NULL),
  (6,  'Bone Cruncher',  100000,     60,   6, NULL, NULL),
  (7,  'Twin Swords',    150000,     80,   7, NULL, NULL),
  (8,  'Power Axe',      200000,     120,  8, NULL, NULL),
  (9,  'Able''s Sword',  400000,     180,  9, NULL, NULL),
  (10, 'Wan''s Weapon',  1000000,    250,  10, NULL, NULL),
  (11, 'Spear Of Gold',  4000000,    350,  11, NULL, NULL),
  (12, 'Crystal Shard',  10000000,   500,  12, NULL, NULL),
  (13, 'Nira''s Teeth',  40000000,   800,  13, NULL, NULL),
  (14, 'Blood Sword',    100000000,  1200, 14, NULL, NULL),
  (15, 'Death Sword',    400000000,  1800, 15, NULL, NULL),
  (16, 'Hunting Spear',  3200,       17,   3, 'flee_bonus',    'Lightweight — +8% flee chance'),
  (17, 'War Mace',       9800,       28,   4, 'stun',          '12% chance to stun foe for one round'),
  (18, 'Battlehammer',   29000,      35,   5, 'armor_pierce',  'Ignores 30% of enemy armor'),
  (19, 'Twin Daggers',   95000,      55,   6, 'double_strike', '20% chance to strike twice')
ON CONFLICT (num) DO NOTHING;

-- ── Armors ────────────────────────────────────────────────────────────────────

INSERT INTO armors (num, name, price, defense, tier, bonus, bonus_desc) VALUES
  (1,  'Coat',             200,        1,    1, NULL, NULL),
  (2,  'Heavy Coat',       1000,       3,    2, NULL, NULL),
  (3,  'Leather Vest',     3000,       10,   3, NULL, NULL),
  (4,  'Bronze Armour',    10000,      15,   4, NULL, NULL),
  (5,  'Iron Armour',      30000,      25,   5, NULL, NULL),
  (6,  'Graphite Armour',  100000,     35,   6, NULL, NULL),
  (7,  'Erdrick''s Armour',150000,     50,   7, NULL, NULL),
  (8,  'Armour Of Death',  200000,     75,   8, NULL, NULL),
  (9,  'Able''s Armour',   400000,     100,  9, NULL, NULL),
  (10, 'Full Body Armour', 1000000,    150,  10, NULL, NULL),
  (11, 'Blood Armour',     4000000,    225,  11, NULL, NULL),
  (12, 'Magic Protection', 10000000,   300,  12, NULL, NULL),
  (13, 'Belar''s Mail',    40000000,   400,  13, NULL, NULL),
  (14, 'Golden Armour',    100000000,  600,  14, NULL, NULL),
  (15, 'Armour Of Lore',   400000000,  1000, 15, NULL, NULL),
  (16, 'Scale Mail',       3200,       8,    3, 'poison_resist', '50% chance to resist poison'),
  (17, 'Padded Armour',    9500,       12,   4, 'regen',         'Recover 2 HP per combat round'),
  (18, 'Studded Leather',  28000,      22,   5, 'evasion',       '15% chance to evade monster attack'),
  (19, 'Battle Plate',     95000,      32,   6, 'thorns',        'Reflect 10 damage to attacker per hit')
ON CONFLICT (num) DO NOTHING;

-- ── Monsters ──────────────────────────────────────────────────────────────────

INSERT INTO monsters (level, sort_order, name, weapon, str_mult, hp_mult, gold_mult, exp_mult, behavior, meet_text, death_text) VALUES
-- Level 1
(1,  0,  'Forest Sprite',      'tiny claws',       0.5, 0.6, 0.8, 0.8, 'fleeing',   'A Forest Sprite darts from the shadows, claws crackling with dark energy!',                                   'The sprite bursts into a shower of coloured sparks!'),
(1,  1,  'Giant Rat',          'sharp teeth',       0.6, 0.7, 0.7, 0.7, NULL,        'An enormous yellow-eyed Giant Rat erupts from the undergrowth, teeth snapping!',                             'The rat lets out one final squeal and goes still!'),
(1,  2,  'Cave Goblin',        'crude club',        0.8, 0.9, 1.0, 1.0, NULL,        'A Cave Goblin drops from the branches above with a blood-curdling shriek!',                                  'The goblin crumples to the earth with a satisfying thud!'),
(1,  3,  'Rabid Dog',          'vicious bite',      0.7, 0.8, 0.6, 0.8, 'aggressive','A foam-mouthed Rabid Dog charges straight for your throat!',                                                  'The dog yelps once and collapses in a heap!'),
(1,  4,  'Zombie',             'rotting claws',     0.9, 1.2, 0.9, 1.1, NULL,        'A Zombie hauls itself out of the rotting leaves and staggers toward you!',                                    'The zombie finally, mercifully, stays dead!'),
(1,  5,  'Wild Boar',          'razor tusks',       1.0, 1.1, 0.8, 1.0, 'aggressive','A Wild Boar crashes through the bushes, razor tusks gleaming and aimed at you!',                              'The boar squeals, tumbles, and lies still!'),
(1,  6,  'Dark Fairy',         'poison barb',       0.7, 0.6, 1.2, 1.2, 'venomous',  'A Dark Fairy materialises in a burst of black sparks, grinning with wicked intent!',                          'The dark fairy shrieks and dissolves into smoke and shadow!'),
(1,  7,  'Skeleton',           'bone sword',        0.9, 0.9, 0.9, 0.9, NULL,        'Bones scatter and reassemble — a Skeleton lurches upright and raises its sword!',                            'The skeleton shatters into a pile of harmless bones!'),
(1,  8,  'Slime Monster',      'acidic touch',      0.4, 1.5, 0.5, 0.7, 'venomous',  'The ground bubbles and heaves as a Slime Monster oozes hungrily toward you!',                                'The slime splashes apart with a nauseating wet sound!'),
(1,  9,  'Lost Beggar',        'broken bottle',     0.6, 0.7, 0.4, 0.6, 'fleeing',   'A wild-eyed Beggar leaps from the shadows, clutching a jagged bottle!',                                      'The beggar collapses face-first and does not rise!'),
(1,  10, 'Wererat',            'filthy claws',      1.1, 1.0, 1.1, 1.3, NULL,        'A hunched figure shudders and transforms horribly into a Wererat — then lunges!',                            'The wererat transforms back into a very dead man!'),
-- Level 2
(2,  0,  'Orc Warrior',        'jagged axe',        0.9, 1.0, 1.0, 1.0, NULL,        'An Orc Warrior steps from behind a gnarled oak, war axe already raised!',                                    'The orc gurgles, drops its axe, and falls!'),
(2,  1,  'Harpy',              'razor talons',      0.8, 0.8, 1.1, 1.1, 'fleeing',   'A Harpy dives from the canopy with a screech that shakes the very leaves!',                                   'The harpy plummets from the air, dead before it hits the ground!'),
(2,  2,  'Bandit',             'short sword',       1.0, 0.9, 1.5, 1.0, 'fleeing',   '"Your gold or your life!" A scarred Bandit steps onto the path, blade drawn.',                                 'The bandit clutches his chest and crumples to the forest floor!'),
(2,  3,  'Lizard Man',         'stone spear',       0.9, 1.1, 0.9, 0.9, NULL,        'A Lizard Man rises from the swamp mud, hissing, spear leveled at your chest!',                               'The lizard man hisses its last rattling breath!'),
(2,  4,  'Ghoul',              'paralyzing touch',  1.0, 1.2, 0.8, 1.2, NULL,        'A Ghoul lurches from an open grave, its paralyzing touch already reaching for you!',                          'The ghoul dissolves into foul-smelling smoke and rags!'),
(2,  5,  'Dark Elf',           'shadow blade',      1.1, 0.9, 1.3, 1.3, NULL,        'A Dark Elf melts from the shadows, shadow blade humming with dark energy!',                                    'The dark elf crumbles into darkness with a final curse!'),
(2,  6,  'Imp',                'fire breath',       0.7, 0.7, 0.7, 0.8, 'fleeing',   'A tiny red Imp pops into existence with a BANG, fire already billowing from its maw!',                        'The imp pops out of existence with an anticlimactic bang!'),
(2,  7,  'Werewolf',           'savage claws',      1.2, 1.1, 0.9, 1.4, 'aggressive','The moon breaks through the canopy — too late you realise what that means. A Werewolf howls!',                'The werewolf collapses and transforms back into a peaceful-looking corpse!'),
(2,  8,  'Vampire Bat',        'draining bite',     0.8, 0.7, 0.8, 0.9, 'venomous',  'A Vampire Bat drops silently from above, fangs gleaming in the moonlight!',                                   'The vampire bat bursts into flame and collapses to ash!'),
(2,  9,  'Gnoll',              'bone flail',        1.0, 1.0, 1.0, 1.0, NULL,        'A Gnoll warrior blocks the path, bone flail swinging in lazy confident circles!',                             'The gnoll crashes to the earth with a thunderous boom!'),
(2,  10, 'Forest Witch',       'dark magic',        1.1, 0.8, 1.4, 1.5, NULL,        'An ancient Forest Witch materialises from the mist, dark spells coiling around her fingers!',                 'The witch shrieks, explodes in a flash of sickly light, and is gone!'),
-- Level 3
(3,  0,  'Orc Chief',          'war hammer',        1.1, 1.2, 1.2, 1.1, NULL,        'The Orc Chief roars a war cry that echoes through the entire forest!',                                        'The orc chief falls with a ground-shaking crash!'),
(3,  1,  'Gargoyle',           'stone claws',       1.0, 1.4, 0.9, 1.0, NULL,        'Stone chips fly as a Gargoyle tears itself from its perch and dives straight at you!',                        'The gargoyle shatters into a hundred stone pieces!'),
(3,  2,  'Bandit King',        'enchanted blade',   1.2, 1.0, 1.8, 1.2, NULL,        '"Finally, a worthy victim." The Bandit King steps forward, enchanted blade gleaming.',                        'The bandit king dies cursing your name — and meaning it as a compliment!'),
(3,  3,  'Cave Troll',         'massive fists',     1.3, 1.5, 0.8, 1.1, NULL,        'The ground trembles as a Cave Troll crashes through the undergrowth straight at you!',                        'The cave troll topples like a great tree — slowly, then all at once!'),
(3,  4,  'Ghast',              'necrotic claws',    1.1, 1.1, 0.9, 1.3, NULL,        'A wave of sickening cold washes over you as a Ghast rises from the earth!',                                  'The ghast screams in silence and fades to nothing!'),
(3,  5,  'Dark Elf Mage',      'shadow spells',     1.2, 0.9, 1.5, 1.5, NULL,        'A Dark Elf Mage steps through a rift of shadow, death spells already forming!',                              'The dark elf mage implodes in a supernova of shadow!'),
(3,  6,  'Succubus',           'charm touch',       1.0, 0.9, 1.6, 1.4, NULL,        'The air shimmers and a Succubus appears — her smile is beautiful, and utterly deadly!',                       'The succubus wails and vanishes in a pillar of hellfire!'),
(3,  7,  'Gnoll Champion',     'serrated axe',      1.2, 1.2, 1.1, 1.2, NULL,        'The Gnoll Champion beats its chest once and charges with terrifying speed!',                                  'The gnoll champion dies with a warrior''s honour!'),
(3,  8,  'Giant Spider',       'venomous fangs',    0.9, 1.0, 0.7, 0.9, 'venomous',  'Eight cold eyes glitter in the dark above — a Giant Spider descends on silken thread!',                       'The giant spider writhes, curls its legs, and goes still!'),
(3,  9,  'Forest Ogre',        'spiked club',       1.3, 1.4, 0.9, 1.0, NULL,        'A Forest Ogre rips up a young oak and hurls it aside as it spots you!',                                      'The ogre crashes to the ground and shakes the trees for a hundred yards!'),
(3,  10, 'Wraith',             'life drain',        1.1, 1.0, 1.3, 1.6, NULL,        'The temperature plummets — a Wraith rises from the earth, reaching for your very soul!',                     'The wraith lets out a silent scream and dissipates into cold air!'),
-- Level 4
(4,  0,  'Troll Warrior',      'iron maul',         1.2, 1.3, 1.1, 1.1, NULL,        'A Troll Warrior bellows and swings its iron maul in a deadly arc toward you!',                               'The troll warrior falls face-first into the mud!'),
(4,  1,  'Stone Golem',        'granite fists',     1.1, 1.8, 0.8, 1.0, 'defensive', 'Ancient runes flare as a Stone Golem lurches to life, hollow eyes fixing on you!',                            'The stone golem cracks and crumbles to a pile of rubble!'),
(4,  2,  'Wyvern',             'acid spit',         1.3, 1.2, 1.4, 1.4, 'venomous',  'A Wyvern plummets from the treetops, acid already dripping from its jaws!',                                   'The wyvern crashes to earth with a tremendous, final boom!'),
(4,  3,  'Dark Wizard',        'death bolt',        1.4, 0.9, 1.7, 1.6, NULL,        'A Dark Wizard steps from a portal of shadow, death bolt crackling in his hand!',                              'The dark wizard explodes in a shower of dark energy!'),
(4,  4,  'Lich',               'soul siphon',       1.3, 1.1, 1.5, 1.7, NULL,        'The stench of ages overwhelms you as a Lich rises, hollow sockets locked on your soul!',                     'The lich crumbles to ancient dust and silence!'),
(4,  5,  'Minotaur',           'battleaxe',         1.4, 1.3, 1.0, 1.2, 'aggressive','Trees splinter as a raging Minotaur plows through the forest straight at you!',                                'The minotaur bellows once and falls — shaking the ground!'),
(4,  6,  'Manticore',          'poison spines',     1.2, 1.2, 1.3, 1.3, 'venomous',  'A Manticore lands in your path, poison spines fanned out, tail poised to strike!',                            'The manticore collapses in a writhing, poisonous heap!'),
(4,  7,  'Weredragon',         'fire breath',       1.5, 1.2, 1.2, 1.5, NULL,        'A man screams as he transforms into a horrifying Weredragon before your eyes!',                               'The weredragon transforms back into a very dead man!'),
(4,  8,  'Cyclops',            'giant boulder',     1.3, 1.4, 1.1, 1.1, NULL,        'A Cyclops spots you with its bloodshot eye and reaches for a boulder the size of a cart!',                   'The cyclops topples with a rumble that shakes the forest floor!'),
(4,  9,  'Forest Giant',       'uprooted tree',     1.2, 1.6, 0.9, 1.0, NULL,        'The sky darkens as a Forest Giant looms over the treeline, massive fist already swinging!',                  'The giant falls and levels a dozen trees on the way down!'),
(4,  10, 'Gorgon',             'petrifying gaze',   1.1, 1.0, 1.4, 1.4, NULL,        'You avert your eyes just in time as a Gorgon''s petrifying gaze sweeps toward you!',                         'The gorgon shatters like the statues it creates!'),
-- Level 5
(5,  0,  'Mountain Troll',     'spiked maul',       1.3, 1.4, 1.1, 1.1, NULL,        'A Mountain Troll tears itself from the cliff face and lands with a thunderous crash!',                        'The mountain troll crashes down like a landslide!'),
(5,  1,  'Earth Golem',        'crushing fists',    1.2, 2.0, 0.9, 1.0, 'defensive', 'The earth itself rises and reshapes — an Earth Golem stands before you, fists like boulders!',                'The earth golem fractures and falls apart piece by piece!'),
(5,  2,  'Basilisk',           'stone gaze',        1.2, 1.3, 1.3, 1.3, 'venomous',  'A Basilisk slithers from beneath a slab of stone, its deadly gaze sweeping toward you!',                     'The basilisk thrashes wildly and lies still!'),
(5,  3,  'Necromancer',        'death wave',        1.5, 1.0, 1.8, 1.8, NULL,        'A Necromancer materialises from black smoke, death wave rippling from his fingertips!',                       'The necromancer screams — and the dead do not rise again!'),
(5,  4,  'Death Knight',       'soul reaper',       1.6, 1.3, 1.5, 1.6, NULL,        'A Death Knight of the dark realm steps through shadow, soul reaper humming!',                                 'The death knight falls, his dark armour clattering to the ground!'),
(5,  5,  'Iron Golem',         'iron fists',        1.3, 1.8, 1.0, 1.1, 'defensive', 'A screech of metal on metal heralds an Iron Golem as it lumbers from between the trees!',                     'The iron golem seizes up and topples to the earth!'),
(5,  6,  'Chimera',            'triple strike',     1.4, 1.4, 1.4, 1.4, 'aggressive','Three heads snarl in unison as a Chimera rounds a boulder and charges!',                                       'Each of the chimera''s three heads lets out its own dying scream!'),
(5,  7,  'Blood Elemental',    'hemorrhage',        1.3, 1.5, 1.2, 1.5, 'aggressive','The air reeks of copper as a Blood Elemental materialises, crimson and ravenous!',                             'The blood elemental splashes apart in a crimson wave!'),
(5,  8,  'Frost Giant',        'glacier club',      1.4, 1.5, 1.0, 1.1, NULL,        'The temperature plummets as a Frost Giant steps from the frozen north, club raised!',                         'The frost giant shatters like an avalanche!'),
(5,  9,  'Storm Giant',        'lightning bolt',    1.5, 1.4, 1.1, 1.2, NULL,        'Lightning splits a tree as a Storm Giant leaps down from the storm clouds above!',                            'The storm giant falls with a crack of thunder that shakes the sky!'),
(5,  10, 'Shadow Demon',       'void touch',        1.4, 1.2, 1.6, 1.7, NULL,        'Your shadow detaches from the ground and lunges — a Shadow Demon, wearing your own form!',                    'The shadow demon dissolves as the light catches it!'),
-- Level 6
(6,  0,  'Greater Troll',      'runed maul',        1.4, 1.5, 1.2, 1.2, NULL,        'A Greater Troll shakes the earth with each step as it bears down on you!',                                    'The greater troll lets out its last bellow and falls!'),
(6,  1,  'Fire Golem',         'magma fists',       1.4, 1.7, 1.0, 1.1, NULL,        'The forest ignites around you as a Fire Golem steps from the inferno, fists of magma raised!',               'The fire golem cools and crumbles to slag!'),
(6,  2,  'Medusa',             'stone gaze',        1.3, 1.2, 1.7, 1.6, NULL,        'You keep your eyes averted as Medusa''s serpentine hair hisses around her, seeking your gaze!',              'Medusa''s head falls — and her terrible gaze is extinguished forever!'),
(6,  3,  'Arch Lich',          'death cascade',     1.6, 1.2, 2.0, 2.0, NULL,        'Reality cracks as an Arch Lich tears its way into your world, death cascade already beginning!',             'The arch lich crumbles to dust and silence!'),
(6,  4,  'Dark Lord''s Knight','cursed lance',      1.7, 1.4, 1.6, 1.6, NULL,        'The Dark Lord''s Knight rides a shadow stallion from the darkness, cursed lance leveled at you!',            'The dark knight falls, black armour clanging!'),
(6,  5,  'Mithril Golem',      'mithril fists',     1.5, 2.0, 1.1, 1.2, 'defensive', 'The sound of tolling bells accompanies a Mithril Golem as it strides from the ancient ruin!',                 'The mithril golem seizes up and topples with a bell-like crash!'),
(6,  6,  'Hydra',              'seven-head bite',   1.5, 1.8, 1.3, 1.4, NULL,        'Seven heads snap and weave as a Hydra erupts from the dark pool, all eyes locked on you!',                   'All seven heads of the hydra droop and go still at last!'),
(6,  7,  'War Daemon',         'hellfire strike',   1.7, 1.3, 1.5, 1.7, NULL,        'The sky tears open and a War Daemon drops through the wound, hellfire raging around it!',                    'The war daemon howls and is dragged screaming back to the Abyss!'),
(6,  8,  'Frost Dragon',       'blizzard breath',   1.6, 1.6, 1.8, 1.8, NULL,        'A Frost Dragon explodes from beneath the frozen lake, ice and fury!',                                         'The frost dragon crashes to earth in a shower of ice and silence!'),
(6,  9,  'Thunder Giant',      'storm hammer',      1.5, 1.6, 1.1, 1.2, NULL,        'A Thunder Giant descends from storm clouds on a bolt of lightning, hammer raised!',                           'The thunder giant falls and shakes the ground for miles!'),
(6,  10, 'Greater Shadow',     'soul rend',         1.5, 1.4, 1.9, 1.9, NULL,        'The world dims as a Greater Shadow swells from every dark corner, surrounding you!',                          'The greater shadow shreds apart as the light of dawn touches it!'),
-- Level 7
(7,  0,  'Elder Troll',        'ancient maul',      1.5, 1.6, 1.3, 1.3, NULL,        'An Elder Troll, ancient as the mountains, rises from its centuries-long slumber!',                            'The elder troll falls with a titanic crash!'),
(7,  1,  'Chaos Elemental',    'chaos storm',       1.6, 1.5, 1.4, 1.5, NULL,        'Reality splinters as a Chaos Elemental tears itself into existence, howling!',                                'The chaos elemental unravels into nothing!'),
(7,  2,  'Dragon Spawn',       'claw and fang',     1.7, 1.6, 1.7, 1.7, NULL,        'A Dragon Spawn crashes through an ancient wall, roaring its terrible heritage!',                              'The dragon spawn lets out a dying roar that shakes the sky!'),
(7,  3,  'Lich King',          'oblivion',          1.8, 1.3, 2.2, 2.2, NULL,        'Silence falls like a hammer as the Lich King materialises, reality rotting around it!',                       'The lich king dissolves, releasing countless bound souls!'),
(7,  4,  'Demon Lord',         'hellgate slash',    1.9, 1.5, 1.8, 1.8, NULL,        'The sky goes black as a Demon Lord tears its way from the Abyss, hellgate slash raised!',                    'The demon lord roars and is banished back to the pit!'),
(7,  5,  'Ancient Golem',      'titan fists',       1.6, 2.2, 1.1, 1.2, 'defensive', 'The earth heaves as an Ancient Golem, dormant for millennia, finally rises!',                                  'The ancient golem shatters into a thousand shards!'),
(7,  6,  'Void Weaver',        'reality tear',      1.7, 1.4, 1.9, 2.0, NULL,        'Reality tears as a Void Weaver threads the seams of the world apart from within!',                            'The void weaver collapses as reality repairs itself around it!'),
(7,  7,  'Storm Dragon',       'lightning storm',   1.8, 1.7, 1.9, 1.9, NULL,        'The heavens erupt as a Storm Dragon descends through the lightning, roaring in fury!',                        'The storm dragon crashes to earth with a thunderclap heard for leagues!'),
(7,  8,  'Giant Destroyer',    'sky boulder',       1.6, 1.8, 1.2, 1.3, NULL,        'The horizon darkens as a Giant Destroyer clears the treeline in a single stride!',                            'The giant destroyer falls and levels the forest for a mile around!'),
(7,  9,  'Shadow Titan',       'darkness',          1.7, 1.6, 2.0, 2.0, NULL,        'The sun goes out as a Shadow Titan rises, its darkness absolute and total!',                                  'The shadow titan crumbles as dawn breaks through!'),
(7,  10, 'Abyssal Horror',     'sanity shatter',    1.8, 1.5, 2.1, 2.1, NULL,        'The ground cracks open and an Abyssal Horror pulls itself up from the void below!',                           'The abyssal horror collapses back into the void with a shriek!'),
-- Level 8
(8,  0,  'Titan Troll',        'legendary maul',    1.7, 1.8, 1.4, 1.4, NULL,        'The mountain itself shakes as a Titan Troll stands and turns its ancient fury on you!',                       'The titan troll falls and the earth cracks beneath it!'),
(8,  1,  'Doomsday Golem',     'apocalypse fists',  1.7, 2.5, 1.2, 1.2, 'defensive', 'Runes of apocalypse blaze as a Doomsday Golem completes its terrible awakening!',                               'The doomsday golem splits apart with a sound like the world ending!'),
(8,  2,  'Elder Dragon',       'inferno breath',    2.0, 2.0, 2.0, 2.0, NULL,        'The world shakes as an Elder Dragon descends from the storm clouds, ancient wrath unveiled!',                  'The elder dragon plummets from the sky, shaking the earth on impact!'),
(8,  3,  'Ancient Lich',       'world end',         2.1, 1.5, 2.5, 2.5, NULL,        'Centuries of death magic coalesce as an Ancient Lich awakens from its long-planned slumber!',                  'The ancient lich lets out a final curse and crumbles to forgotten dust!'),
(8,  4,  'Pit Fiend',          'hellfire barrage',  2.2, 1.7, 2.0, 2.0, NULL,        'The ground tears open and a Pit Fiend heaves itself out of the fiery abyss!',                                  'The pit fiend roars and is dragged back to Hell!'),
(8,  5,  'Death Lord',         'reaper touch',      2.0, 1.6, 2.2, 2.3, NULL,        'Every living thing within miles withers as the Death Lord extends its hand toward you!',                       'The death lord falls, releasing all its stolen lives at once!'),
(8,  6,  'Archdemon',          'dark annihilation', 2.1, 1.8, 2.1, 2.2, NULL,        'The sky blackens as an Archdemon tears through the veil between worlds, its gaze on you!',                    'The archdemon is banished in a column of holy fire!'),
(8,  7,  'Chaos Dragon',       'chaos inferno',     2.1, 2.0, 2.1, 2.1, NULL,        'Reality collapses inward as a Chaos Dragon tears itself free from the laws of physics!',                       'The chaos dragon explodes in a storm of chaotic energy!'),
(8,  8,  'Titan Giant',        'mountain',          1.9, 2.2, 1.4, 1.4, NULL,        'The world tilts as a Titan Giant steps from behind a mountain range, fist swinging!',                          'The titan giant falls and splits the earth!'),
(8,  9,  'Void Lord',          'cosmic void',       2.0, 1.9, 2.3, 2.4, NULL,        'Space itself groans as a Void Lord pulls nothingness around itself and strides toward you!',                    'The void lord collapses as the void itself recoils!'),
(8,  10, 'Nightmare Beast',    'fear incarnate',    2.0, 2.0, 2.0, 2.2, NULL,        'Your deepest fears coalesce into flesh and muscle — a Nightmare Beast, born of your own terror!',              'The nightmare beast dissolves as you conquer the fear that gave it life!'),
-- Level 9
(9,  0,  'Dread Titan',        'world maul',        2.0, 2.0, 1.5, 1.5, NULL,        'The stars themselves flinch as a Dread Titan rises from the abyss!',                                           'The dread titan collapses in epic, earth-shaking fashion!'),
(9,  1,  'Eternal Golem',      'oblivion fists',    1.9, 3.0, 1.3, 1.3, 'defensive', 'Before time itself began, the Eternal Golem was waiting for this moment. Now it moves.',                         'The eternal golem finally, impossibly, stops moving!'),
(9,  2,  'Ancient Dragon',     'ancient fire',      2.3, 2.3, 2.3, 2.3, NULL,        'Mountains crumble in the wake of an Ancient Dragon as it descends, ancient fire raging!',                       'The ancient dragon falls with a sound like the end of the world!'),
(9,  3,  'Elder Lich',         'eternity',          2.4, 1.7, 2.8, 2.8, NULL,        'Reality unravels for miles around as an Elder Lich opens its eyes after an aeon of sleep!',                     'The elder lich screams and turns to ash — and the eons of undeath end!'),
(9,  4,  'Greater Demon',      'hellfire nova',     2.5, 2.0, 2.3, 2.3, NULL,        'The fabric of existence screams as a Greater Demon tears through it with casual contempt!',                     'The greater demon is banished with a thunderclap that shakes the heavens!'),
(9,  5,  'Soul Eater',         'devour',            2.3, 2.2, 2.4, 2.5, NULL,        'Screaming souls trail in the wake of the Soul Eater as it advances, hungry for yours!',                         'The soul eater implodes, releasing every soul it ever consumed!'),
(9,  6,  'World Destroyer',    'annihilation',      2.4, 2.1, 2.4, 2.4, NULL,        'The horizon catches fire as the World Destroyer turns its attention to this world — and to you!',               'The world destroyer falls — and the world survives!'),
(9,  7,  'Inferno Drake',      'solar breath',      2.4, 2.4, 2.4, 2.4, NULL,        'The sky becomes an ocean of flame as an Inferno Drake descends, solar breath blazing!',                         'The inferno drake crashes down in a blaze of glory!'),
(9,  8,  'Titan King',         'cosmic hammer',     2.2, 2.6, 1.6, 1.6, NULL,        'The cosmos shudders as the Titan King strides from between galaxies, hammer raised!',                           'The titan king falls and shakes the stars!'),
(9,  9,  'Chaos God',          'reality end',       2.3, 2.3, 2.6, 2.7, NULL,        'Every law of nature shatters as the Chaos God unmakes the sky and remakes it as a weapon!',                    'The chaos god falls — and for a moment, order reigns supreme!'),
(9,  10, 'Death Incarnate',    'true death',        2.3, 2.3, 2.5, 2.6, NULL,        'Every living thing within a thousand miles takes one last breath. Then silence. Death Incarnate has arrived.', 'Death itself dies... for now.'),
-- Level 10
(10, 0,  'Primordial Titan',   'beginning maul',    2.2, 2.2, 1.6, 1.6, NULL,        'The Primordial Titan — as old as creation — stirs from its rest and regards you with cosmic fury!',           'The primordial titan falls, ending an age!'),
(10, 1,  'Apocalypse Golem',   'end fists',         2.1, 3.5, 1.4, 1.4, 'defensive', 'The word END is carved across every inch of the Apocalypse Golem as it raises its fists!',                        'The apocalypse golem finally crumbles!'),
(10, 2,  'Legendary Dragon',   'legend fire',       2.6, 2.6, 2.6, 2.6, NULL,        'Songs have been written about this moment — the Legendary Dragon descends, and history holds its breath!',      'The legendary dragon falls, becoming legend itself!'),
(10, 3,  'Lich Emperor',       'imperial death',    2.7, 2.0, 3.2, 3.2, NULL,        'Every lich in the world bows its head as the Lich Emperor arrives!',                                            'The lich emperor shatters in a final flash of dark light!'),
(10, 4,  'Demon Emperor',      'inferno empire',    2.8, 2.3, 2.7, 2.7, NULL,        'The entire demonic hierarchy trembles as the Demon Emperor descends from its infernal throne!',                  'The demon emperor is finally, definitively cast down!'),
(10, 5,  'Void Emperor',       'nothingness',       2.6, 2.5, 2.8, 2.9, NULL,        'Space and time fold themselves out of the way as the Void Emperor steps into existence!',                       'The void emperor collapses into the void it came from!'),
(10, 6,  'True Dragon',        'true fire',         2.8, 2.8, 2.8, 2.8, NULL,        'The True Dragon has existed since the first sunrise. Its roar shakes the foundations of the world.',            'The true dragon falls, shaking the heavens!'),
(10, 7,  'Shadow Emperor',     'shadow empire',     2.7, 2.6, 2.9, 2.9, NULL,        'Every shadow in existence becomes the Shadow Emperor, surrounding you completely!',                              'The shadow emperor dissolves as light floods the world!'),
(10, 8,  'Titan Emperor',      'titan will',        2.5, 3.0, 1.8, 1.8, NULL,        'The universe itself bows as the Titan Emperor arrives — the most powerful giant ever known!',                    'The titan emperor falls and the mountains tremble!'),
(10, 9,  'Chaos Emperor',      'chaos empire',      2.6, 2.6, 3.0, 3.1, NULL,        'The laws of reality dissolve as the Chaos Emperor unmakes everything and reconstructs it as a battlefield!',     'The chaos emperor is destroyed — and order reigns for the first time in aeons!'),
(10, 10, 'Death Emperor',      'mortal end',        2.6, 2.6, 2.9, 3.0, NULL,        'Every soul ever claimed by death answers to the Death Emperor. Now it wants yours.',                            'The death emperor falls — and life wins the day!'),
-- Level 11
(11, 0,  'Dragon Patriarch',   'patriarch fire',    2.5, 2.5, 2.0, 2.0, NULL,        'The Dragon Patriarch — father of all dragons — descends with a roar that splits the sky!',                     'The dragon patriarch falls with a final, noble, earth-shaking roar!'),
(11, 1,  'Godlike Golem',      'divine fists',      2.3, 4.0, 1.6, 1.6, 'defensive', 'It was built before the gods, by something older. Nothing has ever destroyed it. Until today, perhaps.',          'The godlike golem shatters into divine shards!'),
(11, 2,  'Dragon God',         'divine fire',       3.0, 3.0, 3.0, 3.0, NULL,        'The Dragon God descends from the celestial realm, its divine fire painting the sky gold and red!',              'The dragon god falls, and the heavens themselves weep!'),
(11, 3,  'Lich God',           'divine death',      3.1, 2.3, 3.6, 3.6, NULL,        'The accumulated death of every universe ever destroyed fuels the Lich God as it opens its eyes!',               'The lich god dissolves with a cosmic scream!'),
(11, 4,  'Demon God',          'divine hellfire',   3.2, 2.6, 3.1, 3.1, NULL,        'The Demon God — ruler of all damnation — descends to face you personally. A supreme honour and a death sentence.','The demon god is cast down for the last time!'),
(11, 5,  'Void God',           'divine void',       3.0, 2.9, 3.2, 3.3, NULL,        'The Void God does not arrive. It simply removes everything else until only it and you remain.',                'The void god collapses — and everything that was removed returns!'),
(11, 6,  'Dragon King',        'king fire',         3.1, 3.1, 3.1, 3.1, NULL,        'The Dragon King roars and the mountain range behind it crumbles to announce its presence!',                     'The dragon king crashes to earth — long live the king!'),
(11, 7,  'Shadow God',         'divine darkness',   3.0, 3.0, 3.3, 3.3, NULL,        'The Shadow God does not approach. It is already everywhere. And now it focuses entirely on you.',               'The shadow god is extinguished by the light!'),
(11, 8,  'Titan God',          'titan divinity',    2.8, 3.4, 2.1, 2.1, NULL,        'The Titan God picks up a star and uses it as a weapon. You are impossibly outmatched. And yet, here you are.',  'The titan god falls — and the world is reborn in its wake!'),
(11, 9,  'Chaos God Prime',    'prime chaos',       3.0, 3.0, 3.4, 3.5, NULL,        'The Chaos God Prime — the source of all chaos since before time — finally deigns to notice you.',             'The chaos god prime is undone by order itself!'),
(11, 10, 'Death God',          'divine end',        3.0, 3.0, 3.3, 3.4, NULL,        'Death itself has taken form. And that form is looking directly at you with the full weight of eternity.',        'The death god falls... and death itself weeps.')
ON CONFLICT (level, sort_order) DO NOTHING;

-- ── Game constants ────────────────────────────────────────────────────────────

INSERT INTO game_constants (key, value, description) VALUES
  ('daily_forest_fights',    '10',      'Forest fights allowed per day'),
  ('daily_pvp_fights',       '5',       'PvP fights allowed per day'),
  ('bank_interest_rate',     '0.05',    'Daily bank interest (5% = 0.05)'),
  ('monster_base_hp',        '15',      'Monster HP formula: (base_hp + level * hp_per_level) * hpMult'),
  ('monster_hp_per_level',   '18',      'HP added per player level in monster formula'),
  ('monster_base_str',       '8',       'Monster strength formula: (base_str + level * str_per_level) * strMult'),
  ('monster_str_per_level',  '10',      'Str added per player level in monster formula'),
  ('monster_base_gold',      '10',      'Monster gold formula: (base_gold + level * gold_per_level) * goldMult'),
  ('monster_gold_per_level', '22',      'Gold added per player level in monster formula'),
  ('monster_base_exp',       '15',      'Monster exp formula: (base_exp + level * exp_per_level) * expMult'),
  ('monster_exp_per_level',  '22',      'Exp added per player level in monster formula'),
  ('dragon_hp',              '2000',    'Red Dragon starting HP'),
  ('dragon_strength',        '500',     'Red Dragon strength'),
  ('dragon_gold',            '500000',  'Gold reward for slaying the Red Dragon'),
  ('dragon_exp',             '1000000', 'Exp reward for slaying the Red Dragon'),
  ('exp_l1',                 '100',     'Exp required to reach level 1'),
  ('exp_l2',                 '400',     'Exp required to reach level 2'),
  ('exp_l3',                 '1000',    'Exp required to reach level 3'),
  ('exp_l4',                 '2500',    'Exp required to reach level 4'),
  ('exp_l5',                 '6250',    'Exp required to reach level 5'),
  ('exp_l6',                 '15000',   'Exp required to reach level 6'),
  ('exp_l7',                 '37500',   'Exp required to reach level 7'),
  ('exp_l8',                 '75000',   'Exp required to reach level 8'),
  ('exp_l9',                 '150000',  'Exp required to reach level 9'),
  ('exp_l10',                '300000',  'Exp required to reach level 10'),
  ('exp_l11',                '600000',  'Exp required to reach level 11')
ON CONFLICT (key) DO NOTHING;

-- ── Quests ────────────────────────────────────────────────────────────────────

INSERT INTO quests (id, name, description, min_level, repeatable, active, trigger_type, trigger_ref) VALUES
  ('widow_revenge',
   'The Widow''s Revenge',
   'A grieving widow begs you to avenge her husband.',
   1, FALSE, TRUE, 'tavern_encounter', 'crying_widow'),

  ('missing_merchant',
   'The Missing Merchant',
   'A merchant vanished on the road. Find out what happened.',
   1, FALSE, TRUE, 'tavern_encounter', 'missing_merchant_rumour'),

  ('cursed_blade_bearer',
   'The Cursed Blade',
   'A dark blade has bonded to your will. Its power is real. So is its cost.',
   3, FALSE, TRUE, 'event', 'cursed_blade'),

  ('wardens_fall',
   'The Warden''s Fall',
   'You slew the dragon — but it was the last Warden, keeping something sealed. Now it is free.',
   12, FALSE, TRUE, 'auto', 'dragon_first_kill')

ON CONFLICT (id) DO NOTHING;

INSERT INTO quest_steps (quest_id, step_order, type, params, effects, display_text) VALUES

  -- Widow's Revenge
  ('widow_revenge', 1, 'kill_named', '{}',
   '{"exp_level_mult":400,"gold_level_mult":300,"charm_delta":3,"rep_changes":{"knights":3,"merchants":2}}',
   'Slay a legendary named enemy in the forest.'),

  -- Missing Merchant
  ('missing_merchant', 1, 'travel',
   '{"town_id":"$targetTown"}',
   '{}',
   'Travel to [town] and search for the missing merchant.'),

  ('missing_merchant', 2, 'choice',
   '{"prompt":"The merchant lies wounded in the road. His attackers fled, leaving his purse behind.","options":[{"key":"H","label":"Help him back to town","outcome_text":"You help the wounded merchant to safety. He grips your hand with tears in his eyes.","effects":{"exp_level_mult":500,"alignment_delta":15,"charm_delta":3,"rep_changes":{"knights":3,"merchants":2}}},{"key":"T","label":"Take his gold and leave","outcome_text":"You pocket the coin and walk away. The merchant watches you go with hollow eyes.","effects":{"gold_level_mult":300,"alignment_delta":-20,"rep_changes":{"merchants":-3}}}]}',
   '{}',
   'You have found the scene. Make your choice.'),

  -- Cursed Blade
  ('cursed_blade_bearer', 1, 'event_trigger',
   '{"event_id":"cursed_blade"}',
   '{}',
   'Bear the curse — or seek a druid to cleanse it (Thornreach, 5,000 gold).'),

  -- Warden's Fall
  ('wardens_fall', 1, 'npc_talk',
   '{"npc_id":"scholar_voss","town_id":"dawnmark"}',
   '{}',
   'Return to Dawnmark. Scholar Voss has urgent news.'),

  ('wardens_fall', 2, 'npc_talk',
   '{"npc_id":"captain_ralen","town_id":"ironhold"}',
   '{}',
   'Travel to Ironhold — the shadow armies have already reached the military front.'),

  ('wardens_fall', 3, 'npc_talk',
   '{"npc_id":"archivist_thessaly","town_id":"stormwatch"}',
   '{}',
   'Travel to Stormwatch — the Archivist holds records of what was sealed.'),

  ('wardens_fall', 4, 'kill_boss',
   '{"boss_id":"pale_captain","town_id":"graveport"}',
   '{}',
   'Travel to Graveport — the last Warden''s journal is aboard a ghost ship.'),

  ('wardens_fall', 5, 'npc_talk',
   '{"npc_id":"ancient_forge","town_id":"ashenfall"}',
   '{}',
   'Travel to Ashenfall — forge the Warden''s Seal at the Ancient Forge.'),

  ('wardens_fall', 6, 'kill_boss',
   '{"boss_id":"veilborn","town_id":"dawnmark"}',
   '{}',
   'Return to Dawnmark — the Veilborn has arrived. Make your stand.')

ON CONFLICT (quest_id, step_order) DO NOTHING;

-- ── Factions ──────────────────────────────────────────────────────────────────

INSERT INTO factions (id, name, short_name, home_town, house_name, house_keeper, rep_column,
  welcome_positive, welcome_neutral, welcome_negative,
  assassin_name, assassin_weapon, sort_order)
VALUES
  ('knights', 'Knights of Silverkeep', 'Knights', 'silverkeep',
   'The Knight''s Bastion', 'Commander Aldric Vale', 'rep_knights',
   '"The realm needs warriors of honour. You have proven yourself."',
   '"Stand tall. Show us your worth and Silverkeep''s gates open wider."',
   '"Your reputation precedes you. Not favourably."',
   'Silverkeep Inquisitor', 'a blessed longsword', 1),
  ('guild', 'Thieves'' Guild', 'Thieves'' Guild', 'duskveil',
   'The Shadowhouse', 'The Underboss', 'rep_guild',
   '"You''ve earned the Guild''s trust. Don''t waste it."',
   '"Prove your worth and we''ll have work for you."',
   '"You''ve made enemies here. Tread carefully."',
   'Guild Silencer', 'a poisoned blade', 2),
  ('druids', 'Druid Circle', 'Druid Circle', 'thornreach',
   'The Sacred Circle', 'Elder Mosswhisper', 'rep_druids',
   '"The forest speaks well of you, traveller."',
   '"Walk gently. The Circle watches all who pass through."',
   '"You have wounded the forest. The Circle does not forget."',
   'Thornreach Avenger', 'a twisted thornwood staff', 3),
  ('necromancers', 'Necromancers'' Conclave', 'Conclave', 'graveport',
   'The Conclave Vault', 'Archmagus Dreveth', 'rep_necromancers',
   '"Death is merely a doorway. You understand this."',
   '"We deal in secrets. Come back when you have something to offer."',
   '"You have made an enemy of death itself. Unwise."',
   'Conclave Shade', 'a soul-draining dagger', 4),
  ('merchants', 'Merchants'' League', 'Merchants'' League', 'velmora',
   'The League Hall', 'Guildmaster Tessara', 'rep_merchants',
   '"Profit and partnership. You understand the League''s way."',
   '"Gold opens doors. Bring us enough and we''ll open ours."',
   '"You''ve cost us money. That is unforgivable."',
   'League Enforcer', 'a weighted cudgel', 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO faction_class_rep (faction_id, class_num, rep_delta) VALUES
  ('necromancers', 1,  10),
  ('knights',      1,  -5),
  ('knights',      2,  10),
  ('guild',        3,  10),
  ('merchants',    3,  -5),
  ('necromancers', 4,   5),
  ('druids',       4,   5),
  ('druids',       5,  10),
  ('knights',      6,  15),
  ('necromancers', 6, -10),
  ('druids',       7,  15),
  ('necromancers', 8,  15),
  ('knights',      8, -10),
  ('necromancers', 9,   5)
ON CONFLICT (faction_id, class_num) DO NOTHING;

-- ── Towns ─────────────────────────────────────────────────────────────────────

INSERT INTO towns (id, name, tagline, min_level, shop_max_tier, connections, sort_order) VALUES
  ('dawnmark',      'Town of Dawnmark',   'The frontier holds no promises — only opportunities.',    1, 7,  ARRAY['thornreach','silverkeep','bracken_hollow'], 1),
  ('stormwatch',    'Stormwatch',         'Reality bends here. The wise tread carefully.',            4, 11, ARRAY['frostmere','thornreach','ironhold'],         2),
  ('ironhold',      'Ironhold Bastion',   'Strength is the only currency that matters.',             3, 12, ARRAY['stormwatch','silverkeep','velmora','old_karth'], 3),
  ('old_karth',     'Old Karth',          'What was buried here should have stayed buried.',         5, 10, ARRAY['ironhold','ashenfall'],                      4),
  ('thornreach',    'Thornreach',         'The forest does not forgive those who ignore it.',         1, 7,  ARRAY['stormwatch','dawnmark','silverkeep'],        5),
  ('silverkeep',    'Silverkeep',         'Justice is absolute. So is its price.',                   1, 9,  ARRAY['thornreach','dawnmark','ironhold','velmora','duskveil'], 6),
  ('velmora',       'Velmora',            'Everything has a price. Most things have several.',        2, 13, ARRAY['ironhold','silverkeep','graveport'],         7),
  ('bracken_hollow','Bracken Hollow',     'Small town, big problems.',                               1, 3,  ARRAY['dawnmark'],                                 8),
  ('duskveil',      'Duskveil',           'In the perpetual twilight, secrets thrive.',              5, 10, ARRAY['silverkeep','graveport','mirefen'],           9),
  ('graveport',     'Graveport',          'The dead make good sailors. They never complain.',        3, 8,  ARRAY['velmora','duskveil','mirefen'],              10),
  ('mirefen',       'Mirefen',            'The swamp takes what it wants. And it keeps it.',         4, 6,  ARRAY['duskveil','graveport','ashenfall'],          11),
  ('ashenfall',     'Ashenfall',          'Everything here has already burned once.',                7, 15, ARRAY['mirefen','old_karth'],                      12),
  ('frostmere',     'Frostmere',          'Isolation is the oldest survival strategy.',              2, 5,  ARRAY['stormwatch'],                               13)
ON CONFLICT (id) DO NOTHING;

INSERT INTO town_social_spaces (town_id, name, action) VALUES
  ('dawnmark',      'Lysa''s Garden',      'garden'),
  ('velmora',       'The Silken Chamber',  'social_velmora'),
  ('ironhold',      'The Fighting Pit',    'social_ironhold'),
  ('silverkeep',    'Temple of Valor',     'social_silverkeep'),
  ('thornreach',    'The Ancient Grove',   'social_thornreach'),
  ('duskveil',      'The Shadow Market',   'social_duskveil'),
  ('graveport',     'The Drowned Man',     'social_graveport'),
  ('stormwatch',    'The Arcane Library',  'social_stormwatch'),
  ('old_karth',     'The Crypts',          'social_old_karth'),
  ('ashenfall',     'The Forge of Ruin',   'social_ashenfall'),
  ('bracken_hollow','The Village Well',    'social_bracken_hollow'),
  ('mirefen',       'The Bog Witch''s Hut','social_mirefen'),
  ('frostmere',     'The Hearthfire Inn',  'social_frostmere')
ON CONFLICT (town_id) DO NOTHING;

INSERT INTO town_shop_owners
  (town_id, name, title, quote, weapon_mult, armor_mult, sell_mult, tier_cap, faction,
   charm_bonus, daily_discount, poison_gear_discount, flee_discount, forge_upgrade, stocks_bonus)
VALUES
  ('dawnmark',      'Silas',      'the Old Soldier',     '"Fought for thirty years. Sells for fifty."',            0.90, 1.00, 0.40, 5,    null,          false, false, false, false, false, false),
  ('silverkeep',    'Lady Maren', 'the Noble''s Factor', '"Quality at a fair price. No haggling."',                1.00, 1.00, 0.40, null, 'knights',     true,  false, false, false, false, false),
  ('velmora',       'Kess',       'the Sharp Merchant',  '"I buy high. Unusual, I know."',                         1.00, 1.00, 0.55, null, 'merchants',   false, false, false, false, false, false),
  ('ironhold',      'Brennar',    'the Armorer',         '"Armor first. Weapons are for showing off."',            1.05, 0.90, 0.40, null, null,          false, false, false, false, false, false),
  ('thornreach',    'Aldric',     'the Woodsman',        '"Practical gear for practical work."',                   0.92, 0.92, 0.40, 7,    'druids',      false, false, false, false, false, false),
  ('stormwatch',    'Zathis',     'the Arcane Merchant', '"My stock is... eclectic."',                             1.00, 1.00, 0.40, null, null,          false, false, false, false, false, true),
  ('duskveil',      'No Name',    'ask no questions',    '"One item. One day. Discounted. That''s the deal."',     1.00, 1.00, 0.40, null, 'guild',       false, true,  false, false, false, false),
  ('graveport',     'Marek',      'the Smuggler',        '"Fell off a ship. No questions."',                       0.88, 1.00, 0.40, null, 'necromancers',false, false, false, false, false, false),
  ('mirefen',       'Old Petra',  'the Swamp Trader',    '"I smell gold on you. Good."',                           1.00, 1.00, 0.40, null, null,          false, false, true,  false, false, false),
  ('old_karth',     'the Dealer', 'of relics',           '"These have outlived their owners. Maybe you won''t."',  1.15, 1.15, 0.60, null, null,          false, false, false, false, false, false),
  ('ashenfall',     'Vorn',       'the Master Forger',   '"I built the weapons that broke the last king."',        1.00, 1.00, 0.40, null, null,          false, false, false, false, false, false),
  ('bracken_hollow','Marta',      'the Farmer''s Wife',  '"It''s not fancy. But it''ll hold."',                   0.80, 0.80, 0.40, 3,    null,          false, false, false, false, false, false),
  ('frostmere',     'Bjarne',     'the Hunter',          '"Built for the cold. Built to last."',                   1.00, 1.00, 0.40, null, null,          false, false, false, true,  false, false)
ON CONFLICT (town_id) DO NOTHING;

-- ── NPC dialogue ──────────────────────────────────────────────────────────────

INSERT INTO npc_dialogue (npc_id, topic_key, answer_key, question_hint, responses) VALUES

('lysa', 'asks_why_fight', 'why_fight', 'Lysa asks: "Why do you keep fighting? Not the surface answer — the real one."',
$$[
  {"key":"A","label":"It is all I know","answer_value":"all_i_know","reaction":["`#\"The honest answer.\" She nods slowly.","`%\"Most people dress it up. I appreciate that you don't.\"","`#\"That's either peace or a very old habit. Sometimes both.\""]},
  {"key":"B","label":"Someone has to","answer_value":"someone_has_to","reaction":["`#\"Someone has to.\" She repeats it quietly.","`%\"That's either nobility or a wound so old you've mistaken it for a reason.\"","`8\"Maybe both. I'm not sure it matters which.\""]},
  {"key":"C","label":"For the gold, honestly","answer_value":"the_gold","reaction":["`#She smiles — genuinely.","`%\"The gold answer. I like that.\"","`#\"Most people who say that act otherwise. I'll be watching to see which kind you are.\""]},
  {"key":"D","label":"I have not figured that out yet","answer_value":"not_sure","reaction":["`#\"Not sure.\" She says it back without judgment.","`%\"That's the most honest answer I've heard in a while.\"","`#\"Most people who don't know invent a reason on the spot.\"","`8\"The fact that you didn't says something.\""]},
  {"key":"E","label":"I would rather not say","answer_value":"private","reaction":["`#She holds eye contact for a moment.","`8\"Fair enough.\"","`%She returns to her work. No disappointment. Just patience.","`#\"You don't owe me an answer. I asked because I was curious.\"","`%\"I still am.\""]}
]$$::jsonb),

('lysa', 'the_road', 'why_travel', 'Lysa asks: "Do you know why you keep going? Or is it just what you do now?"',
$$[
  {"key":"A","label":"I am looking for something","answer_value":"looking","reaction":["`#\"Looking for something.\" She considers this.","`%\"Most people are. The ones who know what it is are rarer than they think.\"","`8\"I hope you find it. Or realise you already have.\""]},
  {"key":"B","label":"Running from something","answer_value":"running","reaction":["`#\"Running.\" She does not say it as a judgment.","`%\"Running and looking are not that different, in my experience.\"","`#\"The road treats them the same.\"","`8\"The difference is in what you do when you stop.\""]},
  {"key":"C","label":"It is just what I do now","answer_value":"habit","reaction":["`#\"Just what you do now.\" A pause.","`%\"That is either peace or surrender.\"","`#She clips a stem.","`8\"Sometimes both. I have made peace with not knowing which.\""]},
  {"key":"D","label":"I enjoy it","answer_value":"enjoy","reaction":["`#That stops her.","`%\"Enjoy it.\" She says it like she is testing the word.","`#\"I believe you. That's unusual enough to be interesting.\"","`%\"Most people justify it. You're not justifying anything.\"","`8\"I find that interesting.\""]}
]$$::jsonb),

('lysa', 'opinion_fighters', 'fighter_opinion', 'Lysa asks: "What actually drives the fighters — the ones who keep going?"',
$$[
  {"key":"A","label":"Purpose. They need to matter","answer_value":"purpose","reaction":["`#\"Purpose.\" She nods slowly.","`%\"The need to matter. Yes. I've seen that.\"","`#\"The dangerous ones are the people whose purpose has run out but they haven't stopped yet.\"","`8\"I wonder sometimes if you've thought about what happens when you're done.\""]},
  {"key":"B","label":"Fear. They do not know what else to do","answer_value":"fear","reaction":["`#\"Fear.\" A long pause.","`%\"I think you might be right. Or partly right.\"","`#\"Fear of stopping. Fear of what's left when the fighting stops.\"","`%She looks at her roses.","`8\"It is a very old engine.\""]},
  {"key":"C","label":"They like it","answer_value":"they_like_it","reaction":["`#\"They like it.\" She considers this without flinching.","`%\"Probably true for some. More than people admit.\"","`#\"There is something honest about acknowledging that.\"","`8\"I am not sure what to do with it. But I believe it.\""]},
  {"key":"D","label":"I am not sure. I am one of them","answer_value":"unsure_myself","reaction":["`#She looks at you for a moment.","`%\"You're one of them and you still don't know.\"","`#\"I think that's the most interesting answer you could have given me.\"","`8She turns back to her plants. Something lighter in her expression.","`%\"Come back when you figure it out.\""]}
]$$::jsonb)

ON CONFLICT (npc_id, topic_key) DO NOTHING;
