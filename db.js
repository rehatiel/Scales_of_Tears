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
  'specialization', 'spec_pending', 'lich_cooldown',
  'nemesis_id',
  'alignment',
  'named_weapon_id', 'named_armor_id', 'weapon_cursed', 'armor_cursed', 'blood_oath',
  'ruins_visited', 'dungeon_clears',
  'prestige_level',
  'earned_titles', 'active_title', 'death_count', 'flee_count',
  'last_killed_by',
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
    'SELECT id, handle, level, class, sex, last_seen, dead, times_won, prestige_level, active_title, setup_complete FROM players WHERE setup_complete = 1 ORDER BY level DESC, exp DESC'
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
    `SELECT id, handle, level, class, sex, last_seen, dead, times_won, setup_complete,
            active_title, prestige_level, specialization
     FROM players
     WHERE current_town = $1 AND setup_complete = 1 AND id != $2
       AND dead = 0 AND (retired_today IS NULL OR retired_today = 0)
       AND (camping IS NULL OR camping = 0)
       AND (travel_to IS NULL OR travel_to = '')
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

// ── Weekly hunt board ─────────────────────────────────────────────────────────

async function getActiveHunts() {
  const week = Math.floor(TODAY() / 7);
  const { rows } = await pool.query(
    'SELECT * FROM weekly_hunts WHERE week_number = $1 ORDER BY rank ASC',
    [week]
  );
  return rows;
}

async function generateWeeklyHunts(weekNumber, targets) {
  // targets: [{ rank, target_name, kill_bonus_gold, kill_bonus_exp }]
  for (const t of targets) {
    await pool.query(
      `INSERT INTO weekly_hunts (week_number, rank, target_name, kill_bonus_gold, kill_bonus_exp)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (week_number, target_name) DO NOTHING`,
      [weekNumber, t.rank, t.target_name, t.kill_bonus_gold, t.kill_bonus_exp]
    );
  }
}

async function incrementHuntKill(huntId, playerId) {
  await pool.query(
    `INSERT INTO hunt_kills (hunt_id, player_id, kills) VALUES ($1, $2, 1)
     ON CONFLICT (hunt_id, player_id) DO UPDATE SET kills = hunt_kills.kills + 1`,
    [huntId, playerId]
  );
  await pool.query('UPDATE weekly_hunts SET total_kills = total_kills + 1 WHERE id = $1', [huntId]);
}

async function getWeeklyHuntLeaderboard(weekNumber) {
  const { rows } = await pool.query(
    `SELECT p.handle, p.id, SUM(hk.kills) AS total_kills
     FROM hunt_kills hk
     JOIN weekly_hunts wh ON wh.id = hk.hunt_id
     JOIN players p ON p.id = hk.player_id
     WHERE wh.week_number = $1
     GROUP BY p.id, p.handle
     ORDER BY total_kills DESC
     LIMIT 10`,
    [weekNumber]
  );
  return rows;
}

// ── Player mail ───────────────────────────────────────────────────────────────

async function sendMail(fromId, toId, message) {
  await pool.query(
    'INSERT INTO player_mail (from_id, to_id, message) VALUES ($1, $2, $3)',
    [fromId, toId, message]
  );
}

async function getInboxMail(playerId) {
  const { rows } = await pool.query(
    `SELECT m.*, p.handle AS sender_handle
     FROM player_mail m
     JOIN players p ON p.id = m.from_id
     WHERE m.to_id = $1
     ORDER BY m.sent_at DESC
     LIMIT 50`,
    [playerId]
  );
  return rows;
}

async function getSentMail(playerId) {
  const { rows } = await pool.query(
    `SELECT m.*, p.handle AS recipient_handle
     FROM player_mail m
     JOIN players p ON p.id = m.to_id
     WHERE m.from_id = $1
     ORDER BY m.sent_at DESC
     LIMIT 50`,
    [playerId]
  );
  return rows;
}

async function markMailRead(mailId, playerId) {
  await pool.query(
    'UPDATE player_mail SET read = 1 WHERE id = $1 AND to_id = $2',
    [mailId, playerId]
  );
}

async function getUnreadMailCount(playerId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*) AS cnt FROM player_mail WHERE to_id = $1 AND read = 0',
    [playerId]
  );
  return parseInt(rows[0].cnt, 10);
}

// ── Online players ─────────────────────────────────────────────────────────────

async function getOnlinePlayers(excludeId) {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { rows } = await pool.query(
    `SELECT id, handle, level, class, current_town, active_title
     FROM players
     WHERE setup_complete = 1 AND dead = 0 AND last_seen > $1 AND id != $2
     ORDER BY last_seen DESC`,
    [cutoff, excludeId]
  );
  return rows;
}

// ── Bounties ──────────────────────────────────────────────────────────────────

async function postBounty(posterId, targetId, gold) {
  const { rows } = await pool.query(
    'INSERT INTO bounties (poster_id, target_id, gold) VALUES ($1, $2, $3) RETURNING *',
    [posterId, targetId, gold]
  );
  return rows[0];
}

async function getBountiesOnTarget(targetId) {
  const { rows } = await pool.query(
    `SELECT b.*, p.handle AS poster_handle
     FROM bounties b JOIN players p ON p.id = b.poster_id
     WHERE b.target_id = $1 AND b.active = TRUE
     ORDER BY b.gold DESC`,
    [targetId]
  );
  return rows;
}

async function getAllActiveBounties() {
  const { rows } = await pool.query(
    `SELECT b.*, poster.handle AS poster_handle, target.handle AS target_handle
     FROM bounties b
     JOIN players poster ON poster.id = b.poster_id
     JOIN players target ON target.id = b.target_id
     WHERE b.active = TRUE
     ORDER BY b.gold DESC
     LIMIT 20`
  );
  return rows;
}

// Collect all active bounties on targetId, pay killerId; returns total gold collected
async function collectBounties(killerId, targetId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT id, gold FROM bounties WHERE target_id = $1 AND active = TRUE FOR UPDATE',
      [targetId]
    );
    if (!rows.length) { await client.query('ROLLBACK'); return 0; }
    const total = rows.reduce((s, r) => s + r.gold, 0);
    await client.query(
      'UPDATE bounties SET active = FALSE WHERE target_id = $1 AND active = TRUE',
      [targetId]
    );
    await client.query('UPDATE players SET gold = gold + $1 WHERE id = $2', [total, killerId]);
    await client.query('COMMIT');
    return total;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Arena ──────────────────────────────────────────────────────────────────────

async function createArenaChallenge(challengerId, defenderId, town) {
  const { rows } = await pool.query(
    `INSERT INTO arena_challenges (challenger_id, defender_id, town, status)
     VALUES ($1, $2, $3, 'pending') RETURNING *`,
    [challengerId, defenderId, town]
  );
  return rows[0];
}

async function getPendingChallengesForPlayer(playerId) {
  const { rows } = await pool.query(
    `SELECT ac.*, p.handle AS challenger_handle
     FROM arena_challenges ac
     JOIN players p ON p.id = ac.challenger_id
     WHERE ac.defender_id = $1 AND ac.status = 'pending'
       AND ac.created_at > $2
     ORDER BY ac.created_at DESC`,
    [playerId, Date.now() - 30 * 60 * 1000]  // challenges expire after 30 min
  );
  return rows;
}

async function getArenaChallenge(id) {
  const { rows } = await pool.query('SELECT * FROM arena_challenges WHERE id = $1', [id]);
  return rows[0] || null;
}

async function updateArenaChallenge(id, fields) {
  const allowed = ['status', 'winner_id', 'bet_pool', 'resolved_at'];
  const keys = Object.keys(fields).filter(k => allowed.includes(k));
  if (!keys.length) return;
  const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  await pool.query(`UPDATE arena_challenges SET ${set} WHERE id = $${keys.length + 1}`, [...keys.map(k => fields[k]), id]);
}

async function placeBet(challengeId, playerId, side, amount) {
  const { rows } = await pool.query(
    `INSERT INTO arena_bets (challenge_id, player_id, side, amount)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (challenge_id, player_id) DO NOTHING
     RETURNING *`,
    [challengeId, playerId, side, amount]
  );
  if (rows.length) {
    await pool.query('UPDATE arena_challenges SET bet_pool = bet_pool + $1 WHERE id = $2', [amount, challengeId]);
  }
  return rows[0] || null;
}

async function getArenaSpectators(challengeId) {
  const { rows } = await pool.query(
    `SELECT ab.*, p.handle FROM arena_bets ab
     JOIN players p ON p.id = ab.player_id
     WHERE ab.challenge_id = $1`,
    [challengeId]
  );
  return rows;
}

// Pay out bets: winners get back (stake * totalPool / winningSide total), losers get nothing
async function resolveArenaBets(challengeId, winnerId) {
  const challenge = await getArenaChallenge(challengeId);
  if (!challenge) return;
  const winSide = challenge.challenger_id === winnerId ? 'challenger' : 'defender';
  const bets = await getArenaSpectators(challengeId);
  const winners = bets.filter(b => b.side === winSide);
  const losers  = bets.filter(b => b.side !== winSide);
  const loserPool = losers.reduce((s, b) => s + b.amount, 0);
  const winnerPool = winners.reduce((s, b) => s + b.amount, 0);
  if (!winnerPool) return;
  for (const w of winners) {
    const share = Math.floor((w.amount / winnerPool) * loserPool);
    await pool.query('UPDATE players SET gold = gold + $1 WHERE id = $2', [w.amount + share, w.player_id]);
  }
  // refund nothing to losers
}

async function getOpenArenaChallenge(challengeId) {
  const { rows } = await pool.query(
    `SELECT ac.*, ch.handle AS challenger_handle, df.handle AS defender_handle
     FROM arena_challenges ac
     JOIN players ch ON ch.id = ac.challenger_id
     JOIN players df ON df.id = ac.defender_id
     WHERE ac.id = $1`,
    [challengeId]
  );
  return rows[0] || null;
}

// ── Real-time PvP sessions ─────────────────────────────────────────────────────

async function createPvpSession(data) {
  const deadline = new Date(Date.now() + 60000).toISOString();
  const { rows } = await pool.query(
    `INSERT INTO pvp_sessions
       (challenger_id, defender_id, current_turn,
        challenger_hp, defender_hp, challenger_max_hp, defender_max_hp,
        challenger_skill_uses, defender_skill_uses,
        challenge_msg, status, turn_deadline)
     VALUES ($1,$2,'challenger',$3,$4,$5,$6,$7,$8,$9,'pending',$10) RETURNING *`,
    [
      data.challenger_id, data.defender_id,
      data.challenger_hp, data.defender_hp,
      data.challenger_hp, data.defender_hp,
      data.challenger_skill_uses, data.defender_skill_uses,
      data.challenge_msg || null,
      deadline,
    ]
  );
  return rows[0];
}

async function getPvpSession(id) {
  const { rows } = await pool.query('SELECT * FROM pvp_sessions WHERE id = $1', [id]);
  return rows[0] || null;
}

// Get the active (pending or active) session where this player is either challenger or defender
async function getActivePvpSessionForPlayer(playerId) {
  const { rows } = await pool.query(
    `SELECT * FROM pvp_sessions
     WHERE status IN ('pending','active')
       AND (challenger_id = $1 OR defender_id = $1)
     ORDER BY id DESC LIMIT 1`,
    [playerId]
  );
  return rows[0] || null;
}

async function updatePvpSession(id, fields) {
  const allowed = new Set([
    'current_turn','challenger_hp','defender_hp','challenger_skill_uses',
    'defender_skill_uses','round','log','status','winner_id','turn_deadline',
  ]);
  const keys = Object.keys(fields).filter(k => allowed.has(k));
  if (!keys.length) return;
  const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  // JSONB fields must be serialised — pg driver sends plain arrays as PG arrays otherwise
  const values = keys.map(k => (k === 'log' ? JSON.stringify(fields[k]) : fields[k]));
  await pool.query(
    `UPDATE pvp_sessions SET ${set}, updated_at = NOW() WHERE id = $${keys.length + 1}`,
    [...values, id]
  );
}

async function completePvpSession(id, winnerId) {
  await pool.query(
    `UPDATE pvp_sessions SET status='complete', winner_id=$1, updated_at=NOW() WHERE id=$2`,
    [winnerId, id]
  );
}

// ── Accounts (multi-character) ────────────────────────────────────────────────

async function getAccountByUsername(username) {
  const r = await pool.query('SELECT * FROM accounts WHERE LOWER(username) = LOWER($1)', [username]);
  return r.rows[0] || null;
}

async function getAccountById(id) {
  const r = await pool.query('SELECT * FROM accounts WHERE id = $1', [id]);
  return r.rows[0] || null;
}

async function createAccount(username, passwordHash) {
  const r = await pool.query(
    'INSERT INTO accounts (username, password_hash) VALUES ($1, $2) RETURNING id',
    [username, passwordHash]
  );
  return r.rows[0].id;
}

async function getCharactersForAccount(accountId) {
  const r = await pool.query(
    'SELECT * FROM players WHERE account_id = $1 ORDER BY slot',
    [accountId]
  );
  return r.rows;
}

async function createCharacterForAccount(accountId, slot) {
  // Username must be unique; account-linked characters use an internal placeholder
  // that can never conflict with real handles (real usernames are 2-20 chars, no leading __)
  const placeholder = `__acct_${accountId}_${slot}`;
  const r = await pool.query(
    `INSERT INTO players (account_id, slot, username, password_hash)
     VALUES ($1, $2, $3, '')
     RETURNING id`,
    [accountId, slot, placeholder]
  );
  return r.rows[0].id;
}

async function setBanAccount(accountId, banned) {
  await pool.query('UPDATE accounts SET banned = $1 WHERE id = $2', [banned, accountId]);
}

// ── Player secrets ─────────────────────────────────────────────────────────────

async function getSeenSecrets(playerId) {
  const r = await pool.query('SELECT secret_id FROM player_secrets WHERE player_id = $1', [playerId]);
  return r.rows.map(row => row.secret_id);
}

async function recordSecret(playerId, secretId) {
  await pool.query(
    'INSERT INTO player_secrets (player_id, secret_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [playerId, secretId]
  );
}

module.exports = { pool, initDb, getPlayer, getPlayerByUsername, updatePlayer, claimNewDay, createPlayer, getAllPlayers, getPlayersInTown, getRetiredPlayersInTown, getNearDeathPlayers, getCaptivePlayers, getRecentNews, addNews, getHallOfKings, addToHallOfKings, TODAY, getBannerOverride, setBanner, deleteBanner, getAllBanners, loadBanners, getActiveNamedEnemiesForLevel, createNamedEnemy, updateNamedEnemy, getNamedEnemy, getAllUndefeatedNamedEnemies, getUndefeatedNamedEnemiesWithKills, getInvadingEnemies, getActiveWorldEvent, triggerWorldEvent, expireWorldEvents, getWorldState, setWorldState, getActiveHunts, generateWeeklyHunts, incrementHuntKill, getWeeklyHuntLeaderboard, sendMail, getInboxMail, getSentMail, markMailRead, getUnreadMailCount, getOnlinePlayers, postBounty, getBountiesOnTarget, getAllActiveBounties, collectBounties, createArenaChallenge, getPendingChallengesForPlayer, getArenaChallenge, updateArenaChallenge, placeBet, getArenaSpectators, resolveArenaBets, getOpenArenaChallenge, createPvpSession, getPvpSession, getActivePvpSessionForPlayer, updatePvpSession, completePvpSession, getSeenSecrets, recordSecret,
  getAccountByUsername, getAccountById, createAccount, getCharactersForAccount, createCharacterForAccount, setBanAccount };
