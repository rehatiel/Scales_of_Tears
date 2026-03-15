const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://lord:lordpass@localhost:5432/lorddb',
});

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    handle TEXT NOT NULL DEFAULT '',
    sex INTEGER NOT NULL DEFAULT 0,
    class INTEGER NOT NULL DEFAULT 1,
    hit_points INTEGER NOT NULL DEFAULT 15,
    hit_max INTEGER NOT NULL DEFAULT 15,
    strength INTEGER NOT NULL DEFAULT 15,
    defense INTEGER NOT NULL DEFAULT 0,
    charm INTEGER NOT NULL DEFAULT 10,
    level INTEGER NOT NULL DEFAULT 1,
    exp BIGINT NOT NULL DEFAULT 0,
    gold BIGINT NOT NULL DEFAULT 0,
    bank BIGINT NOT NULL DEFAULT 0,
    gems INTEGER NOT NULL DEFAULT 0,
    weapon_num INTEGER NOT NULL DEFAULT 0,
    weapon_name TEXT NOT NULL DEFAULT 'Fists',
    arm_num INTEGER NOT NULL DEFAULT 0,
    arm_name TEXT NOT NULL DEFAULT 'None',
    fights_left INTEGER NOT NULL DEFAULT 10,
    human_fights_left INTEGER NOT NULL DEFAULT 5,
    skill_points INTEGER NOT NULL DEFAULT 0,
    skill_uses_left INTEGER NOT NULL DEFAULT 0,
    dead INTEGER NOT NULL DEFAULT 0,
    seen_master INTEGER NOT NULL DEFAULT 0,
    seen_dragon INTEGER NOT NULL DEFAULT 0,
    has_horse INTEGER NOT NULL DEFAULT 0,
    married_to INTEGER NOT NULL DEFAULT -1,
    kids INTEGER NOT NULL DEFAULT 0,
    times_won INTEGER NOT NULL DEFAULT 0,
    kills INTEGER NOT NULL DEFAULT 0,
    lays INTEGER NOT NULL DEFAULT 0,
    last_day INTEGER NOT NULL DEFAULT 0,
    flirted_today INTEGER NOT NULL DEFAULT 0,
    special_done_today INTEGER NOT NULL DEFAULT 0,
    setup_complete INTEGER NOT NULL DEFAULT 0,
    last_seen TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS news (
    id SERIAL PRIMARY KEY,
    day INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS hall_of_kings (
    id SERIAL PRIMARY KEY,
    handle TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 12,
    kills INTEGER NOT NULL DEFAULT 0,
    class INTEGER NOT NULL DEFAULT 1,
    times_won INTEGER NOT NULL DEFAULT 1,
    defeated_at TIMESTAMP NOT NULL DEFAULT NOW()
  );
`;

async function initDb() {
  await pool.query(SCHEMA);
  // Column migrations — safe to run on every start
  const migrations = [
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS near_death INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS near_death_by TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS poisoned INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS quest_id TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS quest_step INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS quest_data TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS crier_message TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS crier_day INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS is_legend INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS rage_active INTEGER NOT NULL DEFAULT 0`,
  ];
  for (const m of migrations) await pool.query(m);
  console.log('Database schema ready.');
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

module.exports = { pool, initDb, getPlayer, getPlayerByUsername, updatePlayer, createPlayer, getAllPlayers, getNearDeathPlayers, getRecentNews, addNews, getHallOfKings, addToHallOfKings, TODAY };
