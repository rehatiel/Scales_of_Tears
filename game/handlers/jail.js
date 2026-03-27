const { getPlayer, updatePlayer, addNews, getJailedPlayersInTown } = require('../../db');
const { getJailScreen, getJailBailScreen, getTownScreen } = require('../engine');
const { TOWNS } = require('../data');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function renderJail(player) {
  const cellmates = await getJailedPlayersInTown(player.jail_town || player.current_town, player.id);
  return getJailScreen(player, cellmates);
}

async function releasePlayer(player) {
  await updatePlayer(player.id, { jailed_until: null, jail_town: null, jail_offense: null });
  return getPlayer(player.id);
}

// ── Action: jail (initial entry — redirect from routes/game.js) ───────────────

async function jail({ player, req, res, pendingMessages }) {
  return res.json({ ...(await renderJail(player)), pendingMessages });
}

// ── Action: wait quietly in the cell ──────────────────────────────────────────

async function jail_wait({ player, req, res, pendingMessages }) {
  if (Date.now() >= (player.jailed_until || 0)) {
    player = await releasePlayer(player);
    return res.json({ ...getTownScreen(player), pendingMessages: [
      ...pendingMessages,
      '`0The guard rattles the cell door open. "Time\'s up. On your way — and don\'t come back."',
    ]});
  }

  const mins = Math.ceil(((player.jailed_until || 0) - Date.now()) / 60000);
  return res.json({ ...(await renderJail(player)), pendingMessages: [
    ...pendingMessages,
    '`7You sit with your back against the cold stone and wait.',
    `\`8${mins} minute${mins !== 1 ? 's' : ''} still to go.`,
  ]});
}

// ── Random cell events ─────────────────────────────────────────────────────────

const CELL_EVENTS = [
  // Prisoner attack — lose a bit of HP
  async function(player) {
    const dmg = Math.max(1, Math.floor(player.hit_max * 0.05));
    const newHp = Math.max(1, player.hit_points - dmg);
    await updatePlayer(player.id, { hit_points: newHp });
    return [
      '`@The rough-looking prisoner two cells over has long reach.',
      '`@An arm snakes through the bars and catches you across the ear.',
      `\`@You take ${dmg} damage before you scramble back.`,
    ];
  },

  // Mean guards — lose 1 charm
  async function(player) {
    const newCharm = Math.max(1, (player.charm || 10) - 1);
    await updatePlayer(player.id, { charm: newCharm });
    return [
      '`8A guard stops outside your cell. Just stares. Then laughs once, short and cold.',
      '`8He tips your water cup through the bars onto the floor and walks off.',
      `\`8(Charm −1, now ${newCharm})`,
    ];
  },

  // New friend — gain exp from the conversation
  async function(player) {
    const gain = player.level * 12;
    await updatePlayer(player.id, { exp: Number(player.exp) + gain });
    return [
      '`!The prisoner in the next cell has seen things.',
      '`!Old roads, hidden passes, caravan routes the guards don\'t know about.',
      '`!By the time they\'re done talking, you\'ve learned something worth remembering.',
      `\`0(+${gain} experience)`,
    ];
  },

  // Quiet — nothing
  async function(player) {
    return [
      '`7The candle gutters. Somewhere outside, a door slams.',
      '`8Nothing else happens. Time just... passes.',
    ];
  },

  // Overheard guards — gain 1 charm
  async function(player) {
    const newCharm = Math.min(50, (player.charm || 10) + 1);
    await updatePlayer(player.id, { charm: newCharm });
    return [
      '`6Two guards argue just outside your reach — patrol routes, a merchant who owes someone money,',
      '`6a name that\'ll be worth something later. You file it all away.',
      `\`#(Charm +1, now ${newCharm})`,
    ];
  },

  // Cramp and discomfort — nothing mechanical, just flavour
  async function(player) {
    return [
      '`8The straw pokes through your clothes no matter how you arrange it.',
      '`8You shift. Shift again. Give up.',
      '`7This is what you get.',
    ];
  },
];

// Weights must match CELL_EVENTS order
const EVENT_WEIGHTS = [15, 15, 20, 30, 15, 5];

async function jail_event({ player, req, res, pendingMessages }) {
  if (Date.now() >= (player.jailed_until || 0)) {
    player = await releasePlayer(player);
    return res.json({ ...getTownScreen(player), pendingMessages: [
      ...pendingMessages,
      '`0The guard opens the cell. "You\'re free. Now get out before I find something else to charge you with."',
    ]});
  }

  const total = EVENT_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let chosen = CELL_EVENTS.length - 1;
  for (let i = 0; i < EVENT_WEIGHTS.length; i++) {
    r -= EVENT_WEIGHTS[i];
    if (r <= 0) { chosen = i; break; }
  }

  const msgs = await CELL_EVENTS[chosen](player);
  player = await getPlayer(player.id);
  return res.json({ ...(await renderJail(player)), pendingMessages: [...pendingMessages, ...msgs] });
}

// ── Bail list — show prisoners in the viewer's current town ───────────────────

async function jail_bail_list({ player, req, res, pendingMessages }) {
  const townId = player.current_town || 'dawnmark';
  const prisoners = await getJailedPlayersInTown(townId, player.id);
  return res.json({ ...getJailBailScreen(player, prisoners), pendingMessages });
}

// ── Pay bail for another player ────────────────────────────────────────────────

async function jail_bail_pay({ player, param, req, res, pendingMessages }) {
  const targetId = parseInt(param);
  const townId = player.current_town || 'dawnmark';

  if (!targetId) {
    const prisoners = await getJailedPlayersInTown(townId, player.id);
    return res.json({ ...getJailBailScreen(player, prisoners), pendingMessages: [...pendingMessages, '`@Invalid prisoner.'] });
  }

  const target = await getPlayer(targetId);
  if (!target || !target.jailed_until || Date.now() >= target.jailed_until) {
    const prisoners = await getJailedPlayersInTown(townId, player.id);
    return res.json({ ...getJailBailScreen(player, prisoners), pendingMessages: [...pendingMessages, '`7That prisoner has already been released.'] });
  }

  if ((target.jail_town || '') !== townId) {
    const prisoners = await getJailedPlayersInTown(townId, player.id);
    return res.json({ ...getJailBailScreen(player, prisoners), pendingMessages: [...pendingMessages, '`@That prisoner is being held in a different town.'] });
  }

  const remaining = Math.max(0, target.jailed_until - Date.now());
  const minutes = Math.ceil(remaining / 60000);
  const bailCost = Math.min(2000, Math.ceil(minutes * 10));

  if (Number(player.gold) < bailCost) {
    const prisoners = await getJailedPlayersInTown(townId, player.id);
    return res.json({ ...getJailBailScreen(player, prisoners), pendingMessages: [
      ...pendingMessages,
      `\`@You don't have enough gold. Bail for ${target.handle} is ${bailCost.toLocaleString()}g — you have ${Number(player.gold).toLocaleString()}g.`,
    ]});
  }

  await updatePlayer(player.id, { gold: Number(player.gold) - bailCost });
  await updatePlayer(target.id, { jailed_until: null, jail_town: null, jail_offense: null });

  const townName = (TOWNS[townId] || TOWNS.dawnmark).name;
  await addNews(`\`0${player.handle}\`% paid ${bailCost.toLocaleString()} gold to spring \`7${target.handle}\`% from the ${townName} jail.`);

  player = await getPlayer(player.id);
  const prisoners = await getJailedPlayersInTown(townId, player.id);
  return res.json({ ...getJailBailScreen(player, prisoners), pendingMessages: [
    ...pendingMessages,
    `\`0You count out ${bailCost.toLocaleString()} gold onto the warden's desk.`,
    '`7He doesn\'t thank you. He does unlock the cell.',
    `\`0${target.handle} walks out, blinking at the light.`,
  ]});
}

module.exports = {
  jail,
  jail_wait,
  jail_event,
  jail_bail_list,
  jail_bail_pay,
};
