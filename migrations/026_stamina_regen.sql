-- Migration 026: real-time stamina regen + inn sleeping overhaul

-- Timestamp (ms) of when stamina was last recalculated; used for real-time regen
ALTER TABLE players ADD COLUMN IF NOT EXISTS stamina_regen_at BIGINT DEFAULT NULL;

-- Whether the player slept at the inn today (for the once-daily +2 bonus)
ALTER TABLE players ADD COLUMN IF NOT EXISTS slept_today BOOLEAN NOT NULL DEFAULT false;

-- How many pickpocket attempts made today (for progressive catch rate)
ALTER TABLE players ADD COLUMN IF NOT EXISTS pickpocket_today INTEGER NOT NULL DEFAULT 0;
