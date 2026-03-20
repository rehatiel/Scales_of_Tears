const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://lord:lordpass@localhost:5432/lorddb',
});

async function initDb() {
  // Ensure the migrations tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // Load applied migrations
  const { rows: applied } = await pool.query('SELECT name FROM schema_migrations');
  const appliedSet = new Set(applied.map(r => r.name));

  // Read and sort migration files
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (appliedSet.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await pool.query('COMMIT');
      console.log('Applied migration:', file);
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  }

  console.log('Database schema ready.');
  await loadBanners();
}

const TODAY = () => Math.floor(Date.now() / 86400000);

async function getPlayer(id) {
  const { rows } = await pool.query('SELECT * FROM players WHERE id = $1', [id]);
  return rows[0] || null;
}

async function getPlayerByUsername(username) {
  const { rows } = await pool.query('SELECT * FROM players WHERE username = $1', [username]);
  return rows[0] || null;
}

async function updatePlayer(id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  await pool.query(`UPDATE players SET ${set} WHERE id = $${keys.length + 1}`, [...keys.map(k => fields[k]), id]);
}

async function createPlayer(username, passwordHash) {
  const { rows } = await pool.query(
    'INSERT INTO players (username, password_hash) VALUES ($1, $2) RETURNING id',
    [username, passwordHash]
  );
  return rows[0].id;
}

async function getNearDeathPlayers(excludeId) {
  const { rows } = await pool.query(
    'SELECT * FROM players WHERE near_death = 1 AND id != $1 ORDER BY RANDOM() LIMIT 3',
    [excludeId]
  );
  return rows;
}

async function getAllPlayers() {
  const { rows } = await pool.query(
    'SELECT id, handle, level, class, sex, last_seen, dead, times_won, setup_complete FROM players WHERE setup_complete = 1 ORDER BY level DESC, exp DESC'
  );
  return rows;
}

async function getRecentNews(limit = 20) {
  const { rows } = await pool.query('SELECT * FROM news ORDER BY id DESC LIMIT $1', [limit]);
  return rows;
}

async function addNews(message) {
  await pool.query('INSERT INTO news (day, message) VALUES ($1, $2)', [TODAY(), message]);
}

async function getHallOfKings() {
  const { rows } = await pool.query('SELECT * FROM hall_of_kings ORDER BY id ASC');
  return rows;
}

async function addToHallOfKings(player) {
  await pool.query(
    'INSERT INTO hall_of_kings (handle, level, kills, class, times_won) VALUES ($1, $2, $3, $4, $5)',
    [player.handle, player.level, player.kills, player.class, player.times_won + 1]
  );
}

async function getCaptivePlayers(excludeId) {
  const { rows } = await pool.query(
    'SELECT * FROM players WHERE captive = 1 AND id != $1 ORDER BY RANDOM() LIMIT 5',
    [excludeId]
  );
  return rows;
}

async function getPlayersInTown(townId, excludeId) {
  const { rows } = await pool.query(
    `SELECT id, handle, level, class, sex, last_seen, dead, times_won, setup_complete
     FROM players
     WHERE current_town = $1 AND setup_complete = 1 AND id != $2
     ORDER BY level DESC, exp DESC`,
    [townId, excludeId]
  );
  return rows;
}

// ── Banner cache ──────────────────────────────────────────────────────────────

let bannerCache = {};

async function loadBanners() {
  const { rows } = await pool.query('SELECT key, lines FROM banners');
  bannerCache = {};
  for (const row of rows) bannerCache[row.key] = row.lines;
}

function getBannerOverride(key) {
  return bannerCache[key] || null;
}

async function setBanner(key, lines) {
  await pool.query(
    `INSERT INTO banners (key, lines, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET lines = $2, updated_at = NOW()`,
    [key, JSON.stringify(lines)]
  );
  bannerCache[key] = lines;
}

async function deleteBanner(key) {
  await pool.query('DELETE FROM banners WHERE key = $1', [key]);
  delete bannerCache[key];
}

async function getAllBanners() {
  const { rows } = await pool.query('SELECT key, lines, updated_at FROM banners ORDER BY key');
  return rows;
}

module.exports = { pool, initDb, getPlayer, getPlayerByUsername, updatePlayer, createPlayer, getAllPlayers, getPlayersInTown, getNearDeathPlayers, getCaptivePlayers, getRecentNews, addNews, getHallOfKings, addToHallOfKings, TODAY, getBannerOverride, setBanner, deleteBanner, getAllBanners, loadBanners };
