// Wilderness handler — one zone per non-Dawnmark town, reuses forest combat engine
const { getPlayer, updatePlayer } = require('../../db');
const { getWildernessMonster, WILDERNESS_ZONES } = require('../wilderness');
const { getTownScreen, getForestEncounterScreen } = require('../engine');

async function wilderness({ player, req, res, pendingMessages }) {
  if (player.dead)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`@You are dead! Come back tomorrow.'] });

  const townId = player.current_town || 'dawnmark';
  const zone = WILDERNESS_ZONES[townId];
  if (!zone)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`7There is no wilderness region to explore here.'] });

  const stam = player.stamina ?? player.fights_left ?? 10;
  if (stam <= 0)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`@You are too exhausted to venture into the wilderness!'] });

  await updatePlayer(player.id, { stamina: stam - 1 });
  player = await getPlayer(player.id);

  const monster = await getWildernessMonster(townId, player.level, player.prestige_level || 0);
  req.session.wildernessMode = {
    townId,
    zoneName: zone.name,
    hasDungeon: !!zone.hasDungeon,
    dungeonId: zone.dungeonId || null,
  };
  req.session.combat = { monster, round: 1, history: [] };
  req.session.forestDepth = 0;

  return res.json({
    ...getForestEncounterScreen(player, monster),
    pendingMessages: [...pendingMessages, `\`8You enter ${zone.name}.`],
  });
}

async function wilderness_continue({ player, req, res, pendingMessages }) {
  const wMode = req.session.wildernessMode;
  if (!wMode)
    return res.json({ ...getTownScreen(player), pendingMessages });

  const zone = WILDERNESS_ZONES[wMode.townId];
  if (!zone) {
    req.session.wildernessMode = null;
    return res.json({ ...getTownScreen(player), pendingMessages });
  }

  const stam = player.stamina ?? player.fights_left ?? 10;
  if (stam <= 0) {
    req.session.wildernessMode = null;
    return res.json({ ...getTownScreen(player), pendingMessages: ['`@You are too exhausted to continue! You head back to town.'] });
  }

  await updatePlayer(player.id, { stamina: stam - 1 });
  player = await getPlayer(player.id);

  const monster = await getWildernessMonster(wMode.townId, player.level, player.prestige_level || 0);
  req.session.combat = { monster, round: 1, history: [] };
  req.session.forestDepth = 0;

  return res.json({ ...getForestEncounterScreen(player, monster), pendingMessages });
}

module.exports = { wilderness, wilderness_continue };
