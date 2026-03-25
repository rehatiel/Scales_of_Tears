-- Multi-character accounts system
-- Creates an accounts table for auth, migrates existing players into it.

CREATE TABLE IF NOT EXISTS accounts (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  banned        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add account linkage columns to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS slot       INTEGER NOT NULL DEFAULT 1;

-- Migrate: create one account per existing player (using their current credentials)
INSERT INTO accounts (username, password_hash, banned, created_at)
SELECT
  username,
  password_hash,
  COALESCE(banned::boolean, FALSE),
  COALESCE(created_at, NOW())
FROM players
WHERE username IS NOT NULL AND password_hash IS NOT NULL
ON CONFLICT (username) DO NOTHING;

-- Link each player to their new account
UPDATE players p
SET account_id = a.id
FROM accounts a
WHERE p.username = a.username
  AND p.account_id IS NULL;

-- Index for fast character lookups
CREATE INDEX IF NOT EXISTS idx_players_account_id ON players(account_id);

-- One character per slot per account
CREATE UNIQUE INDEX IF NOT EXISTS uq_account_slot
  ON players(account_id, slot)
  WHERE account_id IS NOT NULL;
