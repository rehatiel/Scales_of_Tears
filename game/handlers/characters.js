// Character management handlers — multi-character account system
const { getPlayer, updatePlayer, getCharactersForAccount, createCharacterForAccount } = require('../../db');
const {
  getCharSelectScreen, getCharDeleteMenuScreen, getCharDeleteConfirmScreen,
  getTownScreen, getSetupScreen,
} = require('../engine');

const TOTAL_SLOTS = 3;

// ── Shared helper ──────────────────────────────────────────────────────────────
async function requireAccount(req, res) {
  const accountId = req.session.accountId;
  if (!accountId) {
    res.status(401).json({ error: 'Not logged in.' });
    return null;
  }
  return accountId;
}

// Clear all character-specific session state, keeping accountId and the session cookie
function clearCharacterSession(req) {
  const accountId = req.session.accountId;
  const cookie = req.session.cookie;
  for (const key of Object.keys(req.session)) {
    delete req.session[key];
  }
  req.session.accountId = accountId;
  req.session.cookie = cookie;
}

// ── char_switch — show the character select screen (in-game) ───────────────────
async function char_switch({ player, req, res, pendingMessages }) {
  const accountId = req.session.accountId;
  if (!accountId) {
    // Legacy session without accountId — just go to town
    return res.json({ ...getTownScreen(player), pendingMessages });
  }
  const characters = await getCharactersForAccount(accountId);
  return res.json({ ...getCharSelectScreen(characters, player.id, TOTAL_SLOTS), pendingMessages });
}

// ── char_select_slot — activate a character ────────────────────────────────────
async function char_select_slot({ player, param, req, res, pendingMessages }) {
  const accountId = await requireAccount(req, res);
  if (!accountId) return;

  const targetId = parseInt(param);
  const characters = await getCharactersForAccount(accountId);
  const target = characters.find(c => c.id === targetId);

  if (!target) {
    return res.json({ ...getCharSelectScreen(characters, player?.id, TOTAL_SLOTS), pendingMessages: ['`@Character not found.'] });
  }

  clearCharacterSession(req);
  req.session.playerId = target.id;

  const fresh = await getPlayer(target.id);
  if (!fresh.setup_complete) return res.json(getSetupScreen('name'));
  return res.json({ ...getTownScreen(fresh), pendingMessages: [`\`0Switched to \`!${fresh.handle}\`0.`] });
}

// ── char_new — create a character in an empty slot ────────────────────────────
async function char_new({ player, param, req, res, pendingMessages }) {
  const accountId = await requireAccount(req, res);
  if (!accountId) return;

  const slot = parseInt(param) || 0;
  if (slot < 1 || slot > TOTAL_SLOTS) {
    return res.json({ screen: 'login', lines: [], choices: [], pendingMessages: ['`@Invalid slot.'] });
  }

  const characters = await getCharactersForAccount(accountId);
  if (characters.length >= TOTAL_SLOTS) {
    return res.json({ ...getCharSelectScreen(characters, player?.id, TOTAL_SLOTS), pendingMessages: ['`@All character slots are full.'] });
  }
  const takenSlots = new Set(characters.map(c => c.slot));
  if (takenSlots.has(slot)) {
    return res.json({ ...getCharSelectScreen(characters, player?.id, TOTAL_SLOTS), pendingMessages: ['`@That slot is already taken.'] });
  }

  const newPlayerId = await createCharacterForAccount(accountId, slot);
  clearCharacterSession(req);
  req.session.playerId = newPlayerId;

  return res.json(getSetupScreen('name'));
}

// ── char_delete_menu — list deletable characters ───────────────────────────────
async function char_delete_menu({ player, req, res, pendingMessages }) {
  const accountId = req.session.accountId;
  if (!accountId) return res.json({ ...getTownScreen(player), pendingMessages });
  const characters = await getCharactersForAccount(accountId);
  return res.json({ ...getCharDeleteMenuScreen(characters, player.id), pendingMessages });
}

// ── char_delete — show confirmation screen ────────────────────────────────────
async function char_delete({ player, param, req, res, pendingMessages }) {
  const accountId = req.session.accountId;
  if (!accountId) return res.json({ ...getTownScreen(player), pendingMessages });

  const targetId = parseInt(param);
  const characters = await getCharactersForAccount(accountId);
  const target = characters.find(c => c.id === targetId);

  if (!target) {
    return res.json({ ...getCharDeleteMenuScreen(characters, player.id), pendingMessages: ['`@Character not found.'] });
  }
  if (target.id === player.id) {
    return res.json({ ...getCharDeleteMenuScreen(characters, player.id), pendingMessages: ['`@You cannot delete your currently active character.'] });
  }

  return res.json({ ...getCharDeleteConfirmScreen(target), pendingMessages });
}

// ── char_delete_confirm — permanently delete a character ──────────────────────
async function char_delete_confirm({ player, param, req, res, pendingMessages }) {
  const accountId = req.session.accountId;
  if (!accountId) return res.json({ ...getTownScreen(player), pendingMessages });

  const targetId = parseInt(param);
  const characters = await getCharactersForAccount(accountId);
  const target = characters.find(c => c.id === targetId);

  if (!target) {
    return res.json({ ...getCharSelectScreen(characters, player.id, TOTAL_SLOTS), pendingMessages: ['`@Character not found.'] });
  }
  if (target.id === player.id) {
    return res.json({ ...getCharSelectScreen(characters, player.id, TOTAL_SLOTS), pendingMessages: ['`@You cannot delete your active character.'] });
  }

  const { pool } = require('../../db');
  await pool.query('DELETE FROM players WHERE id = $1 AND account_id = $2', [targetId, accountId]);

  const remaining = await getCharactersForAccount(accountId);
  const deletedName = target.handle || `Slot ${target.slot}`;
  return res.json({
    ...getCharSelectScreen(remaining, player.id, TOTAL_SLOTS),
    pendingMessages: [`\`8${deletedName} has been deleted.`],
  });
}

module.exports = {
  char_switch,
  char_select_slot,
  char_new,
  char_delete_menu,
  char_delete,
  char_delete_confirm,
};
