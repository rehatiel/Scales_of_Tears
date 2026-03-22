const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://sot:sotpass@localhost:5432/sotdb',
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

// Whitelist of all valid player columns — prevents SQL injection via dynamic key names
const PLAYER_COLUMNS = new Set([
  'username', 'password_hash', 'handle', 'sex', 'class', 'hit_points', 'hit_max',
  'strength', 'defense', 'charm', 'level', 'exp', 'gold', 'bank', 'gems',
  'weapon_num', 'weapon_name', 'arm_num', 'arm_name', 'fights_left', 'human_fights_left',
  'skill_points', 'skill_uses_left', 'stamina', 'stamina_max',
  'dead', 'near_death', 'near_death_by', 'seen_master', 'seen_dragon',
  'has_horse', 'married_to', 'kids', 'times_won', 'kills', 'lays',
  'last_day', 'flirted_today', 'special_done_today', 'training_today', 'drinks_today',
  'grove_healed_today', 'well_used_today', 'guide_hired', 'road_hint', 'herbalist_today',
  'poisoned', 'banned', 'is_legend', 'rage_active',
  'wounds', 'infection_type', 'infection_stage', 'infection_days',
  'vampire_bites', 'is_vampire', 'vampire_feasted', 'bandages',
  'retired_today', 'retired_town',
  'current_town', 'travel_to', 'travel_segments_done', 'travel_segments_total',
  'camping', 'captive', 'captive_location',
  'quest_id', 'quest_step', 'quest_data',
  'crier_message', 'crier_day', 'last_encounter_id', 'encounter_day',
  'forge_weapon_upgraded', 'forge_armor_upgraded', 'antidote_owned',
  'rep_knights', 'rep_guild', 'rep_druids', 'rep_necromancers', 'rep_merchants',
  'setup_complete', 'last_seen',
  'perks', 'perk_points',
  'nemesis_id',
  'alignment',
  'named_weapon_id', 'named_armor_id', 'weapon_cursed', 'armor_cursed', 'blood_oath',
  'ruins_visited', 'dungeon_clears',
]);

async function updatePlayer(id, fields) {
  const keys = Object.keys(fields).filter(k => {
    if (!PLAYER_COLUMNS.has(k)) {
      console.error(`updatePlayer: rejected unknown column "${k}"`);
      return false;
    }
    return true;
  });
  if (!keys.length) return;
  const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  await pool.query(`UPDATE players SET ${set} WHERE id = $${keys.length + 1}`, [...keys.map(k => fields[k]), id]);
}

// Atomically claim the new-day for a player; returns true if this call "wins" the race
async function claimNewDay(playerId, today) {
  const { rowCount } = await pool.query(
    'UPDATE players SET last_day = $1 WHERE id = $2 AND last_day < $1',
    [today, playerId]
  );
  return rowCount > 0;
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

async function getRetiredPlayersInTown(townId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*) AS count FROM players WHERE retired_today = 1 AND retired_town = $1',
    [townId]
  );
  return parseInt(rows[0].count, 10);
}

async function getPlayersInTown(townId, excludeId) {
  const { rows } = await pool.query(
    `SELECT id, handle, level, class, sex, last_seen, dead, times_won, setup_complete
     FROM players
     WHERE current_town = $1 AND setup_complete = 1 AND id != $2
       AND dead = 0 AND retired_today = 0
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

// ── Named enemies ─────────────────────────────────────────────────────────────

async function getActiveNamedEnemiesForLevel(level) {
  const { rows } = await pool.query(
    'SELECT * FROM named_enemies WHERE defeated = 0 AND level BETWEEN $1 AND $2 ORDER BY kills DESC, created_at ASC',
    [Math.max(1, level - 1), level + 1]
  );
  return rows;
}

async function createNamedEnemy(data) {
  const { rows } = await pool.query(
    `INSERT INTO named_enemies (template_name, given_name, level, template_index, strength, hp, gold, exp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [data.template_name, data.given_name, data.level, data.template_index, data.strength, data.hp, data.gold, data.exp]
  );
  return rows[0];
}

const NAMED_ENEMY_COLUMNS = new Set([
  'template_name', 'given_name', 'level', 'template_index', 'strength', 'hp',
  'gold', 'exp', 'kills', 'title', 'defeated', 'last_seen_at', 'reached_town',
]);

async function updateNamedEnemy(id, fields) {
  const keys = Object.keys(fields).filter(k => {
    if (!NAMED_ENEMY_COLUMNS.has(k)) {
      console.error(`updateNamedEnemy: rejected unknown column "${k}"`);
      return false;
    }
    return true;
  });
  if (!keys.length) return;
  const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  await pool.query(`UPDATE named_enemies SET ${set} WHERE id = $${keys.length + 1}`, [...keys.map(k => fields[k]), id]);
}

async function getNamedEnemy(id) {
  const { rows } = await pool.query('SELECT * FROM named_enemies WHERE id = $1', [id]);
  return rows[0] || null;
}

async function getAllUndefeatedNamedEnemies() {
  const { rows } = await pool.query('SELECT * FROM named_enemies WHERE defeated = 0 ORDER BY id ASC');
  return rows;
}

async function getUndefeatedNamedEnemiesWithKills(minKills) {
  const { rows } = await pool.query(
    'SELECT * FROM named_enemies WHERE defeated = 0 AND kills >= $1 AND reached_town IS NULL ORDER BY kills DESC',
    [minKills]
  );
  return rows;
}

async function getInvadingEnemies(townId) {
  const { rows } = await pool.query(
    'SELECT * FROM named_enemies WHERE defeated = 0 AND reached_town = $1 ORDER BY kills DESC',
    [townId]
  );
  return rows;
}

// ── World events ──────────────────────────────────────────────────────────────

async function getActiveWorldEvent() {
  const now = Date.now();
  const { rows } = await pool.query(
    'SELECT * FROM world_events WHERE active = TRUE AND ends_at > $1 ORDER BY id DESC LIMIT 1',
    [now]
  );
  return rows[0] || null;
}

async function triggerWorldEvent(type, durationDays) {
  const now = Date.now();
  const endsAt = now + durationDays * 86400000;
  const { rows } = await pool.query(
    'INSERT INTO world_events (type, started_at, ends_at, active) VALUES ($1, $2, $3, TRUE) RETURNING *',
    [type, now, endsAt]
  );
  return rows[0];
}

async function expireWorldEvents() {
  const now = Date.now();
  const { rows } = await pool.query(
    'UPDATE world_events SET active = FALSE WHERE active = TRUE AND ends_at <= $1 RETURNING type',
    [now]
  );
  return rows.map(r => r.type); // returns list of just-expired types
}

// ── World state key-value ─────────────────────────────────────────────────────

async function getWorldState(key) {
  const { rows } = await pool.query('SELECT value FROM world_state WHERE key = $1', [key]);
  return rows[0] ? rows[0].value : null;
}

async function setWorldState(key, value) {
  const now = Date.now();
  await pool.query(
    `INSERT INTO world_state (key, value, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = $3`,
    [key, String(value), now]
  );
}

module.exports = { pool, initDb, getPlayer, getPlayerByUsername, updatePlayer, claimNewDay, createPlayer, getAllPlayers, getPlayersInTown, getRetiredPlayersInTown, getNearDeathPlayers, getCaptivePlayers, getRecentNews, addNews, getHallOfKings, addToHallOfKings, TODAY, getBannerOverride, setBanner, deleteBanner, getAllBanners, loadBanners, getActiveNamedEnemiesForLevel, createNamedEnemy, updateNamedEnemy, getNamedEnemy, getAllUndefeatedNamedEnemies, getUndefeatedNamedEnemiesWithKills, getInvadingEnemies, getActiveWorldEvent, triggerWorldEvent, expireWorldEvents, getWorldState, setWorldState };
