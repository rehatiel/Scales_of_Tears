const { pool, getPlayer, updatePlayer, addNews, setWorldState, TODAY } = require('../../db');
const { RED_DRAGON, getChampionDragon } = require('../data');
const { resolveRound } = require('../combat');
const { getTownScreen, getDragonScreen, renderBanner } = require('../engine');

async function dragon({ player, req, res, pendingMessages }) {
  if (player.level < 12)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`@You must reach level 12 to challenge the dragon!'] });
  return res.json({ ...getDragonScreen(player), pendingMessages });
}

async function dragon_fight({ action, player, req, res, pendingMessages }) {
  if (player.level < 12) return res.json(getTownScreen(player));
  if (!req.session.dragonCombat && action === 'dragon_continue') return res.json(getTownScreen(player));

  const isChampion = (player.times_won || 0) > 0;
  const dragonDef  = isChampion ? getChampionDragon(player.times_won) : { ...RED_DRAGON };

  const dragonHp = req.session.dragonCombat ? req.session.dragonCombat.dragonHp : dragonDef.hp;
  const dr = { ...dragonDef, currentHp: dragonHp, maxHp: dragonDef.hp };

  const { playerDamage, monsterDamage, poisonDamage, log } = resolveRound(player, dr, 'attack');
  dr.currentHp = Math.max(0, dr.currentHp - playerDamage);
  const newHp = Math.max(0, player.hit_points - monsterDamage - (poisonDamage || 0));
  await updatePlayer(player.id, { hit_points: newHp });
  player = await getPlayer(player.id);

  // ── Dragon defeated ───────────────────────────────────────────────────────
  if (dr.currentHp <= 0) {
    req.session.dragonCombat = null;

    const isFirstKill = (player.times_won || 0) === 0;
    const newTimesWon = (player.times_won || 0) + 1;
    const goldReward  = dragonDef.gold;
    const expReward   = dragonDef.exp;

    const winUpdates = {
      times_won:  newTimesWon,
      seen_dragon: 5,
      is_legend:   1,
      gold: Number(player.gold) + goldReward,
      exp:  Number(player.exp)  + expReward,
    };

    // First kill bonus: permanent Dragonslayer strength and HP
    if (isFirstKill) {
      winUpdates.strength   = player.strength + 10;
      winUpdates.hit_max    = player.hit_max   + 20;
      winUpdates.hit_points = Math.min(player.hit_max + 20, player.hit_points + 20);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const keys = Object.keys(winUpdates);
      const set  = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
      await client.query(
        `UPDATE players SET ${set} WHERE id = $${keys.length + 1}`,
        [...keys.map(k => winUpdates[k]), player.id]
      );
      await client.query(
        'INSERT INTO hall_of_kings (handle, level, kills, class, times_won) VALUES ($1, $2, $3, $4, $5)',
        [player.handle, player.level, player.kills, player.class, newTimesWon]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    setWorldState('last_dragon_kill', TODAY()).catch(() => {});
    await addNews(`\`$*** ${player.handle} has slain ${dragonDef.name}! ***`);

    const firstKillLines = isFirstKill ? [
      '',
      '`$  ★ DRAGONSLAYER ★',
      '`%  The world knows your name.',
      '`!  The dragon\'s power flows into you.',
      '`0  Permanent bonus: +10 Strength, +20 Max HP.',
    ] : [];

    const winsLabel = isFirstKill
      ? '`$  *** YOU ARE NOW KING OF THE REALM! ***'
      : `\`$  *** ${dragonDef.name.toUpperCase()} FALLS FOR THE ${newTimesWon}${ordinal(newTimesWon)} TIME ***`;

    return res.json({
      screen: 'dragon_win', title: 'Victory!',
      lines: [
        ...renderBanner('dragon'),
        '`$              *** YOU WIN! ***',
        '', ...log.map(l => `  ${l.text}`), '',
        `\`$  ${dragonDef.death}`, '',
        `\`%  Congratulations, ${player.handle}!`,
        winsLabel,
        `\`%  Gold: \`$+${goldReward.toLocaleString()}   \`%Exp: \`$+${expReward.toLocaleString()}`,
        ...firstKillLines,
        '',
        '`7  ──────────────────────────────────────',
        '`!  [J]`% Ascend (Prestige) `8— reset to level 1 and carry your power forward',
        '`$  [T]`% Return to Town',
      ],
      choices: [
        { key: 'J', label: 'Ascend (Prestige)', action: 'prestige_confirm' },
        { key: 'T', label: 'Return to Town', action: 'town' },
      ],
      pendingMessages: [],
    });
  }

  // ── Player defeated ───────────────────────────────────────────────────────
  if (newHp <= 0) {
    req.session.dragonCombat = null;
    await updatePlayer(player.id, { dead: 1 });
    await addNews(`\`@${dragonDef.name} slew ${player.handle} in glorious combat!`);
    return res.json({
      screen: 'dragon_death', title: 'Defeated...',
      lines: [
        ...renderBanner('dragon'),
        '`@            *** THE DRAGON WINS ***',
        '', ...log.map(l => `  ${l.text}`), '',
        `\`@  ${dragonDef.name}: "Pathetic."`,
        '`%  You have been slain. Return tomorrow.',
        '', '`$  [T]`% Return to Town',
      ],
      choices: [{ key: 'T', label: 'Return to Town', action: 'town' }],
      pendingMessages: [],
    });
  }

  // ── Combat continues ──────────────────────────────────────────────────────
  req.session.dragonCombat = { dragonHp: dr.currentHp };
  const hpClass = newHp < player.hit_max * 0.3 ? '@' : '0';
  return res.json({
    screen: 'dragon_combat', title: `Fighting ${dragonDef.name}!`,
    lines: [
      ...renderBanner('dragon'),
      '`@              *** DRAGON COMBAT ***',
      '', ...log.map(l => `  ${l.text}`), '',
      `\`!  Dragon HP: \`@${dr.currentHp.toLocaleString()}\`!/${dragonDef.hp.toLocaleString()}`,
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

function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

module.exports = {
  dragon,
  dragon_fight,
  dragon_continue: dragon_fight,
  dragon_flee,
};
