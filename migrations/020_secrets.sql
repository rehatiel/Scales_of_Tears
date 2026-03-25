-- One-time secret events per player
CREATE TABLE IF NOT EXISTS player_secrets (
  id        SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  secret_id VARCHAR(64) NOT NULL,
  seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, secret_id)
);

CREATE INDEX IF NOT EXISTS idx_player_secrets_player ON player_secrets(player_id);
