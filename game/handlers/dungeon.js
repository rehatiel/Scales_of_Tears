// Dungeon handler — multi-room sequential runs, state in req.session.dungeon
// Combat rooms reuse forest_attack/run/power via req.session.combat
// Event rooms use dungeon_event action
const { getPlayer, updatePlayer, addNews } = require('../../db');
const { getDungeon } = require('../dungeons');
const { checkLevelUp } = require('../newday');
const { getNamedItemDrop } = require('../data');
const {
  getTownScreen, getForestEncounterScreen,
  getDungeonEventScreen, getDungeonCompleteScreen, getLevelUpScreen,
} = require('../engine');

function buildDungeonMonster(template, level) {
  const baseStr  = 10 + level * 8;
  const baseHp   = 20 + level * 15;
  const baseGold = 5  + level * 12;
  const baseExp  = 8  + level * 10;
  const str = Math.floor(baseStr * (template.strMult ?? 1.0));
  const hp  = Math.floor(baseHp  * (template.hpMult  ?? 1.0));
  return {
    name:      template.name,
    weapon:    template.weapon,
    behavior:  template.behavior || 'normal',
    strength:  str,
    hp, maxHp: hp, currentHp: hp,
    gold:      Math.floor(baseGold * (template.goldMult ?? 1.0)),
    exp:       Math.floor(baseExp  * (template.expMult  ?? 1.0)),
    meet:      template.meet,
    death:     template.death,
    isBoss:    !!template.isBoss,
  };
}

async function showRoom(player, dungeon, roomIdx, req, res, introMsgs = []) {
  const room = dungeon.rooms[roomIdx];
  const totalRooms = dungeon.rooms.length;
  const roomNum = roomIdx + 1;

  if (room.type === 'event') {
    return res.json({
      ...getDungeonEventScreen(player, dungeon, room, roomNum, totalRooms),
      pendingMessages: introMsgs,
    });
  }

  // combat or boss
  const monster = buildDungeonMonster(room.monster, player.level);
  req.session.combat = { monster, round: 1, history: [] };
  req.session.forestDepth = 0;

  const introLines = (room.intro || []).filter(Boolean);
  const bossMarker = room.type === 'boss' ? '`@  ★ BOSS ENCOUNTER ★' : null;

  return res.json({
    ...getForestEncounterScreen(player, monster),
    pendingMessages: [...introMsgs, ...introLines, bossMarker].filter(Boolean),
  });
}

async function dungeon_enter({ player, req, res, pendingMessages }) {
  const wMode = req.session.wildernessMode;
  if (!wMode || !wMode.hasDungeon || !wMode.dungeonId)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`7No dungeon entrance found here.'] });

  const dungeonId = wMode.dungeonId;
  const dungeon = getDungeon(dungeonId);
  if (!dungeon)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`@Dungeon data not found.'] });

  // Check if already cleared today
  const clears = JSON.parse(player.dungeon_clears || '[]');
  if (clears.includes(dungeonId)) {
    return res.json({
      ...getTownScreen(player),
      pendingMessages: [`\`7You have already cleared ${dungeon.name} today. Return tomorrow.`],
    });
  }

  req.session.dungeon = { id: dungeonId, room: 0, totalRooms: dungeon.rooms.length };

  return showRoom(player, dungeon, 0, req, res, [
    ...pendingMessages,
    `\`$You enter ${dungeon.name}.`,
    `\`8There is no going back.`,
  ]);
}

// Called from forest_combat win path when req.session.dungeon is set
async function advanceDungeonRoom(player, req, res, killLog) {
  const ds = req.session.dungeon;
  if (!ds) return res.json(getTownScreen(player));

  const dungeon = getDungeon(ds.id);
  if (!dungeon) {
    req.session.dungeon = null;
    return res.json(getTownScreen(player));
  }

  const nextRoom = ds.room + 1;

  // All rooms cleared!
  if (nextRoom >= dungeon.rooms.length) {
    req.session.dungeon = null;
    req.session.wildernessMode = null;

    const reward = dungeon.reward;
    const goldGain = (reward.goldMult || 0) * player.level;
    const expGain  = (reward.expMult  || 0) * player.level;

    const updates = {
      gold: Number(player.gold) + goldGain,
      exp:  Number(player.exp)  + expGain,
      dungeon_clears: JSON.stringify([...JSON.parse(player.dungeon_clears || '[]'), ds.id]),
    };

    // Named item chance
    let dropMsgs = [];
    if (reward.namedItemChance && !player.named_weapon_id && !player.named_armor_id
        && Math.random() < reward.namedItemChance) {
      const drop = getNamedItemDrop(player.level);
      if (drop) {
        if (drop.type === 'weapon') {
          updates.named_weapon_id = drop.id;
          updates.strength = player.strength + drop.strength;
          if (drop.strPenalty) updates.strength += drop.strPenalty;
        } else {
          updates.named_armor_id = drop.id;
          updates.defense = player.defense + drop.defense;
          if (drop.strPenalty) updates.strength = player.strength + drop.strPenalty;
        }
        dropMsgs = [
          `\`$★ RARE FIND! You discover \`!${drop.name}\`$!`,
          `\`8  "${drop.lore}"`,
          `\`!  Effect: ${drop.effectDesc}`,
          `\`0  It binds to you — already active. Check [C]haracter to see it.`,
        ];
      }
    }

    await updatePlayer(player.id, updates);
    player = await getPlayer(player.id);
    await addNews(`\`$${player.handle}\`% cleared \`!${dungeon.name}\`%!`);

    const levelUp = checkLevelUp(player);
    if (levelUp) {
      await updatePlayer(player.id, levelUp.updates);
      player = await getPlayer(player.id);
      await addNews(`\`$${player.handle}\`% has advanced to level \`$${levelUp.newLevel}\`%!`);
      return res.json({
        ...getLevelUpScreen(player, levelUp.newLevel, levelUp.hpGain, levelUp.strGain, levelUp.perkPoint, levelUp.specPoint),
        pendingMessages: [...(killLog || []).map(l => l.text || l), ...dropMsgs],
      });
    }

    const rewardMsgs = [
      ...(reward.msgs || []),
      goldGain > 0 ? `\`$You gain ${goldGain.toLocaleString()} gold!` : null,
      expGain  > 0 ? `\`0You gain ${expGain.toLocaleString()} experience!` : null,
      ...dropMsgs,
    ].filter(Boolean);

    return res.json({
      ...getDungeonCompleteScreen(player, dungeon),
      pendingMessages: [...(killLog || []).map(l => l.text || l), ...rewardMsgs],
    });
  }

  // Advance to next room
  req.session.dungeon = { ...ds, room: nextRoom };
  return showRoom(player, dungeon, nextRoom, req, res, (killLog || []).map(l => l.text || l));
}

async function dungeon_event({ player, param, req, res, pendingMessages }) {
  const ds = req.session.dungeon;
  if (!ds) return res.json({ ...getTownScreen(player), pendingMessages });

  const dungeon = getDungeon(ds.id);
  if (!dungeon) {
    req.session.dungeon = null;
    return res.json({ ...getTownScreen(player), pendingMessages });
  }

  const room = dungeon.rooms[ds.room];
  if (!room || room.type !== 'event')
    return res.json({ ...getTownScreen(player), pendingMessages });

  const outcome = room.outcomes[param];
  if (!outcome) return res.json({ ...getTownScreen(player), pendingMessages });

  const msgs = [...(outcome.msg || [])];
  const updates = {};

  if (outcome.goldMult) {
    const g = outcome.goldMult * player.level;
    updates.gold = Number(player.gold) + g;
    msgs.push(`\`0You gain ${g.toLocaleString()} gold!`);
  }
  if (outcome.expMult) {
    const xp = outcome.expMult * player.level;
    updates.exp = Number(player.exp) + xp;
    msgs.push(`\`0You gain ${xp.toLocaleString()} experience!`);
  }
  if (outcome.hpPct) {
    const delta = Math.floor(outcome.hpPct * player.hit_max);
    const base = updates.hit_points ?? player.hit_points;
    updates.hit_points = Math.max(1, Math.min(player.hit_max, base + delta));
    if (delta < 0) msgs.push(`\`@You lost ${Math.abs(delta)} hit points!`);
    else msgs.push(`\`0You recovered ${delta} hit points!`);
  }
  if (outcome.hp) {
    const base = updates.hit_points ?? player.hit_points;
    updates.hit_points = Math.max(1, Math.min(player.hit_max, base + outcome.hp));
    if (outcome.hp < 0) msgs.push(`\`@You lost ${Math.abs(outcome.hp)} hit points!`);
    else msgs.push(`\`0You recovered ${outcome.hp} hit points!`);
  }
  if (outcome.gem) {
    updates.gems = Math.max(0, player.gems + outcome.gem);
    if (outcome.gem > 0) msgs.push(`\`0You found a gem!`);
  }

  if (Object.keys(updates).length) {
    await updatePlayer(player.id, updates);
    player = await getPlayer(player.id);
  }

  if (outcome.expMult) {
    const levelUp = checkLevelUp(player);
    if (levelUp) {
      await updatePlayer(player.id, levelUp.updates);
      player = await getPlayer(player.id);
      await addNews(`\`$${player.handle}\`% has advanced to level \`$${levelUp.newLevel}\`%!`);
      return res.json({
        ...getLevelUpScreen(player, levelUp.newLevel, levelUp.hpGain, levelUp.strGain, levelUp.perkPoint, levelUp.specPoint),
        pendingMessages: msgs,
      });
    }
  }

  return advanceDungeonRoom(player, req, res, msgs.map(text => ({ text })));
}

async function dungeon_retreat({ player, req, res }) {
  req.session.dungeon = null;
  req.session.wildernessMode = null;
  return res.json({ ...getTownScreen(player), pendingMessages: ['`7You retreat from the dungeon and find your way back to town.'] });
}

module.exports = { dungeon_enter, dungeon_event, dungeon_retreat, advanceDungeonRoom };
