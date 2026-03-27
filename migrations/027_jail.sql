-- Jail system: jailed players cannot act until jailed_until expires or bail is paid
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS jailed_until BIGINT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS jail_town    TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS jail_offense TEXT    DEFAULT NULL;
