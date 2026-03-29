-- 001_schema.sql
-- Complete schema for Scales of Tears — single source of truth.
-- Safe to apply to an empty database; all statements use IF NOT EXISTS / IF EXISTS guards.

-- ── Accounts ──────────────────────────────────────────────────────────────────
-- Must come before players because players references it.

CREATE TABLE IF NOT EXISTS accounts (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  banned        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Players ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS players (
  id                     SERIAL PRIMARY KEY,
  -- Account link (multi-character system)
  account_id             INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
  slot                   INTEGER NOT NULL DEFAULT 1,
  -- Credentials (kept for legacy; new players use accounts table)
  username               TEXT UNIQUE,
  password_hash          TEXT,
  -- Character basics
  handle                 TEXT NOT NULL DEFAULT '',
  sex                    INTEGER NOT NULL DEFAULT 0,
  class                  INTEGER NOT NULL DEFAULT 1,
  -- Stats
  hit_points             INTEGER NOT NULL DEFAULT 15,
  hit_max                INTEGER NOT NULL DEFAULT 15,
  strength               INTEGER NOT NULL DEFAULT 15,
  defense                INTEGER NOT NULL DEFAULT 0,
  charm                  INTEGER NOT NULL DEFAULT 10,
  level                  INTEGER NOT NULL DEFAULT 1,
  exp                    BIGINT  NOT NULL DEFAULT 0,
  gold                   BIGINT  NOT NULL DEFAULT 0,
  bank                   BIGINT  NOT NULL DEFAULT 0,
  gems                   INTEGER NOT NULL DEFAULT 0,
  alignment              INTEGER NOT NULL DEFAULT 0,
  prestige_level         INTEGER NOT NULL DEFAULT 0,
  -- Equipment
  weapon_num             INTEGER NOT NULL DEFAULT 0,
  weapon_name            TEXT NOT NULL DEFAULT 'Fists',
  arm_num                INTEGER NOT NULL DEFAULT 0,
  arm_name               TEXT NOT NULL DEFAULT 'None',
  named_weapon_id        TEXT DEFAULT NULL,
  named_armor_id         TEXT DEFAULT NULL,
  weapon_cursed          BOOLEAN NOT NULL DEFAULT FALSE,
  armor_cursed           BOOLEAN NOT NULL DEFAULT FALSE,
  blood_oath             BOOLEAN NOT NULL DEFAULT FALSE,
  -- Daily counters
  fights_left            INTEGER NOT NULL DEFAULT 10,
  human_fights_left      INTEGER NOT NULL DEFAULT 5,
  skill_points           INTEGER NOT NULL DEFAULT 0,
  skill_uses_left        INTEGER NOT NULL DEFAULT 0,
  stamina                INTEGER NOT NULL DEFAULT 10,
  stamina_max            INTEGER NOT NULL DEFAULT 10,
  stamina_regen_at       BIGINT DEFAULT NULL,
  -- Status flags
  dead                   INTEGER NOT NULL DEFAULT 0,
  near_death             INTEGER NOT NULL DEFAULT 0,
  near_death_by          TEXT NOT NULL DEFAULT '',
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
  -- Social
  seen_master            INTEGER NOT NULL DEFAULT 0,
  seen_dragon            INTEGER NOT NULL DEFAULT 0,
  has_horse              INTEGER NOT NULL DEFAULT 0,
  married_to             INTEGER NOT NULL DEFAULT -1,
  kids                   INTEGER NOT NULL DEFAULT 0,
  times_won              INTEGER NOT NULL DEFAULT 0,
  kills                  INTEGER NOT NULL DEFAULT 0,
  lays                   INTEGER NOT NULL DEFAULT 0,
  last_killed_by         INTEGER DEFAULT NULL,
  -- Today counters
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
  retired_today          INTEGER NOT NULL DEFAULT 0,
  retired_town           TEXT NOT NULL DEFAULT '',
  slept_today            BOOLEAN NOT NULL DEFAULT false,
  pickpocket_today       INTEGER NOT NULL DEFAULT 0,
  -- Travel & captivity
  current_town           TEXT NOT NULL DEFAULT 'dawnmark',
  travel_to              TEXT DEFAULT NULL,
  travel_segments_done   INTEGER NOT NULL DEFAULT 0,
  travel_segments_total  INTEGER NOT NULL DEFAULT 0,
  camping                INTEGER NOT NULL DEFAULT 0,
  captive                INTEGER NOT NULL DEFAULT 0,
  captive_location       TEXT DEFAULT NULL,
  -- Jail
  jailed_until           BIGINT DEFAULT NULL,
  jail_town              TEXT DEFAULT NULL,
  jail_offense           TEXT DEFAULT NULL,
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
  -- Perks & skills
  perks                  TEXT NOT NULL DEFAULT '[]',
  perk_points            INTEGER NOT NULL DEFAULT 0,
  -- Specialisation
  specialization         TEXT NOT NULL DEFAULT '',
  spec_pending           BOOLEAN NOT NULL DEFAULT FALSE,
  lich_cooldown          INTEGER NOT NULL DEFAULT 0,
  -- Titles & deeds
  earned_titles          TEXT NOT NULL DEFAULT '[]',
  active_title           TEXT,
  death_count            INTEGER NOT NULL DEFAULT 0,
  flee_count             INTEGER NOT NULL DEFAULT 0,
  -- Exploration
  ruins_visited          TEXT NOT NULL DEFAULT '[]',
  dungeon_clears         TEXT NOT NULL DEFAULT '[]',
  -- Named enemy tracker
  nemesis_id             INTEGER DEFAULT NULL,
  -- Meta
  setup_complete         INTEGER NOT NULL DEFAULT 0,
  last_seen              TIMESTAMP,
  created_at             TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_players_account_id ON players(account_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_account_slot ON players(account_id, slot) WHERE account_id IS NOT NULL;

-- ── News ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS news (
  id         SERIAL PRIMARY KEY,
  day        INTEGER NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Hall of Kings ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hall_of_kings (
  id          SERIAL PRIMARY KEY,
  handle      TEXT NOT NULL,
  level       INTEGER NOT NULL DEFAULT 12,
  kills       INTEGER NOT NULL DEFAULT 0,
  class       INTEGER NOT NULL DEFAULT 1,
  times_won   INTEGER NOT NULL DEFAULT 1,
  defeated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Player mail ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS player_mail (
  id       SERIAL PRIMARY KEY,
  from_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  to_id    INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  message  TEXT NOT NULL,
  read     INTEGER NOT NULL DEFAULT 0,
  sent_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_mail_to_id ON player_mail(to_id);

-- ── Banners ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS banners (
  key        TEXT PRIMARY KEY,
  lines      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Named enemies ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS named_enemies (
  id              SERIAL PRIMARY KEY,
  template_name   TEXT    NOT NULL,
  given_name      TEXT    NOT NULL,
  level           INTEGER NOT NULL,
  template_index  INTEGER NOT NULL,
  strength        INTEGER NOT NULL,
  hp              INTEGER NOT NULL,
  gold            INTEGER NOT NULL,
  exp             INTEGER NOT NULL,
  kills           INTEGER NOT NULL DEFAULT 0,
  title           TEXT    NOT NULL DEFAULT '',
  defeated        INTEGER NOT NULL DEFAULT 0,
  reached_town    TEXT    DEFAULT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen_at    TIMESTAMP
);

-- ── World events & state ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS world_events (
  id         SERIAL PRIMARY KEY,
  type       TEXT NOT NULL,
  started_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  ends_at    BIGINT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS world_state (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- ── Hunt board ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS weekly_hunts (
  id              SERIAL PRIMARY KEY,
  week_number     INTEGER NOT NULL,
  rank            INTEGER NOT NULL DEFAULT 1,
  target_name     TEXT    NOT NULL,
  total_kills     INTEGER NOT NULL DEFAULT 0,
  kill_bonus_gold INTEGER NOT NULL DEFAULT 500,
  kill_bonus_exp  INTEGER NOT NULL DEFAULT 250,
  UNIQUE(week_number, target_name)
);

CREATE TABLE IF NOT EXISTS hunt_kills (
  id        SERIAL  PRIMARY KEY,
  hunt_id   INTEGER NOT NULL REFERENCES weekly_hunts(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id)      ON DELETE CASCADE,
  kills     INTEGER NOT NULL DEFAULT 0,
  UNIQUE(hunt_id, player_id)
);

-- ── Social: bounties & arena ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bounties (
  id         SERIAL  PRIMARY KEY,
  poster_id  INTEGER NOT NULL REFERENCES players(id),
  target_id  INTEGER NOT NULL REFERENCES players(id),
  gold       INTEGER NOT NULL CHECK (gold >= 50),
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at BIGINT  NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS bounties_target_active ON bounties(target_id, active);

CREATE TABLE IF NOT EXISTS arena_challenges (
  id            SERIAL  PRIMARY KEY,
  challenger_id INTEGER NOT NULL REFERENCES players(id),
  defender_id   INTEGER NOT NULL REFERENCES players(id),
  town          TEXT    NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'pending',
  -- status: pending | accepted | declined | completed | expired
  winner_id     INTEGER DEFAULT NULL,
  bet_pool      INTEGER NOT NULL DEFAULT 0,
  created_at    BIGINT  NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  resolved_at   BIGINT  DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS arena_challenges_defender   ON arena_challenges(defender_id,   status);
CREATE INDEX IF NOT EXISTS arena_challenges_challenger ON arena_challenges(challenger_id, status);

CREATE TABLE IF NOT EXISTS arena_bets (
  id           SERIAL  PRIMARY KEY,
  challenge_id INTEGER NOT NULL REFERENCES arena_challenges(id),
  player_id    INTEGER NOT NULL REFERENCES players(id),
  side         TEXT    NOT NULL,  -- 'challenger' | 'defender'
  amount       INTEGER NOT NULL CHECK (amount >= 10),
  created_at   BIGINT  NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  UNIQUE (challenge_id, player_id)
);

-- ── PvP sessions ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pvp_sessions (
  id                    SERIAL  PRIMARY KEY,
  challenger_id         INTEGER NOT NULL REFERENCES players(id),
  defender_id           INTEGER NOT NULL REFERENCES players(id),
  current_turn          TEXT    NOT NULL DEFAULT 'challenger',
  challenger_hp         INTEGER NOT NULL,
  defender_hp           INTEGER NOT NULL,
  challenger_max_hp     INTEGER NOT NULL,
  defender_max_hp       INTEGER NOT NULL,
  challenger_skill_uses INTEGER NOT NULL DEFAULT 1,
  defender_skill_uses   INTEGER NOT NULL DEFAULT 1,
  round                 INTEGER NOT NULL DEFAULT 1,
  log                   JSONB   NOT NULL DEFAULT '[]',
  status                TEXT    NOT NULL DEFAULT 'pending',
  winner_id             INTEGER,
  challenge_msg         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  turn_deadline         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS pvp_sessions_challenger ON pvp_sessions(challenger_id) WHERE status != 'complete';
CREATE INDEX IF NOT EXISTS pvp_sessions_defender   ON pvp_sessions(defender_id)   WHERE status != 'complete';

-- ── Player secrets ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS player_secrets (
  id        SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  secret_id VARCHAR(64) NOT NULL,
  seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, secret_id)
);

CREATE INDEX IF NOT EXISTS idx_player_secrets_player ON player_secrets(player_id);

-- ── Game data: weapons, armors, monsters, constants ───────────────────────────

CREATE TABLE IF NOT EXISTS weapons (
  num        INTEGER PRIMARY KEY,
  name       TEXT    NOT NULL,
  price      BIGINT  NOT NULL,
  strength   INTEGER NOT NULL,
  tier       INTEGER NOT NULL,
  bonus      TEXT,
  bonus_desc TEXT
);

CREATE TABLE IF NOT EXISTS armors (
  num        INTEGER PRIMARY KEY,
  name       TEXT    NOT NULL,
  price      BIGINT  NOT NULL,
  defense    INTEGER NOT NULL,
  tier       INTEGER NOT NULL,
  bonus      TEXT,
  bonus_desc TEXT
);

CREATE TABLE IF NOT EXISTS monsters (
  id         SERIAL       PRIMARY KEY,
  level      INTEGER      NOT NULL,
  sort_order INTEGER      NOT NULL,
  name       TEXT         NOT NULL,
  weapon     TEXT         NOT NULL,
  str_mult   NUMERIC(4,2) NOT NULL,
  hp_mult    NUMERIC(4,2) NOT NULL,
  gold_mult  NUMERIC(4,2) NOT NULL,
  exp_mult   NUMERIC(4,2) NOT NULL,
  behavior   TEXT,
  meet_text  TEXT         NOT NULL,
  death_text TEXT         NOT NULL,
  UNIQUE (level, sort_order)
);

CREATE TABLE IF NOT EXISTS game_constants (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT
);

-- ── Quests ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quests (
  id           TEXT PRIMARY KEY,
  name         TEXT    NOT NULL,
  description  TEXT    NOT NULL,
  min_level    INTEGER NOT NULL DEFAULT 1,
  repeatable   BOOLEAN NOT NULL DEFAULT FALSE,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  trigger_type TEXT,
  trigger_ref  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quest_steps (
  id           SERIAL  PRIMARY KEY,
  quest_id     TEXT    NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  step_order   INTEGER NOT NULL,
  type         TEXT    NOT NULL,
  params       JSONB   NOT NULL DEFAULT '{}',
  effects      JSONB   NOT NULL DEFAULT '{}',
  display_text TEXT    NOT NULL,
  UNIQUE (quest_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_quest_steps_quest_id ON quest_steps(quest_id);

-- ── Factions ──────────────────────────────────────────────────────────────────

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

-- ── Towns ─────────────────────────────────────────────────────────────────────

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

-- ── NPC memory ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS npc_memory (
  id                 SERIAL  PRIMARY KEY,
  npc_id             TEXT    NOT NULL,
  player_id          INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  visit_count        INTEGER NOT NULL DEFAULT 0,
  last_visit         INTEGER NOT NULL DEFAULT 0,
  relationship_level INTEGER NOT NULL DEFAULT 0,
  topics_seen        JSONB   NOT NULL DEFAULT '[]',
  player_answers     JSONB   NOT NULL DEFAULT '{}',
  notes              JSONB   NOT NULL DEFAULT '{}',
  created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(npc_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_npc_memory_player ON npc_memory(player_id);

-- ── NPC dialogue ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS npc_dialogue (
  id            SERIAL  PRIMARY KEY,
  npc_id        TEXT    NOT NULL DEFAULT 'lysa',
  topic_key     TEXT    NOT NULL,
  answer_key    TEXT    NOT NULL,
  question_hint TEXT    NOT NULL DEFAULT '',
  responses     JSONB   NOT NULL DEFAULT '[]',
  -- each response: { "key": "A", "label": "Button text", "answer_value": "stored_val", "reaction": ["line1","line2"] }
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(npc_id, topic_key)
);
