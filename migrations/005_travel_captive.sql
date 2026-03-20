-- Travel state and captive state columns
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS travel_to            TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS travel_segments_done INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS travel_segments_total INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS camping              INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS captive              INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS captive_location     TEXT    DEFAULT NULL;
