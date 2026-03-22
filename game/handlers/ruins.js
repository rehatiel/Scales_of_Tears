// Ruins handler — fixed locations, one-time per player per day, choice-based encounters
const { getPlayer, updatePlayer, addNews } = require('../../db');
const { RUINS } = require('../ruins');
const { checkLevelUp } = require('../newday');
const { getTownScreen, getRuinsScreen, getLevelUpScreen } = require('../engine');
const { getWeaponByNum } = require('../data');

async function ruins({ player, req, res, pendingMessages }) {
  if (player.dead)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`@You are dead! Come back tomorrow.'] });

  const townId = player.current_town || 'dawnmark';
  const ruin = RUINS[townId];
  if (!ruin)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`7There are no ruins to explore here.'] });

  const visited = JSON.parse(player.ruins_visited || '[]');
  if (visited.includes(ruin.id)) {
    return res.json({
      ...getTownScreen(player),
      pendingMessages: [`\`7You have already explored ${ruin.name} today. Return tomorrow.`],
    });
  }

  // Mark visited before showing screen (prevent double-dip on back navigation)
  await updatePlayer(player.id, { ruins_visited: JSON.stringify([...visited, ruin.id]) });
  player = await getPlayer(player.id);

  return res.json({ ...getRuinsScreen(player, ruin), pendingMessages });
}

async function handleSwordPull({ player, res }) {
  const roll = Math.random();
  const updates = {};
  let msgs = [];

  if (roll < 0.25) {
    // ── 1. Stuck — won't move ───────────────────────────────────────────────
    const xp = 20 * player.level;
    updates.exp = Number(player.exp) + xp;
    msgs = [
      'You wrap both hands around the hilt and pull with everything you have.',
      'The floor does not yield. The sword does not yield.',
      'Whatever holds it there is not physical.',
      '`7You release it, breathing hard. The sword stands unmoved.',
      `\`8(+${xp} exp for the attempt)`,
    ];

  } else if (roll < 0.35) {
    // ── 2. Clean pull — success (10%) ─────────────────────────────────────
    const xp = 60 * player.level;
    updates.exp = Number(player.exp) + xp;
    updates.alignment = Math.max(-100, Math.min(100, (player.alignment || 0) + 5));
    msgs = [
      'The sword comes free with a sound like a sigh.',
      'It is not a legendary blade — just a good one, finally freed.',
      '`%You feel something of its last owner\'s resolve pass into you.',
      `\`0You gain ${xp.toLocaleString()} experience!`,
      '`0A deed of virtue. Alignment +5.',
    ];
    const newWeapon = getWeaponByNum(4);
    if (newWeapon && !player.weapon_cursed) {
      const curWeapon = player.weapon_num > 0 ? getWeaponByNum(player.weapon_num) : null;
      if (!curWeapon || newWeapon.strength > curWeapon.strength) {
        updates.weapon_num  = newWeapon.num;
        updates.weapon_name = newWeapon.name;
        updates.strength    = player.strength + newWeapon.strength - (curWeapon ? curWeapon.strength : 0);
        msgs.push(`\`$You take up the ${newWeapon.name}!`);
      } else {
        msgs.push(`\`7Your ${curWeapon.name} is already superior — you leave the sword where it stood.`);
      }
    }

  } else if (roll < 0.55) {
    // ── 3. Cursed sword (20%) ──────────────────────────────────────────────
    updates.alignment = Math.max(-100, Math.min(100, (player.alignment || 0) - 15));
    msgs = [
      'The sword wrenches free — not with a sigh, but with a crack.',
      'The blade is dark along its edge, threaded with runes that seem to shift.',
      '`@As your grip tightens, you feel it settle into your hand — permanent. Unwilling to leave.',
      '`@There is power here. There is also something watching from inside the steel.',
      '`@Alignment −15.',
    ];
    const newWeapon = getWeaponByNum(6);
    if (newWeapon) {
      if (player.weapon_cursed) {
        msgs.push('`7You already bear a cursed burden — you cannot take another. The sword clatters to the floor.');
      } else {
        const curWeapon = player.weapon_num > 0 ? getWeaponByNum(player.weapon_num) : null;
        updates.weapon_num    = newWeapon.num;
        updates.weapon_name   = newWeapon.name;
        updates.weapon_cursed = 1;
        updates.strength      = player.strength + newWeapon.strength - (curWeapon ? curWeapon.strength : 0);
        msgs.push(`\`$You wield the ${newWeapon.name}.`);
        msgs.push('`@It will not leave your hand willingly. Seek a priest or druid to lift the curse.');
      }
    }

  } else if (roll < 0.75) {
    // ── 4. Ghost fight — auto-resolved (20%) ──────────────────────────────
    const floorSword = getWeaponByNum(4);
    const curWeapon  = player.weapon_num > 0 ? getWeaponByNum(player.weapon_num) : null;
    // Is the floor sword an upgrade the player would pocket?
    const swordUpgrade = floorSword && !player.weapon_cursed &&
                         (!curWeapon || floorSword.strength > curWeapon.strength);

    const ghostStr  = 18 + (player.level * 3);
    const winChance = player.strength / (player.strength + ghostStr);
    const won       = Math.random() < winChance;
    msgs = [
      'The sword comes free.',
      'Then the cold hits — absolute, sourceless.',
      '`8A shape assembles itself from the far shadows, dressed in armour that no longer quite fits reality.',
      '`%"That," it says, with the patience of decades, "is mine."',
    ];
    if (won) {
      const xp = 80 * player.level;
      updates.exp = Number(player.exp) + xp;
      if (swordUpgrade) {
        updates.weapon_num  = floorSword.num;
        updates.weapon_name = floorSword.name;
        updates.strength    = player.strength + floorSword.strength - (curWeapon ? curWeapon.strength : 0);
        msgs.push(`\`$You claim the ${floorSword.name}.`);
      }
      msgs.push(
        '`%You refuse. The ghost lunges.',
        '`0The fight is brief and brutal — ghosts bleed nothing, but they break.',
        '`0It dissolves, furious, back into the stone floor.',
        '`0You stand. You breathe. You keep the sword.',
        `\`0You gain ${xp.toLocaleString()} experience!`,
      );
      await addNews(`\`$${player.handle}\`% defeated the ghost of the Shattered Keep and claimed its sword.`);
    } else {
      const dmg = Math.floor(player.hit_max * 0.25);
      updates.hit_points = Math.max(1, player.hit_points - dmg);
      // Ghost takes his sword back — strip it from the player's hands
      if (swordUpgrade) {
        // Sword was in the player's grip; revert to what they came in with
        updates.weapon_num  = player.weapon_num;
        updates.weapon_name = player.weapon_name;
        updates.strength    = player.strength;
      } else if (floorSword && player.weapon_num === floorSword.num && !player.weapon_cursed) {
        // Edge case: player already had this weapon — ghost strips it regardless
        updates.weapon_num  = 0;
        updates.weapon_name = 'Fists';
        updates.strength    = player.strength - floorSword.strength;
      }
      msgs.push(
        '`%You refuse to let go.',
        '`@The ghost is stronger than it looks.',
        '`@It tears the sword from your grip with a force that sends you into the wall.',
        `\`@You take ${dmg} damage.`,
        '`@The ghost and its sword dissolve back into the stone.',
        '`7The room is warm again. And empty.',
      );
    }

  } else {
    // ── 5. The blade crumbles (25%) ────────────────────────────────────────
    const xp = 40 * player.level;
    updates.exp  = Number(player.exp) + xp;
    updates.gems = player.gems + 1;
    msgs = [
      'Your hands close around the hilt. The sword begins to come free.',
      'Then it crumbles.',
      'Centuries of tension, released at once. The blade falls to dust between your fingers.',
      '`8Only the pommel-stone survives — a deep red gem, perfectly preserved in the ash.',
      `\`0You pocket the gem and gain ${xp.toLocaleString()} experience for the attempt.`,
    ];
  }

  if (Object.keys(updates).length) {
    await updatePlayer(player.id, updates);
    player = await getPlayer(player.id);
  }

  if (updates.exp !== undefined) {
    const levelUp = checkLevelUp(player);
    if (levelUp) {
      await updatePlayer(player.id, levelUp.updates);
      player = await getPlayer(player.id);
      await addNews(`\`$${player.handle}\`% has advanced to level \`$${levelUp.newLevel}\`%!`);
      return res.json({
        ...getLevelUpScreen(player, levelUp.newLevel, levelUp.hpGain, levelUp.strGain, levelUp.perkPoint),
        pendingMessages: msgs,
      });
    }
  }

  return res.json({ ...getTownScreen(player), pendingMessages: msgs });
}

async function ruins_choice({ player, param, req, res, pendingMessages }) {
  const townId = player.current_town || 'dawnmark';
  const ruin = RUINS[townId];
  if (!ruin)
    return res.json({ ...getTownScreen(player), pendingMessages });

  // Shattered Keep sword pull has its own randomised logic
  if (ruin.id === 'silverkeep_ruin' && param === 'pull')
    return handleSwordPull({ player, res });

  const outcome = ruin.outcomes[param];
  if (!outcome)
    return res.json({ ...getTownScreen(player), pendingMessages });

  const msgs = [...(outcome.msg || [])];
  const updates = {};

  if (outcome.goldFlat) {
    const delta = outcome.goldFlat < 0 ? Math.max(-Number(player.gold), outcome.goldFlat) : outcome.goldFlat;
    updates.gold = Number(player.gold) + delta;
    if (delta < 0) msgs.push(`\`@You spent ${Math.abs(delta)} gold.`);
    else if (delta > 0) msgs.push(`\`0You find ${delta.toLocaleString()} gold!`);
  }
  if (outcome.goldMult) {
    const g = outcome.goldMult * player.level;
    updates.gold = (updates.gold ?? Number(player.gold)) + g;
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
    if (outcome.gem > 0) msgs.push(`\`0You found ${outcome.gem} gem${outcome.gem > 1 ? 's' : ''}!`);
  }
  if (outcome.charm) {
    updates.charm = player.charm + outcome.charm;
    msgs.push(outcome.charm > 0
      ? `\`#Your charm increased by ${outcome.charm}!`
      : `\`@Your charm decreased by ${Math.abs(outcome.charm)}!`);
  }
  if (outcome.strDelta) {
    updates.strength = player.strength + outcome.strDelta;
    msgs.push(outcome.strDelta > 0
      ? `\`$+${outcome.strDelta} Strength!`
      : `\`@${outcome.strDelta} Strength.`);
  }
  if (outcome.alignDelta) {
    const newAlign = Math.max(-100, Math.min(100, (player.alignment || 0) + outcome.alignDelta));
    updates.alignment = newAlign;
    msgs.push(outcome.alignDelta > 0
      ? `\`0A deed of virtue. Alignment +${outcome.alignDelta}.`
      : `\`@A dark deed. Alignment ${outcome.alignDelta}.`);
  }

  if (outcome.weaponNum) {
    const newWeapon = getWeaponByNum(outcome.weaponNum);
    if (newWeapon && !player.weapon_cursed) {
      const curWeapon = player.weapon_num > 0 ? getWeaponByNum(player.weapon_num) : null;
      if (!curWeapon || newWeapon.strength > curWeapon.strength) {
        const strDelta = newWeapon.strength - (curWeapon ? curWeapon.strength : 0);
        updates.weapon_num  = newWeapon.num;
        updates.weapon_name = newWeapon.name;
        updates.strength    = (updates.strength ?? player.strength) + strDelta;
        msgs.push(`\`$You take up the ${newWeapon.name}!`);
      } else {
        msgs.push(`\`7Your ${curWeapon.name} is already superior — you leave the sword where it stands.`);
      }
    }
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
        ...getLevelUpScreen(player, levelUp.newLevel, levelUp.hpGain, levelUp.strGain, levelUp.perkPoint),
        pendingMessages: msgs,
      });
    }
  }

  return res.json({ ...getTownScreen(player), pendingMessages: msgs });
}

module.exports = { ruins, ruins_choice };
