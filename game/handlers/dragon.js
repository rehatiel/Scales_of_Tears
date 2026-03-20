const { getPlayer, updatePlayer, addNews, addToHallOfKings } = require('../../db');
const { RED_DRAGON } = require('../data');
const { resolveRound } = require('../combat');
const { getTownScreen, getDragonScreen, renderBanner } = require('../engine');

async function dragon({ player, req, res, pendingMessages }) {
  if (player.level < 12)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`@You must reach level 12 to challenge the Red Dragon!'] });
  return res.json({ ...getDragonScreen(player), pendingMessages });
}

async function dragon_fight({ action, player, req, res, pendingMessages }) {
  if (player.level < 12) return res.json(getTownScreen(player));
  if (!req.session.dragonCombat && action === 'dragon_continue') return res.json(getTownScreen(player));

  const dragonHp = req.session.dragonCombat ? req.session.dragonCombat.dragonHp : RED_DRAGON.hp;
  const dr = { ...RED_DRAGON, currentHp: dragonHp, maxHp: RED_DRAGON.hp };

  const { playerDamage, monsterDamage, poisonDamage, log } = resolveRound(player, dr, 'attack');
  dr.currentHp = Math.max(0, dr.currentHp - playerDamage);
  const newHp = Math.max(0, player.hit_points - monsterDamage - (poisonDamage || 0));
  await updatePlayer(player.id, { hit_points: newHp });
  player = await getPlayer(player.id);

  if (dr.currentHp <= 0) {
    req.session.dragonCombat = null;
    await updatePlayer(player.id, { times_won: player.times_won + 1, seen_dragon: 5, is_legend: 1 });
    await addToHallOfKings(player);
    await addNews(`\`$*** ${player.handle} has slain the Red Dragon and is crowned King! ***`);
    player = await getPlayer(player.id);
    return res.json({
      screen: 'dragon_win', title: 'Victory!',
      lines: [
        ...renderBanner('dragon'),
        '`$              *** YOU WIN! ***',
        '', ...log.map(l => `  ${l.text}`), '',
        `\`$  ${RED_DRAGON.death}`, '',
        `\`%  Congratulations, ${player.handle}!`,
        '`$  *** YOU ARE NOW KING OF THE REALM! ***',
        `\`%  This is win number \`$${player.times_won}\`% for you!`,
        '', '`$  [T]`% Return to Town',
      ],
      choices: [{ key: 'T', label: 'Return to Town', action: 'town' }],
      pendingMessages: [],
    });
  }

  if (newHp <= 0) {
    req.session.dragonCombat = null;
    await updatePlayer(player.id, { dead: 1 });
    await addNews(`\`@The Red Dragon slew ${player.handle} in glorious combat!`);
    return res.json({
      screen: 'dragon_death', title: 'Defeated...',
      lines: [
        ...renderBanner('dragon'),
        '`@            *** THE DRAGON WINS ***',
        '', ...log.map(l => `  ${l.text}`), '',
        '`@  The Red Dragon laughs. "Pathetic."',
        '`%  You have been slain. Return tomorrow.',
        '', '`$  [T]`% Return to Town',
      ],
      choices: [{ key: 'T', label: 'Return to Town', action: 'town' }],
      pendingMessages: [],
    });
  }

  req.session.dragonCombat = { dragonHp: dr.currentHp };
  const hpClass = newHp < player.hit_max * 0.3 ? '@' : '0';
  return res.json({
    screen: 'dragon_combat', title: 'Fighting the Dragon!',
    lines: [
      ...renderBanner('dragon'),
      '`@              *** DRAGON COMBAT ***',
      '', ...log.map(l => `  ${l.text}`), '',
      `\`!  Dragon HP: \`@${dr.currentHp.toLocaleString()}\`!/2,000`,
      `\`!  Your HP:   \`${hpClass}${newHp.toLocaleString()}\`!/\`%${player.hit_max.toLocaleString()}`,
      '', '`$  [F]`% Continue Fighting!', '`$  [R]`% Flee!',
    ],
    choices: [
      { key: 'F', label: 'Fight On!', action: 'dragon_continue' },
      { key: 'R', label: 'Flee!', action: 'dragon_flee' },
    ],
    pendingMessages: [],
  });
}

async function dragon_flee({ player, req, res, pendingMessages }) {
  req.session.dragonCombat = null;
  const goldLost = Math.floor(Number(player.gold) * 0.5);
  await updatePlayer(player.id, { gold: Number(player.gold) - goldLost });
  player = await getPlayer(player.id);
  return res.json({ ...getTownScreen(player), pendingMessages: [`\`@You flee! You lose ${goldLost.toLocaleString()} gold in your panic!`] });
}

module.exports = {
  dragon,
  dragon_fight,
  dragon_continue: dragon_fight,
  dragon_flee,
};
