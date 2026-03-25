const express = require('express');
const bcrypt = require('bcryptjs');
const {
  getAccountByUsername, createAccount, getCharactersForAccount, createCharacterForAccount,
  getPlayer, updatePlayer, TODAY, getWorldState, getUnreadMailCount,
} = require('../db');
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

  const existing = await getAccountByUsername(username);
  if (existing) return res.status(400).json({ error: 'That username is already taken.' });

  const hash = await bcrypt.hash(password, 10);
  const accountId = await createAccount(username, hash);
  const playerId = await createCharacterForAccount(accountId, 1);

  req.session.accountId = accountId;
  req.session.playerId = playerId;
  res.json({ ok: true });
});

router.post('/login', async (req, res) => {
  if (!checkAuthRate(req, res)) return;
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });

  const account = await getAccountByUsername(username);
  if (!account) return res.status(401).json({ error: 'Invalid username or password.' });

  const valid = await bcrypt.compare(password, account.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid username or password.' });

  if (account.banned) return res.status(403).json({ error: 'This account has been banned.' });

  const accountId = account.id;
  req.session.accountId = accountId;

  const characters = await getCharactersForAccount(account.id);
  const complete = characters.filter(c => c.setup_complete);

  // Auto-select if exactly one complete character; otherwise let /state handle the char select screen
  let playerId = null;
  if (complete.length === 1) {
    playerId = complete[0].id;
  } else if (characters.length === 1) {
    playerId = characters[0].id;
  }

  req.session.playerId = playerId;

  let newDayMessages = [];
  let unreadMail = 0;

  if (playerId) {
    const player = await getPlayer(playerId);
    if (player) {
      const today = TODAY();
      if (player.setup_complete && player.last_day < today) {
        const { updates, messages } = await runNewDay(player);
        await updatePlayer(playerId, updates);
        newDayMessages = messages;
      }
      await updatePlayer(playerId, { last_seen: new Date().toISOString() });
      unreadMail = player.setup_complete ? await getUnreadMailCount(playerId) : 0;
    }
  }

  res.json({ ok: true, setup_complete: playerId ? !!(characters.find(c => c.id === playerId)?.setup_complete) : false, newDayMessages, unreadMail });
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  if (!req.session.accountId && !req.session.playerId) return res.status(401).json({ error: 'Not logged in.' });

  // Support both old sessions (playerId only) and new (accountId + playerId)
  const pid = req.session.playerId;
  if (!pid) return res.json({ ok: true, username: '', setup_complete: false });

  const player = await getPlayer(pid);
  if (!player) return res.status(401).json({ error: 'Player not found.' });

  const { getAccountById } = require('../db');
  const account = req.session.accountId ? await getAccountById(req.session.accountId) : null;
  res.json({ ok: true, username: account ? account.username : player.username, setup_complete: !!player.setup_complete });
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
