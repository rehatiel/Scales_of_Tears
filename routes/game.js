const express = require('express');
const { getPlayer, updatePlayer, addNews, TODAY } = require('../db');
const { LEVEL_UP_GAINS, TOWNS } = require('../game/data');
const { runNewDay } = require('../game/newday');
const {
  getTownScreen, getSetupScreen, getNearDeathWaitingScreen,
  getRoadScreen, getCampingScreen, getCaptiveScreen,
} = require('../game/engine');

const router = express.Router();
const ar = fn => (req, res, next) => fn(req, res, next).catch(next);

const SERVER_START_DAY = Math.floor(Date.now() / 86400000);

function buildPlayerStatus(player) {
  const gameDay = Math.floor(Date.now() / 86400000);
  const hour = new Date().getUTCHours();
  const timeOfDay = hour < 6 ? 'Night' : hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  const townName = (TOWNS[player.current_town || 'dawnmark'] || TOWNS.dawnmark).name;
  return {
    name:      player.handle,
    hp:        player.hit_points,
    hpMax:     player.hit_max,
    gold:      Number(player.gold),
    stamina:   player.stamina ?? player.fights_left ?? 10,
    level:     player.level,
    location:  townName,
    poisoned:  player.poisoned || 0,
    dead:      player.dead || 0,
    lordDay:   gameDay - SERVER_START_DAY + 1,
    timeOfDay,
  };
}

// All action handlers, keyed by action name
const HANDLERS = {
  ...require('../game/handlers/forest'),
  ...require('../game/handlers/tavern'),
  ...require('../game/handlers/town'),
  ...require('../game/handlers/dragon'),
  ...require('../game/handlers/travel'),
  ...require('../game/handlers/road'),
  ...require('../game/handlers/social'),
};

// Auth guard
router.use((req, res, next) => {
  if (!req.session.playerId) return res.status(401).json({ error: 'Not logged in.' });
  next();
});

// Inject player status into every JSON response
router.use((req, res, next) => {
  const origJson = res.json.bind(res);
  res.json = function(data) {
    if (data && typeof data === 'object' && !data.error && req.session?.playerId) {
      getPlayer(req.session.playerId).then(p => {
        if (p) data.status = buildPlayerStatus(p);
        origJson(data);
      }).catch(() => origJson(data));
    } else {
      origJson(data);
    }
  };
  next();
});

// ── Character setup ───────────────────────────────────────────────────────────
router.post('/setup', ar(async (req, res) => {
  const player = await getPlayer(req.session.playerId);
  const { action, param } = req.body;

  if (action === 'setup_all') {
    const name = (req.body.name || '').trim();
    const sex = parseInt(req.body.sex) === 5 ? 5 : 0;
    const cls = [1, 2, 3].includes(parseInt(req.body.classNum)) ? parseInt(req.body.classNum) : 1;
    if (name.length < 2 || name.length > 20)
      return res.status(400).json({ error: 'Name must be 2–20 characters.' });
    const classHp  = { 1: 30, 2: 25, 3: 22 };
    const classStr = { 1: 18, 2: 15, 3: 15 };
    await updatePlayer(player.id, {
      handle: name, sex, class: cls,
      hit_points: classHp[cls], hit_max: classHp[cls],
      strength: classStr[cls], setup_complete: 1, last_day: TODAY(),
    });
    return res.json(getTownScreen(await getPlayer(player.id)));
  }

  if (action === 'setup_name') {
    const name = (param || '').trim();
    if (name.length < 2 || name.length > 20) return res.json(getSetupScreen('name'));
    await updatePlayer(player.id, { handle: name });
    return res.json(getSetupScreen('sex'));
  }

  if (action === 'setup_sex') {
    await updatePlayer(player.id, { sex: parseInt(param) === 5 ? 5 : 0 });
    return res.json(getSetupScreen('class'));
  }

  if (action === 'setup_class') {
    const cls = [1, 2, 3].includes(parseInt(param)) ? parseInt(param) : 1;
    const classHp  = { 1: 30, 2: 25, 3: 22 };
    const classStr = { 1: 18, 2: 15, 3: 15 };
    await updatePlayer(player.id, {
      class: cls,
      hit_points: classHp[cls], hit_max: classHp[cls],
      strength: classStr[cls], setup_complete: 1, last_day: TODAY(),
    });
    return res.json(getTownScreen(await getPlayer(player.id)));
  }

  res.json(getSetupScreen('name'));
}));

// ── Restore state on page load ────────────────────────────────────────────────
router.get('/state', ar(async (req, res) => {
  const player = await getPlayer(req.session.playerId);
  if (!player) return res.status(401).json({ error: 'Player not found.' });
  if (!player.setup_complete) return res.json(getSetupScreen('name'));
  if (player.near_death) return res.json(getNearDeathWaitingScreen(player));
  if (player.captive)    return res.json(getCaptiveScreen(player));
  if (player.camping)    return res.json(getCampingScreen(player));
  if (player.travel_to)  return res.json(getRoadScreen(player));
  return res.json(getTownScreen(player));
}));

// ── Main action dispatcher ────────────────────────────────────────────────────
router.post('/action', ar(async (req, res) => {
  let player = await getPlayer(req.session.playerId);
  if (!player) return res.status(401).json({ error: 'Player not found.' });
  if (!player.setup_complete) return res.json(getSetupScreen('name'));

  // New-day routine
  let pendingMessages = [];
  if (player.last_day < TODAY()) {
    const { updates, messages } = await runNewDay(player);
    await updatePlayer(player.id, updates);
    player = await getPlayer(player.id);
    pendingMessages = messages;
  }

  // Heartbeat — keep last_seen current for "who's online" tracking
  updatePlayer(player.id, { last_seen: new Date().toISOString() }).catch(() => {});

  const { action, param } = req.body;
  const NEAR_DEATH_ALLOWED = ['near_death_wait', 'near_death_accept', 'town', 'logout'];
  const CAPTIVE_ALLOWED    = ['captive_wait', 'captive_buy_freedom', 'captive_escape', 'logout'];
  const CAMPING_ALLOWED    = ['camp_wait', 'road_turn_back', 'road_encounter_fight', 'road_encounter_run', 'road_encounter_power', 'logout'];

  if (player.near_death && !NEAR_DEATH_ALLOWED.includes(action))
    return res.json({ ...getNearDeathWaitingScreen(player), pendingMessages });

  if (player.captive && !CAPTIVE_ALLOWED.includes(action))
    return res.json({ ...getCaptiveScreen(player), pendingMessages });

  if (player.camping && !CAMPING_ALLOWED.includes(action))
    return res.json({ ...getCampingScreen(player), pendingMessages });

  // Inline cases that mutate session directly or need LEVEL_UP_GAINS
  switch (action) {

    case 'town':
      if (player.near_death) return res.json({ ...getNearDeathWaitingScreen(player), pendingMessages });
      return res.json({ ...getTownScreen(player), pendingMessages });

    case 'near_death_wait':
      return res.json(getNearDeathWaitingScreen(player));

    case 'near_death_accept': {
      const goldLost = Math.floor(Number(player.gold) * 0.5);
      const updates = {
        near_death: 0, near_death_by: '', dead: 0, poisoned: 0,
        hit_points: Math.max(5, Math.floor(player.hit_max * 0.5)),
        gold: Number(player.gold) - goldLost,
      };
      const msgs = [
        '`@You give in to your wounds...',
        `\`%You have been reincarnated! You lost \`$${goldLost.toLocaleString()}\`% gold.`,
      ];
      if (player.level > 1) {
        const gains = LEVEL_UP_GAINS[player.class];
        updates.level = player.level - 1;
        updates.hit_max = Math.max(15, player.hit_max - gains.hp);
        updates.hit_points = Math.max(5, Math.floor(updates.hit_max * 0.5));
        updates.strength = Math.max(15, player.strength - gains.strength);
        msgs.push(`\`@You lost a level! You are now level \`$${updates.level}\`%.`);
      }
      await updatePlayer(player.id, updates);
      await addNews(`\`8${player.handle}\`8 succumbed to their wounds in the forest.`);
      player = await getPlayer(player.id);
      return res.json({ ...getTownScreen(player), pendingMessages: msgs });
    }

    case 'logout':
      req.session.destroy();
      return res.json({ screen: 'login', lines: [], choices: [], pendingMessages: [] });

    default: {
      const handler = HANDLERS[action];
      if (handler) return handler({ action, player, param, req, res, pendingMessages });
      return res.json({ ...getTownScreen(player), pendingMessages });
    }
  }
}));

module.exports = router;
