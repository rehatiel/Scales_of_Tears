const express = require('express');
const { getPlayer, updatePlayer, claimNewDay, addNews, TODAY } = require('../db');
const { LEVEL_UP_GAINS, TOWNS, expForNextLevel } = require('../game/data');
const { runNewDay, runWorldDay } = require('../game/newday');
const {
  getTownScreen, getSetupScreen, getNearDeathWaitingScreen,
  getRoadScreen, getCampingScreen, getCaptiveScreen,
  getAbductionDungeonScreen, getInnScreen,
  setWorldEventCache, setInvaderCache,
} = require('../game/engine');
const { getActiveWorldEvent, getInvadingEnemies } = require('../db');
const { getEventDef } = require('../game/world_events');
const { parseWounds, infectionLabel } = require('../game/wounds');
const { getStartingRepUpdates } = require('../game/factions');

const router = express.Router();
const ar = fn => (req, res, next) => fn(req, res, next).catch(next);

// Day 1 of the Age of Tears = January 1, 2025 UTC
const EPOCH_DAY = Math.floor(new Date('2025-01-01T00:00:00Z').getTime() / 86400000);

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
    stamina:    player.stamina ?? player.fights_left ?? 10,
    staminaMax: player.stamina_max || 10,
    exp:        Number(player.exp),
    expNext:    expForNextLevel(player.level),
    level:     player.level,
    location:  townName,
    poisoned:  player.poisoned || 0,
    dead:      player.dead || 0,
    lordDay:   gameDay - EPOCH_DAY + 1,
    timeOfDay,
    wounds:    parseWounds(player).length,
    infection: player.infection_type ? infectionLabel(player.infection_type, player.infection_stage) : null,
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
  ...require('../game/handlers/abduction'),
  ...require('../game/handlers/factions'),
  ...require('../game/handlers/wilderness'),
  ...require('../game/handlers/dungeon'),
  ...require('../game/handlers/ruins'),
  ...require('../game/handlers/world_events'),
  ...require('../game/handlers/prestige'),
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
    const cls = [1,2,3,4,5,6,7,8,9,10].includes(parseInt(req.body.classNum)) ? parseInt(req.body.classNum) : 1;
    if (name.length < 2 || name.length > 20)
      return res.status(400).json({ error: 'Name must be 2–20 characters.' });
    if (name.includes('`'))
      return res.status(400).json({ error: 'Name cannot contain backtick characters.' });
    const classHp  = { 1: 28, 2: 35, 3: 22, 4: 20, 5: 25, 6: 32, 7: 25, 8: 22, 9: 18, 10: 26 };
    const classStr = { 1: 20, 2: 16, 3: 17, 4: 22, 5: 17, 6: 17, 7: 18, 8: 19, 9: 23, 10: 18 };
    await updatePlayer(player.id, {
      handle: name, sex, class: cls,
      hit_points: classHp[cls], hit_max: classHp[cls],
      strength: classStr[cls], setup_complete: 1, last_day: TODAY(),
      ...getStartingRepUpdates(cls),
    });
    return res.json(getTownScreen(await getPlayer(player.id)));
  }

  if (action === 'setup_name') {
    const name = (param || '').trim();
    if (name.length < 2 || name.length > 20 || name.includes('`')) return res.json(getSetupScreen('name'));
    await updatePlayer(player.id, { handle: name });
    return res.json(getSetupScreen('sex'));
  }

  if (action === 'setup_sex') {
    await updatePlayer(player.id, { sex: parseInt(param) === 5 ? 5 : 0 });
    return res.json(getSetupScreen('class'));
  }

  if (action === 'setup_class') {
    const cls = [1,2,3,4,5,6,7,8,9,10].includes(parseInt(param)) ? parseInt(param) : 1;
    const classHp  = { 1: 28, 2: 35, 3: 22, 4: 20, 5: 25, 6: 32, 7: 25, 8: 22, 9: 18, 10: 26 };
    const classStr = { 1: 20, 2: 16, 3: 17, 4: 22, 5: 17, 6: 17, 7: 18, 8: 19, 9: 23, 10: 18 };
    await updatePlayer(player.id, {
      class: cls,
      hit_points: classHp[cls], hit_max: classHp[cls],
      strength: classStr[cls], setup_complete: 1, last_day: TODAY(),
      ...getStartingRepUpdates(cls),
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
  if (player.camping)      return res.json(getCampingScreen(player));
  if (player.travel_to)   return res.json(getRoadScreen(player));
  if (player.retired_today) return res.json(getInnScreen(player, 0));
  if (req.session.abduction) {
    const state = req.session.abduction;
    const captor = state.captors[0];
    return res.json(getAbductionDungeonScreen(player, captor.name, state.captorsDefeated + state.captors.length));
  }
  return res.json(getTownScreen(player));
}));

// ── Main action dispatcher ────────────────────────────────────────────────────
router.post('/action', ar(async (req, res) => {
  let player = await getPlayer(req.session.playerId);
  if (!player) return res.status(401).json({ error: 'Player not found.' });
  if (!player.setup_complete) return res.json(getSetupScreen('name'));

  // New-day routine — claimNewDay does an atomic UPDATE to prevent duplicate processing
  let pendingMessages = [];
  const today = TODAY();
  if (player.last_day < today) {
    const claimed = await claimNewDay(player.id, today);
    if (claimed) {
      // World-level daily tasks (event rotation, invasions) — runs once per day server-wide
      runWorldDay().catch(e => console.error('runWorldDay error:', e));
      const { updates, messages } = await runNewDay(player);
      await updatePlayer(player.id, updates);
      pendingMessages = messages;
    }
    player = await getPlayer(player.id);
  }

  // Refresh world event + invader caches (synchronously available in all screen builders)
  const [activeEvent, townInvaders] = await Promise.all([
    getActiveWorldEvent(),
    getInvadingEnemies(player.current_town || 'dawnmark'),
  ]);
  setWorldEventCache(activeEvent ? getEventDef(activeEvent.type) : null);
  setInvaderCache({ [player.current_town || 'dawnmark']: townInvaders });

  // Heartbeat — keep last_seen current for "who's online" tracking
  updatePlayer(player.id, { last_seen: new Date().toISOString() }).catch(() => {});

  const action = typeof req.body.action === 'string' ? req.body.action.slice(0, 64) : '';
  const param  = req.body.param == null ? null : String(req.body.param).slice(0, 256);
  const NEAR_DEATH_ALLOWED = ['near_death_wait', 'near_death_accept', 'town', 'logout'];
  const CAPTIVE_ALLOWED    = ['captive_wait', 'captive_buy_freedom', 'captive_escape', 'logout'];
  const CAMPING_ALLOWED    = ['camp_wait', 'road_turn_back', 'road_encounter_fight', 'road_encounter_run', 'road_encounter_power', 'logout'];
  const ABDUCTION_ALLOWED  = ['abduction_fight', 'abduction_power', 'abduction_run', 'logout'];

  // Dead players are sent to town (they'll get a "you are dead" message there);
  // only logout and town navigation are allowed until reincarnation on the next day.
  const DEAD_ALLOWED = ['town', 'near_death_wait', 'near_death_accept', 'logout'];
  if (player.dead && !DEAD_ALLOWED.includes(action))
    return res.json({ ...getTownScreen(player), pendingMessages: ['`@You are dead. Come back tomorrow.'] });

  if (player.near_death && !NEAR_DEATH_ALLOWED.includes(action))
    return res.json({ ...getNearDeathWaitingScreen(player), pendingMessages });

  if (player.captive && !CAPTIVE_ALLOWED.includes(action))
    return res.json({ ...getCaptiveScreen(player), pendingMessages });

  if (player.camping && !CAMPING_ALLOWED.includes(action))
    return res.json({ ...getCampingScreen(player), pendingMessages });

  if (req.session.abduction && !ABDUCTION_ALLOWED.includes(action)) {
    const state = req.session.abduction;
    const captor = state.captors[0];
    return res.json({ ...getAbductionDungeonScreen(player, captor.name, state.captorsDefeated + state.captors.length), pendingMessages });
  }

  // Inline cases that mutate session directly or need LEVEL_UP_GAINS
  switch (action) {

    case 'town': {
      if (player.near_death) return res.json({ ...getNearDeathWaitingScreen(player), pendingMessages });
      // Invader entry hazard: one-time HP hit per invader per session
      if (townInvaders.length > 0 && !player.dead) {
        const inv = townInvaders[0];
        const seenKey = `invader_seen_${inv.id}`;
        if (!req.session[seenKey]) {
          req.session[seenKey] = true;
          const dmg = Math.max(1, Math.floor(player.hit_max * 0.04));
          await updatePlayer(player.id, { hit_points: Math.max(1, player.hit_points - dmg) });
          player = await getPlayer(player.id);
          pendingMessages = [...pendingMessages, `\`@${inv.given_name} prowls the gates — you take \`@${dmg}\`@ damage forcing your way through!`];
        }
      }
      return res.json({ ...getTownScreen(player), pendingMessages });
    }

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
      // Clear any stale forest/road session state from the run that killed them
      req.session.combat = null;
      req.session.forestDepth = null;
      req.session.forestEvent = null;
      req.session.rescueTarget = null;
      req.session.dragonCombat = null;
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
