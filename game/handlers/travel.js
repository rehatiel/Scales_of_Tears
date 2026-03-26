const { getPlayer, updatePlayer } = require('../../db');
const { TOWNS } = require('../data');
const { getWorldMapScreen, getTownScreen, getQuestChoiceScreen } = require('../engine');
const { checkTravelTrigger } = require('../quest_runner');

const TRAVEL_COST = 50;

async function world_map({ player, req, res, pendingMessages }) {
  return res.json({ ...getWorldMapScreen(player), pendingMessages });
}

async function travel({ player, param, req, res, pendingMessages }) {
  const current = TOWNS[player.current_town || 'dawnmark'] || TOWNS.dawnmark;
  const dest    = TOWNS[param];

  if (!dest) {
    return res.json({ ...getWorldMapScreen(player), pendingMessages: ['`@Unknown destination.'] });
  }
  if (!current.connections.includes(param)) {
    return res.json({ ...getWorldMapScreen(player), pendingMessages: [
      `\`@There is no direct route from ${current.name} to ${dest.name}.`,
    ]});
  }
  if (dest.minLevel && player.level < dest.minLevel) {
    return res.json({ ...getWorldMapScreen(player), pendingMessages: [
      `\`@The road to ${dest.name} is too dangerous for you.`,
      `\`@You must reach level \`$${dest.minLevel}\`@ before travelling there.`,
    ]});
  }
  if (Number(player.gold) < TRAVEL_COST) {
    return res.json({ ...getWorldMapScreen(player), pendingMessages: [
      `\`@You need ${TRAVEL_COST} gold to travel. You have ${Number(player.gold).toLocaleString()}.`,
    ]});
  }

  await updatePlayer(player.id, {
    current_town: param,
    gold: Number(player.gold) - TRAVEL_COST,
  });
  player = await getPlayer(player.id);

  const arrivalMsgs = [
    `\`6You spend ${TRAVEL_COST} gold on the road and arrive in \`$${dest.name}\`6.`,
    `\`8${dest.tagline}`,
  ];

  // Generic quest travel trigger: advance step and show choice screen if next step is a choice
  const travelTrigger = checkTravelTrigger(player, param);
  if (travelTrigger) {
    await updatePlayer(player.id, { quest_step: travelTrigger.nextStepOrder });
    player = await getPlayer(player.id);
    if (travelTrigger.nextStep?.type === 'choice') {
      return res.json({ ...getQuestChoiceScreen(player, travelTrigger.nextStep), pendingMessages: arrivalMsgs });
    }
  }

  return res.json({ ...getTownScreen(player), pendingMessages: arrivalMsgs });
}

module.exports = { world_map, travel };
