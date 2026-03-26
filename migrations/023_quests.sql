-- 023_quests.sql
-- DB-driven quest framework. Seeds the 4 existing quests.
-- New quests created via admin panel are executed by quest_runner.js with no code changes.

CREATE TABLE IF NOT EXISTS quests (
  id           TEXT PRIMARY KEY,
  name         TEXT    NOT NULL,
  description  TEXT    NOT NULL,
  min_level    INTEGER NOT NULL DEFAULT 1,
  repeatable   BOOLEAN NOT NULL DEFAULT FALSE,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  trigger_type TEXT,   -- tavern_encounter | event | auto | manual
  trigger_ref  TEXT,   -- encounter id, event id, 'dragon_first_kill', etc.
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- quest_steps: each row is one step in a quest.
-- step_order is 1-indexed and matches player.quest_step.
-- type:   travel | npc_talk | kill_named | kill_boss | choice | event_trigger
-- params: JSONB, type-specific config (see quest_runner.js for full reference)
-- effects: JSONB rewards applied when the step completes
--   exp_flat, exp_level_mult, gold_flat, gold_level_mult,
--   alignment_delta, charm_delta, strength_delta, hit_max_delta,
--   rep_changes { knights, merchants, guild, druids, necromancers }
CREATE TABLE IF NOT EXISTS quest_steps (
  id           SERIAL  PRIMARY KEY,
  quest_id     TEXT    NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  step_order   INTEGER NOT NULL,
  type         TEXT    NOT NULL,
  params       JSONB   NOT NULL DEFAULT '{}',
  effects      JSONB   NOT NULL DEFAULT '{}',
  display_text TEXT    NOT NULL,
  UNIQUE (quest_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_quest_steps_quest_id ON quest_steps(quest_id);

-- ── Seed existing quests ──────────────────────────────────────────────────────

INSERT INTO quests (id, name, description, min_level, repeatable, active, trigger_type, trigger_ref) VALUES
  ('widow_revenge',
   'The Widow''s Revenge',
   'A grieving widow begs you to avenge her husband.',
   1, FALSE, TRUE, 'tavern_encounter', 'crying_widow'),

  ('missing_merchant',
   'The Missing Merchant',
   'A merchant vanished on the road. Find out what happened.',
   1, FALSE, TRUE, 'tavern_encounter', 'missing_merchant_rumour'),

  ('cursed_blade_bearer',
   'The Cursed Blade',
   'A dark blade has bonded to your will. Its power is real. So is its cost.',
   3, FALSE, TRUE, 'event', 'cursed_blade'),

  ('wardens_fall',
   'The Warden''s Fall',
   'You slew the dragon — but it was the last Warden, keeping something sealed. Now it is free.',
   12, FALSE, TRUE, 'auto', 'dragon_first_kill')

ON CONFLICT (id) DO NOTHING;

-- ── Quest steps ───────────────────────────────────────────────────────────────

INSERT INTO quest_steps (quest_id, step_order, type, params, effects, display_text) VALUES

  -- Widow's Revenge (1 step: kill any named enemy)
  ('widow_revenge', 1, 'kill_named', '{}',
   '{"exp_level_mult":400,"gold_level_mult":300,"charm_delta":3,"rep_changes":{"knights":3,"merchants":2}}',
   'Slay a legendary named enemy in the forest.'),

  -- Missing Merchant (2 steps: travel then choice)
  ('missing_merchant', 1, 'travel',
   '{"town_id":"$targetTown"}',
   '{}',
   'Travel to [town] and search for the missing merchant.'),

  ('missing_merchant', 2, 'choice',
   '{"prompt":"The merchant lies wounded in the road. His attackers fled, leaving his purse behind.","options":[{"key":"H","label":"Help him back to town","outcome_text":"You help the wounded merchant to safety. He grips your hand with tears in his eyes.","effects":{"exp_level_mult":500,"alignment_delta":15,"charm_delta":3,"rep_changes":{"knights":3,"merchants":2}}},{"key":"T","label":"Take his gold and leave","outcome_text":"You pocket the coin and walk away. The merchant watches you go with hollow eyes.","effects":{"gold_level_mult":300,"alignment_delta":-20,"rep_changes":{"merchants":-3}}}]}',
   '{}',
   'You have found the scene. Make your choice.'),

  -- Cursed Blade (1 display step — completion via druid cleanse, not yet implemented)
  ('cursed_blade_bearer', 1, 'event_trigger',
   '{"event_id":"cursed_blade"}',
   '{}',
   'Bear the curse — or seek a druid to cleanse it (Thornreach, 5,000 gold).'),

  -- Warden's Fall (6 steps: 4 npc_talk, 2 kill_boss)
  ('wardens_fall', 1, 'npc_talk',
   '{"npc_id":"scholar_voss","town_id":"dawnmark"}',
   '{}',
   'Return to Dawnmark. Scholar Voss has urgent news.'),

  ('wardens_fall', 2, 'npc_talk',
   '{"npc_id":"captain_ralen","town_id":"ironhold"}',
   '{}',
   'Travel to Ironhold — the shadow armies have already reached the military front.'),

  ('wardens_fall', 3, 'npc_talk',
   '{"npc_id":"archivist_thessaly","town_id":"stormwatch"}',
   '{}',
   'Travel to Stormwatch — the Archivist holds records of what was sealed.'),

  ('wardens_fall', 4, 'kill_boss',
   '{"boss_id":"pale_captain","town_id":"graveport"}',
   '{}',
   'Travel to Graveport — the last Warden''s journal is aboard a ghost ship.'),

  ('wardens_fall', 5, 'npc_talk',
   '{"npc_id":"ancient_forge","town_id":"ashenfall"}',
   '{}',
   'Travel to Ashenfall — forge the Warden''s Seal at the Ancient Forge.'),

  ('wardens_fall', 6, 'kill_boss',
   '{"boss_id":"veilborn","town_id":"dawnmark"}',
   '{}',
   'Return to Dawnmark — the Veilborn has arrived. Make your stand.')

ON CONFLICT (quest_id, step_order) DO NOTHING;
