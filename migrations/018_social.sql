-- Priority 8: Player Identity & Social
-- Bounties, arena challenges, arena bets, last_killed_by

ALTER TABLE players ADD COLUMN IF NOT EXISTS last_killed_by INTEGER DEFAULT NULL;

CREATE TABLE IF NOT EXISTS bounties (
  id          SERIAL PRIMARY KEY,
  poster_id   INTEGER NOT NULL REFERENCES players(id),
  target_id   INTEGER NOT NULL REFERENCES players(id),
  gold        INTEGER NOT NULL CHECK (gold >= 50),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  BIGINT  NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS bounties_target_active ON bounties(target_id, active);

CREATE TABLE IF NOT EXISTS arena_challenges (
  id            SERIAL PRIMARY KEY,
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

CREATE INDEX IF NOT EXISTS arena_challenges_defender ON arena_challenges(defender_id, status);
CREATE INDEX IF NOT EXISTS arena_challenges_challenger ON arena_challenges(challenger_id, status);

CREATE TABLE IF NOT EXISTS arena_bets (
  id           SERIAL PRIMARY KEY,
  challenge_id INTEGER NOT NULL REFERENCES arena_challenges(id),
  player_id    INTEGER NOT NULL REFERENCES players(id),
  side         TEXT    NOT NULL,  -- 'challenger' | 'defender'
  amount       INTEGER NOT NULL CHECK (amount >= 10),
  created_at   BIGINT  NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  UNIQUE (challenge_id, player_id)
);
