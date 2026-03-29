-- 003_parties.sql
-- Party system: group players for co-op encounters.

CREATE TABLE IF NOT EXISTS parties (
  id         SERIAL PRIMARY KEY,
  leader_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  town_id    TEXT NOT NULL DEFAULT 'dawnmark',
  status     TEXT NOT NULL DEFAULT 'open',  -- open | full | disbanded
  max_size   INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parties_open ON parties(town_id) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS party_invites (
  id         SERIAL PRIMARY KEY,
  party_id   INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  inviter_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  invitee_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted | declined
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(party_id, invitee_id)
);

CREATE INDEX IF NOT EXISTS idx_party_invites_invitee ON party_invites(invitee_id) WHERE status = 'pending';

ALTER TABLE players ADD COLUMN IF NOT EXISTS party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_players_party ON players(party_id) WHERE party_id IS NOT NULL;
