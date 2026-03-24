-- Skill tree / specialisation system
-- Players choose a path at level 6; stored as a string ID (e.g. 'berserker').
-- spec_pending is set to TRUE when level 6 is reached until a choice is made.
-- lich_cooldown stores the game-day the Lichborn death-save last triggered.

ALTER TABLE players ADD COLUMN IF NOT EXISTS specialization TEXT    NOT NULL DEFAULT '';
ALTER TABLE players ADD COLUMN IF NOT EXISTS spec_pending   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS lich_cooldown  INTEGER NOT NULL DEFAULT 0;
