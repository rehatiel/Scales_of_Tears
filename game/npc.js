'use strict';

/**
 * Shared NPC memory utilities.
 * Handles visit tracking, relationship levels, and topic selection.
 * No game-specific knowledge lives here — that stays in the handlers.
 */

// Relationship level thresholds (visit_count required)
const REL_THRESHOLDS = [
  { level: 4, name: 'confidant',    minVisits: 30 },
  { level: 3, name: 'trusted',      minVisits: 15 },
  { level: 2, name: 'regular',      minVisits: 5  },
  { level: 1, name: 'acquaintance', minVisits: 1  },
  { level: 0, name: 'stranger',     minVisits: 0  },
];

function calcRelLevel(visitCount) {
  for (const r of REL_THRESHOLDS) {
    if (visitCount >= r.minVisits) return r.level;
  }
  return 0;
}

/**
 * Record a visit to an NPC. Increments visit_count once per real day.
 * Returns updated memory object (caller must save it).
 */
function recordVisit(mem) {
  const today = Math.floor(Date.now() / 86400000);
  const updated = { ...mem, topics_seen: [...(mem.topics_seen || [])], player_answers: { ...(mem.player_answers || {}) }, notes: { ...(mem.notes || {}) } };
  if (updated.last_visit < today) {
    updated.visit_count = (updated.visit_count || 0) + 1;
    updated.last_visit  = today;
  }
  updated.relationship_level = calcRelLevel(updated.visit_count);
  return updated;
}

/**
 * Pick one unseen topic from a pool.
 * Marks it seen. If all are exhausted, resets the cycle and picks fresh.
 * Returns { topic: string, mem: updatedMem }.
 */
function pickTopic(mem, topicPool) {
  if (!topicPool || topicPool.length === 0) return { topic: null, mem };
  const seen     = new Set(mem.topics_seen || []);
  const unseen   = topicPool.filter(t => !seen.has(t));
  const drawFrom = unseen.length > 0 ? unseen : topicPool;
  const topic    = drawFrom[Math.floor(Math.random() * drawFrom.length)];
  const newSeen  = unseen.length > 0 ? [...(mem.topics_seen || []), topic] : [topic];
  return { topic, mem: { ...mem, topics_seen: newSeen } };
}

/**
 * Store an answer the player gave to an NPC question.
 */
function storeAnswer(mem, key, value) {
  return { ...mem, player_answers: { ...(mem.player_answers || {}), [key]: value } };
}

/**
 * Update arbitrary notes on an NPC's memory of a player.
 */
function updateNotes(mem, updates) {
  return { ...mem, notes: { ...(mem.notes || {}), ...updates } };
}

module.exports = { calcRelLevel, recordVisit, pickTopic, storeAnswer, updateNotes };
