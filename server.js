require('dotenv').config({ path: '.env' });
const http = require('http');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { WebSocketServer } = require('ws');
const path = require('path');
const { initDb, pool, updatePlayer, addNews, TODAY } = require('./db');
const { runNewDay } = require('./game/newday');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use((_req, res, next) => { res.removeHeader('Permissions-Policy'); next(); });

app.use(session({
  store: new pgSession({ pool, tableName: 'session', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'sot-change-me',
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
  await addNews('`$A new day dawns over the Age of Tears.').catch(() => {});
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
  // Process any players who missed a new day while the server was down
  await runGlobalNewDay().catch(err => console.error('Startup new-day error:', err));
  scheduleNextMidnight();
  server.listen(PORT, () => console.log(`Scales of Tears running at http://localhost:${PORT}`));
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
