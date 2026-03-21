const { getPlayer, updatePlayer } = require('../../db');
const { getFactionHouseScreen, getInnScreen, getTownScreen } = require('../engine');
const { FACTIONS, getFactionRep } = require('../factions');
const { parseWounds, healerWoundCost, healerInfectionCost } = require('../wounds');

// Determine which faction's house the current town belongs to
function getFactionForTown(townId) {
  return Object.values(FACTIONS).find(f => f.homeTown === townId) || null;
}

async function faction_house({ player, req, res, pendingMessages }) {
  const town = player.current_town || 'dawnmark';
  const faction = getFactionForTown(town);
  if (!faction) return res.json({ ...getTownScreen(player), pendingMessages });
  return res.json({ ...getFactionHouseScreen(player, faction.id), pendingMessages });
}

async function faction_safe_rest({ player, req, res, pendingMessages }) {
  const town = player.current_town || 'dawnmark';
  const faction = getFactionForTown(town);
  if (!faction || getFactionRep(player, faction.id) < 75)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`@You do not have that privilege here.'] });
  if (player.hit_points >= player.hit_max)
    return res.json({ ...getFactionHouseScreen(player, faction.id), pendingMessages: ['`7You are already at full health.'] });

  await updatePlayer(player.id, { hit_points: player.hit_max });
  player = await getPlayer(player.id);
  return res.json({ ...getFactionHouseScreen(player, faction.id), pendingMessages: [
    `\`0A quiet room, clean linen, and no questions asked. You wake fully restored.`,
  ]});
}

async function faction_safe_heal({ player, req, res, pendingMessages }) {
  const town = player.current_town || 'dawnmark';
  const faction = getFactionForTown(town);
  if (!faction || getFactionRep(player, faction.id) < 75)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`@You do not have that privilege here.'] });

  const wounds = parseWounds(player);
  const hasInfection = !!player.infection_type && player.infection_type !== 'vampire' && !player.vampire_feasted;

  if (!wounds.length && !hasInfection)
    return res.json({ ...getFactionHouseScreen(player, faction.id), pendingMessages: ['`7You have no wounds or infections to treat.'] });

  const updates = {};
  const msgs = [];

  if (wounds.length) {
    updates.wounds = '[]';
    msgs.push('`0The faction healer tends to your wounds without charge.');
  }
  if (hasInfection) {
    updates.infection_type = '';
    updates.infection_stage = 0;
    updates.infection_days = 0;
    updates.vampire_bites = 0;
    msgs.push('`0The healer clears the infection with a practised hand. "Consider your debts paid."');
  }

  await updatePlayer(player.id, updates);
  player = await getPlayer(player.id);
  return res.json({ ...getFactionHouseScreen(player, faction.id), pendingMessages: msgs });
}

module.exports = { faction_house, faction_safe_rest, faction_safe_heal };
