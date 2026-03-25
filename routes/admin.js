const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool, getAllPlayers, getRecentNews, addNews, updatePlayer, TODAY, getBannerOverride, setBanner, deleteBanner, getAllBanners, loadBanners, getWorldState, setWorldState } = require('../db');
const { runNewDay } = require('../game/newday');
const { LOCATION_BANNERS } = require('../game/engine');

const router = express.Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error('FATAL: ADMIN_PASSWORD environment variable is not set');
  process.exit(1);
}

// Timing-safe string comparison to prevent timing-oracle attacks
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  // Always run timingSafeEqual on equal-length buffers to avoid length leaks
  const padded = Buffer.alloc(Math.max(aBuf.length, bBuf.length));
  aBuf.copy(padded);
  const ref = Buffer.alloc(padded.length);
  bBuf.copy(ref);
  return aBuf.length === bBuf.length && crypto.timingSafeEqual(padded, ref);
}

// Auth middleware — checks Authorization: Bearer <password>
router.use((req, res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!safeCompare(token, ADMIN_PASSWORD)) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

const ar = fn => (req, res, next) => fn(req, res, next).catch(next);

// ── Players ───────────────────────────────────────────────────────────────────

// GET /api/admin/players — list all players (full records), paginated
router.get('/players', ar(async (req, res) => {
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
  const offset = Math.max(0, parseInt(req.query.offset) || 0);
  const { rows } = await pool.query(
    'SELECT * FROM players ORDER BY level DESC, exp DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  res.json(rows);
}));

// GET /api/admin/players/:id — single player full record
router.get('/players/:id', ar(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM players WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Player not found' });
  res.json(rows[0]);
}));

// PUT /api/admin/players/:id — update player fields (whitelist enforced)
// Integer fields — value must be a safe integer
const INTEGER_FIELDS = new Set([
  'sex', 'class', 'level', 'exp', 'gold', 'bank', 'gems',
  'hit_points', 'hit_max', 'strength', 'defense', 'charm', 'stamina',
  'kills', 'lays', 'kids', 'has_horse', 'married_to',
  'dead', 'near_death', 'poisoned',
  'captive', 'camping',
  'travel_segments_done', 'travel_segments_total',
  'weapon_num', 'arm_num',
  'antidote_owned', 'forge_weapon_upgraded', 'forge_armor_upgraded',
  'setup_complete', 'skill_points', 'skill_uses_left',
  'fights_left', 'human_fights_left', 'banned',
]);
// String fields
const STRING_FIELDS = new Set([
  'handle', 'near_death_by', 'captive_location', 'travel_to',
  'current_town', 'weapon_name', 'arm_name',
]);

const EDITABLE_FIELDS = new Set([...INTEGER_FIELDS, ...STRING_FIELDS]);

router.put('/players/:id', ar(async (req, res) => {
  const { id } = req.params;
  const fields = req.body;
  const safe = {};
  for (const [k, v] of Object.entries(fields)) {
    if (!EDITABLE_FIELDS.has(k)) continue;
    if (v === null || v === undefined) continue; // skip nulls; don't overwrite with null
    if (INTEGER_FIELDS.has(k)) {
      if (!Number.isFinite(Number(v)))
        return res.status(400).json({ error: `Field "${k}" must be a number` });
      safe[k] = Math.trunc(Number(v));
    } else {
      safe[k] = String(v);
    }
  }
  if (!Object.keys(safe).length) return res.status(400).json({ error: 'No valid fields' });
  await updatePlayer(parseInt(id), safe);
  console.log(`[ADMIN] PUT /players/${id} — fields: ${Object.keys(safe).join(', ')}`);
  const { rows } = await pool.query('SELECT * FROM players WHERE id = $1', [id]);
  res.json(rows[0]);
}));

// DELETE /api/admin/players/:id — permanently remove a player
router.delete('/players/:id', ar(async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query('SELECT id, handle FROM players WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Player not found' });
  await pool.query('DELETE FROM players WHERE id = $1', [id]);
  await addNews(`\`8[ADMIN] Player "${rows[0].handle}" has been removed.`);
  console.log(`[ADMIN] DELETE /players/${id} — removed "${rows[0].handle}"`);
  res.json({ ok: true });
}));

// POST /api/admin/players/:id/password — reset a player's password
router.post('/players/:id/password', ar(async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  const hash = await bcrypt.hash(password, 10);
  await pool.query('UPDATE players SET password_hash = $1 WHERE id = $2', [hash, id]);
  console.log(`[ADMIN] POST /players/${id}/password — password reset`);
  res.json({ ok: true });
}));

// POST /api/admin/players/:id/ban — ban or unban (bans the whole account)
router.post('/players/:id/ban', ar(async (req, res) => {
  const { id } = req.params;
  const { banned } = req.body;
  const r = await pool.query('SELECT account_id FROM players WHERE id = $1', [id]);
  const accountId = r.rows[0]?.account_id;
  if (accountId) {
    const { setBanAccount } = require('../db');
    await setBanAccount(accountId, !!banned);
  }
  await pool.query('UPDATE players SET banned = $1 WHERE id = $2', [banned ? 1 : 0, id]);
  console.log(`[ADMIN] POST /players/${id}/ban — banned=${!!banned} (accountId=${accountId})`);
  res.json({ ok: true, banned: !!banned });
}));

// ── Impersonate ────────────────────────────────────────────────────────────────

// In-memory one-time tokens: token -> { playerId, expires }
const impersonateTokens = new Map();

// POST /api/admin/players/:id/impersonate — generate a one-time login token
router.post('/players/:id/impersonate', ar(async (req, res) => {
  const { rows } = await pool.query('SELECT id, handle FROM players WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Player not found' });
  const token = crypto.randomBytes(24).toString('hex');
  impersonateTokens.set(token, { playerId: rows[0].id, expires: Date.now() + 5 * 60 * 1000 });
  console.log(`[ADMIN] impersonate token generated for player ${rows[0].id} ("${rows[0].handle}")`);
  res.json({ ok: true, token });
}));

// Export tokens map so auth.js can read it
router.impersonateTokens = impersonateTokens;

// ── Stats ─────────────────────────────────────────────────────────────────────

// GET /api/admin/stats — dashboard overview
router.get('/stats', ar(async (req, res) => {
  const [totals, activity, levels, economy, pvp] = await Promise.all([
    pool.query(`SELECT
      COUNT(*) FILTER (WHERE setup_complete = 1)             AS total_players,
      COUNT(*) FILTER (WHERE setup_complete = 0)             AS incomplete,
      COUNT(*) FILTER (WHERE banned = 1)                     AS banned,
      COUNT(*) FILTER (WHERE dead = 1)                       AS dead,
      COUNT(*) FILTER (WHERE near_death = 1)                 AS near_death,
      COUNT(*) FILTER (WHERE captive = 1)                    AS captive,
      COUNT(*) FILTER (WHERE camping = 1)                    AS camping,
      COUNT(*) FILTER (WHERE travel_to IS NOT NULL AND travel_to != '') AS travelling
    FROM players`),
    pool.query(`SELECT
      COUNT(*) FILTER (WHERE last_seen > NOW() - INTERVAL '10 minutes') AS online_now,
      COUNT(*) FILTER (WHERE last_seen > NOW() - INTERVAL '24 hours')   AS active_24h,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')  AS new_today
    FROM players`),
    pool.query(`SELECT level, COUNT(*) AS count FROM players WHERE setup_complete = 1 GROUP BY level ORDER BY level`),
    pool.query(`SELECT
      COALESCE(SUM(gold), 0)        AS total_gold_hand,
      COALESCE(SUM(bank), 0)        AS total_gold_bank,
      COALESCE(SUM(gold + bank), 0) AS total_gold_all
    FROM players WHERE setup_complete = 1`),
    pool.query(`SELECT
      COALESCE(SUM(kills), 0)             AS total_kills,
      COALESCE(SUM(human_fights_left), 0) AS pvp_fights_remaining
    FROM players WHERE setup_complete = 1`),
  ]);
  res.json({
    ...totals.rows[0],
    ...activity.rows[0],
    ...economy.rows[0],
    ...pvp.rows[0],
    level_distribution: levels.rows,
  });
}));

// ── Hall of Kings ──────────────────────────────────────────────────────────────

// GET /api/admin/hall-of-kings — historical dragon kill records
router.get('/hall-of-kings', ar(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM hall_of_kings ORDER BY id ASC');
  res.json(rows);
}));

// ── News ──────────────────────────────────────────────────────────────────────

// GET /api/admin/news — recent news
router.get('/news', ar(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM news ORDER BY id DESC LIMIT 100');
  res.json(rows);
}));

// DELETE /api/admin/news/:id — remove a news entry
router.delete('/news/:id', ar(async (req, res) => {
  await pool.query('DELETE FROM news WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// GET /api/admin/migrations — applied migrations
router.get('/migrations', ar(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM schema_migrations ORDER BY id ASC');
  res.json(rows);
}));

// POST /api/admin/reset-player — reset a player's dead/near_death flag
router.post('/reset-player', ar(async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });
  await updatePlayer(id, { dead: 0, near_death: 0, near_death_by: '', hit_points: 15 });
  res.json({ ok: true });
}));

// POST /api/admin/new-day — trigger new day for all active players
router.post('/new-day', ar(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM players WHERE setup_complete = 1');
  let count = 0;
  for (const player of rows) {
    const { updates } = await runNewDay(player);
    await updatePlayer(player.id, { ...updates, last_day: TODAY() });
    count++;
  }
  await addNews('`$[ADMIN] A new day has been triggered manually.');
  res.json({ ok: true, playersUpdated: count });
}));

// GET /api/admin/new-day/preview — show what a new day would change (dry run)
router.get('/new-day/preview', ar(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM players WHERE setup_complete = 1');
  const preview = [];
  for (const player of rows) {
    const { updates, messages } = await runNewDay(player, true);
    const changes = [];
    if (updates.level && updates.level !== player.level) changes.push(`Level ${player.level} → ${updates.level}`);
    if (updates.dead === 1) changes.push('Dies (near-death expired)');
    if (updates.dead === 0 && player.dead) changes.push('Reincarnated');
    if (updates.bank && updates.bank !== player.bank) {
      const interest = updates.bank - player.bank;
      if (interest > 0) changes.push(`Bank +${interest.toLocaleString()} gold interest`);
    }
    if (updates.captive === 0 && player.captive) changes.push('Escapes captivity');
    preview.push({ id: player.id, handle: player.handle, level: player.level, changes, messageCount: messages.length });
  }
  res.json(preview);
}));

// POST /api/admin/announce — post a system news message
router.post('/announce', ar(async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });
  await addNews(`\`$[SYSTEM] ${message.substring(0, 80)}`);
  res.json({ ok: true });
}));

// ── Banners ───────────────────────────────────────────────────────────────────

// GET /api/admin/banners — list all known keys with override status + first-line preview
router.get('/banners', ar(async (req, res) => {
  const dbRows = await getAllBanners();
  const overrideKeys = new Set(dbRows.map(r => r.key));
  const known = Object.keys(LOCATION_BANNERS).map(key => ({
    key,
    overridden: overrideKeys.has(key),
    preview: (getBannerOverride(key) || LOCATION_BANNERS[key].lines)[0] || '',
    updatedAt: dbRows.find(r => r.key === key)?.updated_at || null,
  }));
  res.json(known);
}));

// GET /api/admin/banners/:key — get current lines for a banner (override or hardcoded)
router.get('/banners/:key', ar(async (req, res) => {
  const { key } = req.params;
  const override = getBannerOverride(key);
  const hardcoded = LOCATION_BANNERS[key];
  if (!override && !hardcoded) return res.status(404).json({ error: `Unknown banner key: ${key}` });
  res.json({
    key,
    lines: override || hardcoded.lines,
    overridden: !!override,
  });
}));

// PUT /api/admin/banners/:key — set a banner override
router.put('/banners/:key', ar(async (req, res) => {
  const { key } = req.params;
  const { lines } = req.body;
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 10)
    return res.status(400).json({ error: 'lines must be a non-empty array of up to 10 strings' });
  if (!lines.every(l => typeof l === 'string'))
    return res.status(400).json({ error: 'every line must be a string' });
  await setBanner(key, lines);
  res.json({ ok: true, key, lines });
}));

// DELETE /api/admin/banners/:key — remove override and revert to hardcoded
router.delete('/banners/:key', ar(async (req, res) => {
  const { key } = req.params;
  await deleteBanner(key);
  const hardcoded = LOCATION_BANNERS[key];
  res.json({ ok: true, key, revertedTo: hardcoded ? hardcoded.lines : null });
}));

// ── Backup / Restore ──────────────────────────────────────────────────────────

// GET /api/admin/backup — export all game data as JSON
router.get('/backup', ar(async (req, res) => {
  const [players, news, banners, hok] = await Promise.all([
    pool.query('SELECT * FROM players ORDER BY id ASC'),
    pool.query('SELECT * FROM news ORDER BY id ASC'),
    pool.query('SELECT * FROM banners ORDER BY key ASC'),
    pool.query('SELECT * FROM hall_of_kings ORDER BY id ASC'),
  ]);
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tables: {
      players:       players.rows,
      news:          news.rows,
      banners:       banners.rows,
      hall_of_kings: hok.rows,
    },
  };
  res.setHeader('Content-Disposition', `attachment; filename="lord-backup-${Date.now()}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.json(payload);
}));

// POST /api/admin/restore — import a backup JSON (replaces all rows)
router.post('/restore', ar(async (req, res) => {
  const { tables, version } = req.body;
  if (version !== 1 || !tables) return res.status(400).json({ error: 'Invalid backup format' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (Array.isArray(tables.players) && tables.players.length) {
      await client.query('DELETE FROM players');
      for (const p of tables.players) {
        const cols = Object.keys(p);
        const vals = cols.map((_, i) => `$${i + 1}`);
        await client.query(
          `INSERT INTO players (${cols.join(',')}) VALUES (${vals.join(',')}) ON CONFLICT (id) DO NOTHING`,
          cols.map(c => p[c])
        );
      }
    }

    if (Array.isArray(tables.news) && tables.news.length) {
      await client.query('DELETE FROM news');
      for (const n of tables.news) {
        await client.query(
          'INSERT INTO news (id, day, message) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
          [n.id, n.day, n.message]
        );
      }
    }

    if (Array.isArray(tables.banners) && tables.banners.length) {
      await client.query('DELETE FROM banners');
      for (const b of tables.banners) {
        await client.query(
          'INSERT INTO banners (key, lines, updated_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING',
          [b.key, JSON.stringify(b.lines), b.updated_at]
        );
      }
      await loadBanners();
    }

    if (Array.isArray(tables.hall_of_kings) && tables.hall_of_kings.length) {
      await client.query('DELETE FROM hall_of_kings');
      for (const h of tables.hall_of_kings) {
        const cols = Object.keys(h);
        const vals = cols.map((_, i) => `$${i + 1}`);
        await client.query(
          `INSERT INTO hall_of_kings (${cols.join(',')}) VALUES (${vals.join(',')}) ON CONFLICT (id) DO NOTHING`,
          cols.map(c => h[c])
        );
      }
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// ── Server settings ───────────────────────────────────────────────────────────
// Currently: registration_open (1 = open, 0 = closed)

router.get('/settings', ar(async (req, res) => {
  const regOpen = await getWorldState('registration_open');
  res.json({ registration_open: regOpen !== '0' }); // default open
}));

router.put('/settings', ar(async (req, res) => {
  const { registration_open } = req.body;
  if (typeof registration_open !== 'boolean')
    return res.status(400).json({ error: 'registration_open must be a boolean.' });
  await setWorldState('registration_open', registration_open ? '1' : '0');
  res.json({ ok: true, registration_open });
}));

module.exports = router;
