const express = require('express');
const bcrypt = require('bcryptjs');
const { getPlayerByUsername, createPlayer, updatePlayer, TODAY } = require('../db');
const { runNewDay } = require('../game/newday');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
  if (username.length < 2 || username.length > 20) return res.status(400).json({ error: 'Username must be 2–20 characters.' });
  if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters.' });

  const existing = await getPlayerByUsername(username);
  if (existing) return res.status(400).json({ error: 'That username is already taken.' });

  const hash = await bcrypt.hash(password, 10);
  const id = await createPlayer(username, hash);

  req.session.playerId = id;
  res.json({ ok: true });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });

  const player = await getPlayerByUsername(username);
  if (!player) return res.status(401).json({ error: 'Invalid username or password.' });

  const valid = await bcrypt.compare(password, player.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid username or password.' });

  req.session.playerId = player.id;

  let newDayMessages = [];
  const today = TODAY();
  if (player.setup_complete && player.last_day < today) {
    const { updates, messages } = await runNewDay(player);
    await updatePlayer(player.id, updates);
    newDayMessages = messages;
  }

  await updatePlayer(player.id, { last_seen: new Date().toISOString() });
  res.json({ ok: true, setup_complete: !!player.setup_complete, newDayMessages });
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

module.exports = router;
