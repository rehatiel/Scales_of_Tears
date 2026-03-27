require('dotenv').config({ path: '.env' });
const http = require('http');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { WebSocketServer } = require('ws');
const path = require('path');
const { initDb, pool, updatePlayer, addNews, TODAY, loadGameDataFromDb, loadQuestsFromDb, loadFactionsFromDb, loadTownsFromDb } = require('./db');
const { runNewDay } = require('./game/newday');
const { loadGameData, loadTownsData } = require('./game/data');
const { loadQuestsData } = require('./game/quests');
const { loadFactionsData } = require('./game/factions');

const app = express();
const PORT = process.env.PORT || 3000;

// Require a real SESSION_SECRET — refuse to start with the placeholder
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.startsWith('change-me') || SESSION_SECRET === 'sot-change-me') {
  console.error('FATAL: SESSION_SECRET must be set to a strong random value in .env');
  process.exit(1);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use((_req, res, next) => { res.removeHeader('Permissions-Policy'); next(); });

// CSRF protection: reject cross-origin state-changing requests
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const origin = req.headers.origin;
  if (!origin) return next(); // same-origin requests typically omit Origin
  try {
    const originHost = new URL(origin).host;
    const reqHost = req.headers.host;
    if (originHost !== reqHost) return res.status(403).json({ error: 'Forbidden' });
  } catch {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

app.use(session({
  store: new pgSession({ pool, tableName: 'session', createTableIfMissing: true }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.COOKIE_SECURE === 'true',
    httpOnly: true,
    sameSite: 'lax',
  },
}));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/game', require('./routes/game'));
app.use('/api/admin', require('./routes/admin'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Broadcast a message to all connected WebSocket clients
function broadcast(type, data) {
  const msg = JSON.stringify({ type, data });
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

wss.on('connection', (ws) => {
  ws.on('error', (err) => console.error('WebSocket error:', err));
  // No client→server messages handled yet
});

module.exports = { broadcast };

// ── Midnight new-day scheduler ────────────────────────────────────────────────
// Runs once at UTC midnight and processes all players who haven't had today's
// new-day applied yet (last_day < TODAY()), then schedules the next midnight.
async function runGlobalNewDay() {
  const today = TODAY();
  const { rows } = await pool.query(
    'SELECT * FROM players WHERE setup_complete = 1 AND last_day < $1',
    [today]
  );
  if (rows.length === 0) return;
  for (const player of rows) {
    try {
      const { updates } = await runNewDay(player);
      await updatePlayer(player.id, updates);
    } catch (err) {
      console.error(`New-day failed for player ${player.id}:`, err);
    }
  }
  await addNews('`$A new day dawns over the Age of Tears.').catch(err => console.error('Failed to add new-day news:', err));
  broadcast('new_day', { day: today });
  console.log(`New day processed for ${rows.length} player(s).`);
}

function scheduleNextMidnight() {
  const now = Date.now();
  const nextMidnightUTC = (Math.floor(now / 86400000) + 1) * 86400000;
  const msUntilMidnight = nextMidnightUTC - now;
  setTimeout(async () => {
    await runGlobalNewDay().catch(err => console.error('Global new-day error:', err));
    scheduleNextMidnight();
  }, msUntilMidnight);
  const h = Math.floor(msUntilMidnight / 3600000);
  const m = Math.floor((msUntilMidnight % 3600000) / 60000);
  console.log(`Next new day in ${h}h ${m}m.`);
}

initDb().then(async () => {
  // Load game data from DB into in-memory cache (weapons, armours, monsters, constants)
  const gameData = await loadGameDataFromDb();
  loadGameData(gameData);
  const questData = await loadQuestsFromDb();
  loadQuestsData(questData);
  const factionData = await loadFactionsFromDb();
  loadFactionsData(factionData);
  const townData = await loadTownsFromDb();
  loadTownsData(townData);
  console.log('Game data loaded from database.');
  // Process any players who missed a new day while the server was down
  await runGlobalNewDay().catch(err => console.error('Startup new-day error:', err));
  scheduleNextMidnight();
  server.listen(PORT, () => console.log(`Scales of Tears running at http://localhost:${PORT}`));
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
