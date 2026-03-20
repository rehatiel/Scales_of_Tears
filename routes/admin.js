const express = require('express');
const { pool, getAllPlayers, getRecentNews, addNews, updatePlayer, TODAY, getBannerOverride, setBanner, deleteBanner, getAllBanners } = require('../db');
const { runNewDay } = require('../game/newday');
const { LOCATION_BANNERS } = require('../game/engine');

const router = express.Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'lordadmin';

// Auth middleware — checks Authorization: Bearer <password>
router.use((req, res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

const ar = fn => (req, res, next) => fn(req, res, next).catch(next);

// GET /api/admin/players — list all players
router.get('/players', ar(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, username, handle, level, class, exp, gold, dead, setup_complete, last_seen, created_at FROM players ORDER BY level DESC, exp DESC'
  );
  res.json(rows);
}));

// GET /api/admin/news — recent news
router.get('/news', ar(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM news ORDER BY id DESC LIMIT 50');
  res.json(rows);
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

module.exports = router;
