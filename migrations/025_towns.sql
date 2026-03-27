-- Migration 025: towns, town_social_spaces, town_shop_owners tables
-- Moves town definitions from game/data.js into the database.

CREATE TABLE IF NOT EXISTS towns (
  id            TEXT    PRIMARY KEY,
  name          TEXT    NOT NULL,
  tagline       TEXT    NOT NULL DEFAULT '',
  min_level     INTEGER NOT NULL DEFAULT 1,
  shop_max_tier INTEGER NOT NULL DEFAULT 5,
  connections   TEXT[]  NOT NULL DEFAULT '{}',
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS town_social_spaces (
  town_id TEXT PRIMARY KEY REFERENCES towns(id) ON DELETE CASCADE,
  name    TEXT NOT NULL,
  action  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS town_shop_owners (
  town_id              TEXT    PRIMARY KEY REFERENCES towns(id) ON DELETE CASCADE,
  name                 TEXT    NOT NULL,
  title                TEXT    NOT NULL DEFAULT '',
  quote                TEXT    NOT NULL DEFAULT '',
  weapon_mult          NUMERIC NOT NULL DEFAULT 1.0,
  armor_mult           NUMERIC NOT NULL DEFAULT 1.0,
  sell_mult            NUMERIC NOT NULL DEFAULT 0.4,
  tier_cap             INTEGER,
  faction              TEXT,
  charm_bonus          BOOLEAN NOT NULL DEFAULT false,
  daily_discount       BOOLEAN NOT NULL DEFAULT false,
  poison_gear_discount BOOLEAN NOT NULL DEFAULT false,
  flee_discount        BOOLEAN NOT NULL DEFAULT false,
  forge_upgrade        BOOLEAN NOT NULL DEFAULT false,
  stocks_bonus         BOOLEAN NOT NULL DEFAULT false
);

-- ── Towns ────────────────────────────────────────────────────────────────────
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

-- ── Social spaces ────────────────────────────────────────────────────────────
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

-- ── Shop owners ──────────────────────────────────────────────────────────────
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
