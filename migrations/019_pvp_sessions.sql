-- Real-time PvP sessions table
-- Shared state for synchronous turn-based combat between two online players
CREATE TABLE IF NOT EXISTS pvp_sessions (
  id              SERIAL PRIMARY KEY,
  challenger_id   INTEGER NOT NULL REFERENCES players(id),
  defender_id     INTEGER NOT NULL REFERENCES players(id),
  -- whose turn it is: 'challenger' | 'defender'
  current_turn    TEXT NOT NULL DEFAULT 'challenger',
  -- combat state
  challenger_hp   INTEGER NOT NULL,
  defender_hp     INTEGER NOT NULL,
  challenger_max_hp INTEGER NOT NULL,
  defender_max_hp   INTEGER NOT NULL,
  challenger_skill_uses INTEGER NOT NULL DEFAULT 1,
  defender_skill_uses   INTEGER NOT NULL DEFAULT 1,
  round           INTEGER NOT NULL DEFAULT 1,
  -- log of all rounds so far (JSON array of strings)
  log             JSONB NOT NULL DEFAULT '[]',
  -- status: 'pending' | 'active' | 'complete'
  status          TEXT NOT NULL DEFAULT 'pending',
  -- winner id when complete, NULL if still active
  winner_id       INTEGER,
  -- optional message shown to defender when challenge is sent
  challenge_msg   TEXT,
  -- timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- auto-expire: if a player doesn't act within 60s it's their loss
  turn_deadline   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS pvp_sessions_challenger ON pvp_sessions(challenger_id) WHERE status != 'complete';
CREATE INDEX IF NOT EXISTS pvp_sessions_defender   ON pvp_sessions(defender_id)   WHERE status != 'complete';
