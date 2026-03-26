// quest_runner.js — generic executor for DB-driven quests
// Quests in CUSTOM_QUESTS use bespoke handlers; all others run through this module.
const { QUEST_DEFINITIONS, getQuestStep } = require('./quests');

// Quests that have hand-written logic and only use the DB for display text
const CUSTOM_QUESTS = new Set(['wardens_fall', 'cursed_blade_bearer']);

function isGenericQuest(questId) {
  return !!questId && !CUSTOM_QUESTS.has(questId);
}

// Rep column name by faction key used in effects.rep_changes
const REP_COLS = {
  knights:     'rep_knights',
  merchants:   'rep_merchants',
  guild:       'rep_guild',
  druids:      'rep_druids',
  necromancers:'rep_necromancers',
};

// Compute player stat changes from a step effects JSONB object.
// Returns { updates, messages } — updates is a partial player record, messages are reward strings.
function computeEffects(player, effects) {
  const updates  = {};
  const messages = [];

  const expGain  = (effects.exp_flat  || 0) + ((effects.exp_level_mult  || 0) * player.level);
  const goldGain = (effects.gold_flat || 0) + ((effects.gold_level_mult || 0) * player.level);

  if (expGain > 0) {
    updates.exp  = Number(player.exp)  + expGain;
    messages.push(`\`$+${expGain.toLocaleString()} exp`);
  }
  if (goldGain > 0) {
    updates.gold = Number(player.gold) + goldGain;
    messages.push(`\`$+${goldGain.toLocaleString()} gold`);
  }
  if (effects.alignment_delta) {
    updates.alignment = Math.max(-100, Math.min(100, (player.alignment || 0) + effects.alignment_delta));
    const sign = effects.alignment_delta > 0 ? '+' : '';
    messages.push(`\`$${sign}${effects.alignment_delta} alignment`);
  }
  if (effects.charm_delta) {
    updates.charm = (player.charm || 0) + effects.charm_delta;
    const sign = effects.charm_delta > 0 ? '+' : '';
    messages.push(`\`$${sign}${effects.charm_delta} charm`);
  }
  if (effects.strength_delta) {
    updates.strength = (player.strength || 0) + effects.strength_delta;
  }
  if (effects.hit_max_delta) {
    updates.hit_max = (player.hit_max || 0) + effects.hit_max_delta;
  }
  if (effects.rep_changes) {
    for (const [faction, delta] of Object.entries(effects.rep_changes)) {
      const col = REP_COLS[faction];
      if (col) updates[col] = Math.max(-100, Math.min(100, (player[col] || 0) + delta));
    }
  }

  return { updates, messages };
}

// Called after a named enemy kill. If the current quest step is kill_named, completes it.
// Returns { updates, messages, questName } or null.
function checkKillNamedTrigger(player) {
  if (!isGenericQuest(player.quest_id)) return null;
  const step = getQuestStep(player.quest_id, player.quest_step);
  if (!step || step.type !== 'kill_named') return null;

  const { updates, messages } = computeEffects(player, step.effects || {});
  return {
    updates: { ...updates, quest_id: '', quest_step: 0, quest_data: '' },
    messages,
    questName: QUEST_DEFINITIONS[player.quest_id]?.name || player.quest_id,
  };
}

// Called after a town arrival. If the current quest step is a travel step targeting townId,
// returns the advance info (nextStep, nextStepOrder). Otherwise null.
// Resolves the special "$targetTown" token via quest_data.
function checkTravelTrigger(player, townId) {
  if (!isGenericQuest(player.quest_id)) return null;
  const step = getQuestStep(player.quest_id, player.quest_step);
  if (!step || step.type !== 'travel') return null;

  let targetTownId = (step.params || {}).town_id;
  if (targetTownId === '$targetTown') {
    let qdata = {};
    try { qdata = JSON.parse(player.quest_data || '{}'); } catch { /* ignore */ }
    targetTownId = qdata.targetTown;
  }
  if (targetTownId !== townId) return null;

  const nextStepOrder = player.quest_step + 1;
  const nextStep = getQuestStep(player.quest_id, nextStepOrder);
  return { nextStep, nextStepOrder };
}

// Returns the current step if it is a choice step, otherwise null.
function getChoiceStep(player) {
  if (!isGenericQuest(player.quest_id)) return null;
  const step = getQuestStep(player.quest_id, player.quest_step);
  if (!step || step.type !== 'choice') return null;
  return step;
}

// Executes a choice option (identified by choiceKey) on the current choice step.
// Returns { updates, messages, questComplete, questName } or null.
function executeQuestChoice(player, choiceKey) {
  const step = getChoiceStep(player);
  if (!step) return null;

  const option = (step.params?.options || []).find(o => o.key === choiceKey);
  if (!option) return null;

  const { updates, messages } = computeEffects(player, option.effects || {});
  const nextStep     = getQuestStep(player.quest_id, player.quest_step + 1);
  const questComplete = !nextStep;

  return {
    updates: {
      ...updates,
      ...(questComplete
        ? { quest_id: '', quest_step: 0, quest_data: '' }
        : { quest_step: player.quest_step + 1 }),
    },
    messages: option.outcome_text ? [option.outcome_text, ...messages] : messages,
    questComplete,
    questName: QUEST_DEFINITIONS[player.quest_id]?.name || player.quest_id,
  };
}

// Advances the current step (applying its effects) to the next, or completes the quest.
// Used for step types that auto-advance when triggered (npc_talk, event_trigger).
// Returns { updates, messages, nextStep, questComplete, questName } or null.
function advanceGenericQuestStep(player) {
  if (!isGenericQuest(player.quest_id)) return null;
  const step = getQuestStep(player.quest_id, player.quest_step);
  if (!step) return null;

  const { updates, messages } = computeEffects(player, step.effects || {});
  const nextStep      = getQuestStep(player.quest_id, player.quest_step + 1);
  const questComplete = !nextStep;

  return {
    updates: {
      ...updates,
      ...(questComplete
        ? { quest_id: '', quest_step: 0, quest_data: '' }
        : { quest_step: player.quest_step + 1 }),
    },
    messages,
    nextStep,
    questComplete,
    questName: QUEST_DEFINITIONS[player.quest_id]?.name || player.quest_id,
  };
}

module.exports = {
  isGenericQuest,
  computeEffects,
  checkKillNamedTrigger,
  checkTravelTrigger,
  getChoiceStep,
  executeQuestChoice,
  advanceGenericQuestStep,
};
