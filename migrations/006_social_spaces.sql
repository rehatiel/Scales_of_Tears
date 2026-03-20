-- Social space daily tracking and persistent upgrade columns
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS grove_healed_today   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS well_used_today      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS guide_hired          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS road_hint            TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS forge_weapon_upgraded INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forge_armor_upgraded  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS antidote_owned       INTEGER DEFAULT 0;
