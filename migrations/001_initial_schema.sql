-- Full schema — consolidated (pre-release, single source of truth)

CREATE TABLE IF NOT EXISTS players (
  id                     SERIAL PRIMARY KEY,
  username               TEXT UNIQUE NOT NULL,
  password_hash          TEXT NOT NULL,
  handle                 TEXT NOT NULL DEFAULT '',
  sex                    INTEGER NOT NULL DEFAULT 0,
  class                  INTEGER NOT NULL DEFAULT 1,
  hit_points             INTEGER NOT NULL DEFAULT 15,
  hit_max                INTEGER NOT NULL DEFAULT 15,
  strength               INTEGER NOT NULL DEFAULT 15,
  defense                INTEGER NOT NULL DEFAULT 0,
  charm                  INTEGER NOT NULL DEFAULT 10,
  level                  INTEGER NOT NULL DEFAULT 1,
  exp                    BIGINT NOT NULL DEFAULT 0,
  gold                   BIGINT NOT NULL DEFAULT 0,
  bank                   BIGINT NOT NULL DEFAULT 0,
  gems                   INTEGER NOT NULL DEFAULT 0,
  weapon_num             INTEGER NOT NULL DEFAULT 0,
  weapon_name            TEXT NOT NULL DEFAULT 'Fists',
  arm_num                INTEGER NOT NULL DEFAULT 0,
  arm_name               TEXT NOT NULL DEFAULT 'None',
  fights_left            INTEGER NOT NULL DEFAULT 10,
  human_fights_left      INTEGER NOT NULL DEFAULT 5,
  skill_points           INTEGER NOT NULL DEFAULT 0,
  skill_uses_left        INTEGER NOT NULL DEFAULT 0,
  stamina                INTEGER NOT NULL DEFAULT 10,
  stamina_max            INTEGER NOT NULL DEFAULT 10,
  dead                   INTEGER NOT NULL DEFAULT 0,
  near_death             INTEGER NOT NULL DEFAULT 0,
  near_death_by          TEXT NOT NULL DEFAULT '',
  seen_master            INTEGER NOT NULL DEFAULT 0,
  seen_dragon            INTEGER NOT NULL DEFAULT 0,
  has_horse              INTEGER NOT NULL DEFAULT 0,
  married_to             INTEGER NOT NULL DEFAULT -1,
  kids                   INTEGER NOT NULL DEFAULT 0,
  times_won              INTEGER NOT NULL DEFAULT 0,
  kills                  INTEGER NOT NULL DEFAULT 0,
  lays                   INTEGER NOT NULL DEFAULT 0,
  last_day               INTEGER NOT NULL DEFAULT 0,
  flirted_today          INTEGER NOT NULL DEFAULT 0,
  special_done_today     INTEGER NOT NULL DEFAULT 0,
  training_today         INTEGER NOT NULL DEFAULT 0,
  drinks_today           INTEGER NOT NULL DEFAULT 0,
  grove_healed_today     INTEGER NOT NULL DEFAULT 0,
  well_used_today        INTEGER NOT NULL DEFAULT 0,
  guide_hired            INTEGER NOT NULL DEFAULT 0,
  road_hint              TEXT DEFAULT NULL,
  herbalist_today        INTEGER NOT NULL DEFAULT 0,
  poisoned               INTEGER NOT NULL DEFAULT 0,
  banned                 INTEGER NOT NULL DEFAULT 0,
  is_legend              INTEGER NOT NULL DEFAULT 0,
  rage_active            INTEGER NOT NULL DEFAULT 0,
  -- Wounds & afflictions
  wounds                 TEXT NOT NULL DEFAULT '[]',
  infection_type         TEXT NOT NULL DEFAULT '',
  infection_stage        INTEGER NOT NULL DEFAULT 0,
  infection_days         INTEGER NOT NULL DEFAULT 0,
  vampire_bites          INTEGER NOT NULL DEFAULT 0,
  is_vampire             INTEGER NOT NULL DEFAULT 0,
  vampire_feasted        INTEGER NOT NULL DEFAULT 0,
  bandages               INTEGER NOT NULL DEFAULT 0,
  -- Inn
  retired_today          INTEGER NOT NULL DEFAULT 0,
  retired_town           TEXT NOT NULL DEFAULT '',
  -- Travel & captivity
  current_town           TEXT NOT NULL DEFAULT 'dawnmark',
  travel_to              TEXT DEFAULT NULL,
  travel_segments_done   INTEGER NOT NULL DEFAULT 0,
  travel_segments_total  INTEGER NOT NULL DEFAULT 0,
  camping                INTEGER NOT NULL DEFAULT 0,
  captive                INTEGER NOT NULL DEFAULT 0,
  captive_location       TEXT DEFAULT NULL,
  -- Quests
  quest_id               TEXT NOT NULL DEFAULT '',
  quest_step             INTEGER NOT NULL DEFAULT 0,
  quest_data             TEXT NOT NULL DEFAULT '',
  -- Town crier
  crier_message          TEXT NOT NULL DEFAULT '',
  crier_day              INTEGER NOT NULL DEFAULT 0,
  last_encounter_id      TEXT NOT NULL DEFAULT '',
  encounter_day          INTEGER NOT NULL DEFAULT 0,
  -- Gear upgrades & consumables
  forge_weapon_upgraded  INTEGER NOT NULL DEFAULT 0,
  forge_armor_upgraded   INTEGER NOT NULL DEFAULT 0,
  antidote_owned         INTEGER NOT NULL DEFAULT 0,
  -- Faction reputation (-100 to +100)
  rep_knights            INTEGER NOT NULL DEFAULT 0,
  rep_guild              INTEGER NOT NULL DEFAULT 0,
  rep_druids             INTEGER NOT NULL DEFAULT 0,
  rep_necromancers       INTEGER NOT NULL DEFAULT 0,
  rep_merchants          INTEGER NOT NULL DEFAULT 0,
  -- Meta
  setup_complete         INTEGER NOT NULL DEFAULT 0,
  last_seen              TIMESTAMP,
  created_at             TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS news (
  id         SERIAL PRIMARY KEY,
  day        INTEGER NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hall_of_kings (
  id          SERIAL PRIMARY KEY,
  handle      TEXT NOT NULL,
  level       INTEGER NOT NULL DEFAULT 12,
  kills       INTEGER NOT NULL DEFAULT 0,
  class       INTEGER NOT NULL DEFAULT 1,
  times_won   INTEGER NOT NULL DEFAULT 1,
  defeated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_mail (
  id       SERIAL PRIMARY KEY,
  from_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  to_id    INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  message  TEXT NOT NULL,
  read     INTEGER NOT NULL DEFAULT 0,
  sent_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_mail_to_id ON player_mail(to_id);

CREATE TABLE IF NOT EXISTS banners (
  key        TEXT PRIMARY KEY,
  lines      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
