-- Migration 024: factions table + faction_class_rep table
-- Moves faction definitions from game/factions.js into the database.

CREATE TABLE IF NOT EXISTS factions (
  id               TEXT    PRIMARY KEY,
  name             TEXT    NOT NULL,
  short_name       TEXT    NOT NULL,
  home_town        TEXT    NOT NULL,
  house_name       TEXT    NOT NULL,
  house_keeper     TEXT    NOT NULL,
  rep_column       TEXT    NOT NULL,
  welcome_positive TEXT    NOT NULL DEFAULT '',
  welcome_neutral  TEXT    NOT NULL DEFAULT '',
  welcome_negative TEXT    NOT NULL DEFAULT '',
  assassin_name    TEXT    NOT NULL DEFAULT '',
  assassin_weapon  TEXT    NOT NULL DEFAULT '',
  sort_order       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS faction_class_rep (
  faction_id TEXT    NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  class_num  INTEGER NOT NULL,
  rep_delta  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (faction_id, class_num)
);

-- Seed the 5 factions
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

-- Seed starting rep by class (non-zero values only)
INSERT INTO faction_class_rep (faction_id, class_num, rep_delta) VALUES
  ('necromancers', 1,  10),  -- Dread Knight: dark arts
  ('knights',      1,  -5),  -- Dread Knight: distrusted by Knights
  ('knights',      2,  10),  -- Warrior: lawful fighter
  ('guild',        3,  10),  -- Rogue: Guild connected
  ('merchants',    3,  -5),  -- Rogue: League distrusts
  ('necromancers', 4,   5),  -- Mage: arcane straddles nature and darkness
  ('druids',       4,   5),  -- Mage
  ('druids',       5,  10),  -- Ranger: deep forest bond
  ('knights',      6,  15),  -- Paladin: holy warrior
  ('necromancers', 6, -10),  -- Paladin: anathema to Conclave
  ('druids',       7,  15),  -- Druid: obvious
  ('necromancers', 8,  15),  -- Necromancer: Conclave ally
  ('knights',      8, -10),  -- Necromancer: Knight enemy
  ('necromancers', 9,   5)   -- Elementalist: arcane, leans Conclave
  -- Class 10: Monk — no faction ties
ON CONFLICT (faction_id, class_num) DO NOTHING;
