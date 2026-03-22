-- Prestige system: players can reset to level 1 after killing the dragon,
-- earning a permanent tier bonus each time.
ALTER TABLE players ADD COLUMN IF NOT EXISTS prestige_level INT NOT NULL DEFAULT 0;
