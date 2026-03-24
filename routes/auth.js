const express = require('express');
const bcrypt = require('bcryptjs');
const { getPlayerByUsername, createPlayer, updatePlayer, TODAY, getWorldState, getUnreadMailCount } = require('../db');
const { runNewDay } = require('../game/newday');

const router = express.Router();

// Simple in-memory rate limiter: max 10 auth attempts per IP per 15 minutes
const authAttempts = new Map();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of authAttempts.entries()) {
    if (now > entry.resetAt) authAttempts.delete(ip);
  }
}, RATE_LIMIT_WINDOW);

function checkAuthRate(req, res) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let entry = authAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
    authAttempts.set(ip, entry);
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    return false;
  }
  return true;
}

router.post('/register', async (req, res) => {
  if (!checkAuthRate(req, res)) return;
  const regOpen = await getWorldState('registration_open');
  if (regOpen === '0') return res.status(403).json({ error: 'New registrations are currently closed.' });
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
  if (username.length < 2 || username.length > 20) return res.status(400).json({ error: 'Username must be 2–20 characters.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const existing = await getPlayerByUsername(username);
  if (existing) return res.status(400).json({ error: 'That username is already taken.' });

  const hash = await bcrypt.hash(password, 10);
  const id = await createPlayer(username, hash);

  req.session.playerId = id;
  res.json({ ok: true });
});

router.post('/login', async (req, res) => {
  if (!checkAuthRate(req, res)) return;
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });

  const player = await getPlayerByUsername(username);
  if (!player) return res.status(401).json({ error: 'Invalid username or password.' });

  const valid = await bcrypt.compare(password, player.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid username or password.' });

  if (player.banned) return res.status(403).json({ error: 'This account has been banned.' });

  req.session.playerId = player.id;

  let newDayMessages = [];
  const today = TODAY();
  if (player.setup_complete && player.last_day < today) {
    const { updates, messages } = await runNewDay(player);
    await updatePlayer(player.id, updates);
    newDayMessages = messages;
  }

  await updatePlayer(player.id, { last_seen: new Date().toISOString() });
  const unreadMail = player.setup_complete ? await getUnreadMailCount(player.id) : 0;
  res.json({ ok: true, setup_complete: !!player.setup_complete, newDayMessages, unreadMail });
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  if (!req.session.playerId) return res.status(401).json({ error: 'Not logged in.' });
  const { getPlayer } = require('../db');
  const player = await getPlayer(req.session.playerId);
  if (!player) return res.status(401).json({ error: 'Player not found.' });
  res.json({ ok: true, username: player.username, setup_complete: !!player.setup_complete });
});

// GET /api/auth/impersonate/:token — one-time admin impersonation
router.get('/impersonate/:token', async (req, res) => {
  const adminRouter = require('./admin');
  const tokens = adminRouter.impersonateTokens;
  const entry = tokens && tokens.get(req.params.token);
  if (!entry || Date.now() > entry.expires) {
    tokens && tokens.delete(req.params.token);
    return res.status(400).send('<p>Impersonation token invalid or expired.</p>');
  }
  tokens.delete(req.params.token);
  console.log(`[ADMIN] Impersonation token used — logged in as player ${entry.playerId}`);
  req.session.playerId = entry.playerId;
  res.redirect('/');
});

module.exports = router;
