const { getPlayer, updatePlayer, addNews, getHallOfKings, getRecentNews } = require('../../db');
const { WEAPONS, ARMORS, TOWNS, SHOP_OWNERS, getWeaponByNum, getArmorByNum } = require('../data');
const { checkLevelUp } = require('../newday');
const {
  getTownScreen, getWeaponShopScreen, getArmorShopScreen, getInnScreen,
  getBankScreen, getMasterScreen, getTrainingScreen, getGardenScreen,
  getBardScreen, getNewsScreen, getCharacterScreen, getCrierScreen, getLevelUpScreen,
} = require('../engine');

// ── INN ───────────────────────────────────────────────────────────────────────

async function inn({ player, req, res, pendingMessages }) {
  if (player.quest_id === 'wounded_knight' && player.quest_step >= 1) {
    await updatePlayer(player.id, {
      quest_id: '', quest_step: 0, charm: player.charm + 2,
      exp: Number(player.exp) + 500 * player.level,
      gold: Number(player.gold) + 200 * player.level,
    });
    player = await getPlayer(player.id);
    pendingMessages = [...pendingMessages, `\`0The knight from the forest finds you here! "I kept my promise." He presses ${(200 * player.level).toLocaleString()} gold into your hands. +2 charm, +${(500 * player.level).toLocaleString()} exp!`];
  }
  return res.json({ ...getInnScreen(player), pendingMessages });
}

async function inn_rest({ player, req, res, pendingMessages }) {
  const cost = Math.max(50, Math.floor(player.level * 50 * (player.class === 2 ? 0.9 : 1.0)));
  if (Number(player.gold) < cost)
    return res.json({ ...getInnScreen(player), pendingMessages: [`\`@Not enough gold! Costs ${cost} gold.`] });
  if (player.hit_points >= player.hit_max)
    return res.json({ ...getInnScreen(player), pendingMessages: ['`7You are already at full health!'] });
  await updatePlayer(player.id, { gold: Number(player.gold) - cost, hit_points: player.hit_max });
  player = await getPlayer(player.id);
  return res.json({ ...getInnScreen(player), pendingMessages: ['`0You sleep peacefully and wake fully restored!'] });
}

async function inn_gem({ player, req, res, pendingMessages }) {
  if (player.gems <= 0)
    return res.json({ ...getInnScreen(player), pendingMessages: ['`@You have no gems!'] });
  await updatePlayer(player.id, { gems: player.gems - 1, hit_points: player.hit_max });
  player = await getPlayer(player.id);
  return res.json({ ...getInnScreen(player), pendingMessages: ['`0The gem glows and you are fully healed!'] });
}

async function inn_antidote({ player, req, res, pendingMessages }) {
  if (!player.antidote_owned)
    return res.json({ ...getInnScreen(player), pendingMessages: ['`@You don\'t have an antidote.'] });
  if (!player.poisoned)
    return res.json({ ...getInnScreen(player), pendingMessages: ['`7You are not poisoned.'] });
  await updatePlayer(player.id, { poisoned: 0, antidote_owned: 0 });
  player = await getPlayer(player.id);
  return res.json({ ...getInnScreen(player), pendingMessages: ['`0You drink the antidote. The sickness fades.', '`2You feel yourself again.'] });
}

// ── BANK ──────────────────────────────────────────────────────────────────────

async function bank({ player, req, res, pendingMessages }) {
  return res.json({ ...getBankScreen(player), pendingMessages });
}

async function bank_deposit({ player, param, req, res, pendingMessages }) {
  const amount = Math.max(0, parseInt(param) || 0);
  if (!amount) return res.json({ ...getBankScreen(player), pendingMessages: ['`7No amount specified.'] });
  if (amount > Number(player.gold))
    return res.json({ ...getBankScreen(player), pendingMessages: [`\`@You don't have that much gold!`] });
  await updatePlayer(player.id, { gold: Number(player.gold) - amount, bank: Number(player.bank) + amount });
  player = await getPlayer(player.id);
  return res.json({ ...getBankScreen(player), pendingMessages: [`\`0Deposited \`$${amount.toLocaleString()}\`0 gold.`] });
}

async function bank_withdraw({ player, param, req, res, pendingMessages }) {
  const amount = Math.max(0, parseInt(param) || 0);
  if (!amount) return res.json({ ...getBankScreen(player), pendingMessages: ['`7No amount specified.'] });
  if (amount > Number(player.bank))
    return res.json({ ...getBankScreen(player), pendingMessages: [`\`@You don't have that much in the bank!`] });
  await updatePlayer(player.id, { gold: Number(player.gold) + amount, bank: Number(player.bank) - amount });
  player = await getPlayer(player.id);
  return res.json({ ...getBankScreen(player), pendingMessages: [`\`0Withdrew \`$${amount.toLocaleString()}\`0 gold.`] });
}

// ── MASTER ────────────────────────────────────────────────────────────────────

async function master({ player, req, res, pendingMessages }) {
  if (player.quest_id === 'wounded_knight' && player.quest_step >= 1) {
    await updatePlayer(player.id, {
      quest_id: '', quest_step: 0, charm: player.charm + 2,
      exp: Number(player.exp) + 500 * player.level,
      gold: Number(player.gold) + 200 * player.level,
    });
    player = await getPlayer(player.id);
    pendingMessages = [...pendingMessages, `\`0The knight from the forest finds you here! "I kept my promise." He presses ${(200 * player.level).toLocaleString()} gold into your hands. +2 charm, +${(500 * player.level).toLocaleString()} exp!`];
  }
  return res.json({ ...getMasterScreen(player), pendingMessages });
}

async function master_train({ player, param, req, res, pendingMessages }) {
  const stat = (req.body.inputParam || '').toLowerCase();
  const points = Math.max(1, parseInt(req.body.inputValue || param) || 1);
  const cost = player.level * 75 * points;
  if (!['strength', 'defense'].includes(stat)) return res.json(getMasterScreen(player));
  if (Number(player.gold) < cost)
    return res.json({ ...getMasterScreen(player), pendingMessages: [`\`@Not enough gold! Costs \`$${cost.toLocaleString()}\`@ gold.`] });
  await updatePlayer(player.id, { gold: Number(player.gold) - cost, [stat]: Number(player[stat]) + points });
  player = await getPlayer(player.id);
  return res.json({ ...getMasterScreen(player), pendingMessages: [`\`0Seth nods approvingly. Your ${stat} increased by ${points}!`] });
}

// ── TRAINING ──────────────────────────────────────────────────────────────────

async function training({ player, req, res, pendingMessages }) {
  return res.json({ ...getTrainingScreen(player), pendingMessages });
}

async function training_action({ action, player, req, res, pendingMessages }) {
  const stam = player.stamina ?? player.fights_left ?? 10;
  if (stam <= 0)
    return res.json({ ...getTrainingScreen(player), pendingMessages: ['`@You are too exhausted to train. Drink at the tavern to recover stamina.'] });
  const trainedToday = player.training_today || 0;
  if (trainedToday >= 5)
    return res.json({ ...getTrainingScreen(player), pendingMessages: [`\`7You've already trained five times today. Come back tomorrow.`] });

  const isSpar = action === 'training_spar';
  const expGain = isSpar ? player.level * 20 : player.level * 12;
  const updates = { stamina: stam - 1, training_today: trainedToday + 1, exp: Number(player.exp) + expGain };
  const msgs = [];

  if (isSpar) {
    const sparDmg = 1 + Math.floor(Math.random() * 5);
    updates.hit_points = Math.max(1, player.hit_points - sparDmg);
    msgs.push(`\`7You spar hard with a recruit. They land a few blows — you lose ${sparDmg} HP.`);
    msgs.push(`\`0You gain ${expGain.toLocaleString()} experience from the session!`);
  } else {
    msgs.push('`7You pummel the training dummy until your arms ache.');
    msgs.push(`\`0You gain ${expGain.toLocaleString()} experience from the drill!`);
  }

  await updatePlayer(player.id, updates);
  player = await getPlayer(player.id);

  const lvUp = checkLevelUp(player);
  if (lvUp) {
    await updatePlayer(player.id, lvUp.updates);
    await addNews(`\`$${player.handle}\`% has reached level \`$${lvUp.newLevel}\`%!`);
    player = await getPlayer(player.id);
    msgs.push(`\`$*** You feel stronger! You have advanced to level ${lvUp.newLevel}! ***`);
  }

  return res.json({ ...getTrainingScreen(player), pendingMessages: msgs });
}

// ── SHOPS ─────────────────────────────────────────────────────────────────────

async function weapon_shop({ player, req, res, pendingMessages }) {
  return res.json({ ...getWeaponShopScreen(player), pendingMessages });
}

async function buy_weapon({ player, param, req, res, pendingMessages }) {
  const num = parseInt(param);
  if (!num || num === 0) return res.json(getTownScreen(player));
  const weapon = getWeaponByNum(num);
  if (!weapon) return res.json(getWeaponShopScreen(player));
  const weaponTown = TOWNS[player.current_town || 'dawnmark'] || TOWNS.dawnmark;
  const maxTier = weaponTown.shopMaxTier || 15;
  const owner = SHOP_OWNERS[weaponTown.id] || SHOP_OWNERS.dawnmark;
  if (weapon.tier && weapon.tier > maxTier && player.weapon_num !== weapon.num)
    return res.json({ ...getWeaponShopScreen(player), pendingMessages: ['`@That weapon is not available here. Travel to a larger city.'] });
  if (player.weapon_num === weapon.num)
    return res.json({ ...getWeaponShopScreen(player), pendingMessages: ['`7You already have that weapon.'] });

  // Mirror price calculation from getWeaponShopScreen
  const todayNum = Math.floor(Date.now() / 86400000);
  const eligibleNums = WEAPONS.slice(1).filter(w => w && w.tier <= maxTier).map(w => w.num);
  const dailyDiscountNum = owner.dailyDiscount && eligibleNums.length ? eligibleNums[todayNum % eligibleNums.length] : null;

  let effectiveMult = owner.weaponMult;
  if (owner.tierCap && weapon.tier > owner.tierCap) effectiveMult = 1.0;
  if (owner.fleeDiscount && weapon.bonus === 'flee_bonus') effectiveMult *= 0.85;
  if (owner.poisonGearDiscount && weapon.bonus && weapon.bonusDesc && weapon.bonusDesc.toLowerCase().includes('poison')) effectiveMult *= 0.85;
  if (dailyDiscountNum === weapon.num) effectiveMult *= 0.80;
  const displayPrice = Math.floor(weapon.price * effectiveMult);

  const cur = player.weapon_num > 0 ? getWeaponByNum(player.weapon_num) : null;
  let sellMult = owner.sellMult;
  if (owner.charmBonus && player.charm >= 20) sellMult *= 1.08;
  const tradeIn = cur ? Math.floor(cur.price * sellMult) : 0;
  const netPrice = Math.max(0, displayPrice - tradeIn);

  if (Number(player.gold) < netPrice)
    return res.json({ ...getWeaponShopScreen(player), pendingMessages: [`\`@You can't afford that!`] });

  const newStr = Number(player.strength) - (cur ? cur.strength : 0) + weapon.strength;
  await updatePlayer(player.id, {
    gold: Number(player.gold) - netPrice,
    strength: newStr,
    weapon_num: weapon.num,
    weapon_name: weapon.name,
    forge_weapon_upgraded: 0,
  });
  player = await getPlayer(player.id);
  return res.json({ ...getWeaponShopScreen(player), pendingMessages: [`\`0You purchased a ${weapon.name}!`] });
}

async function armor_shop({ player, req, res, pendingMessages }) {
  return res.json({ ...getArmorShopScreen(player), pendingMessages });
}

async function buy_armor({ player, param, req, res, pendingMessages }) {
  const num = parseInt(param);
  if (!num || num === 0) return res.json(getTownScreen(player));
  const armor = getArmorByNum(num);
  if (!armor) return res.json(getArmorShopScreen(player));
  const armorTown = TOWNS[player.current_town || 'dawnmark'] || TOWNS.dawnmark;
  const maxTier = armorTown.shopMaxTier || 15;
  const owner = SHOP_OWNERS[armorTown.id] || SHOP_OWNERS.dawnmark;
  if (armor.tier && armor.tier > maxTier && player.arm_num !== armor.num)
    return res.json({ ...getArmorShopScreen(player), pendingMessages: ['`@That armour is not available here. Travel to a larger city.'] });
  if (player.arm_num === armor.num)
    return res.json({ ...getArmorShopScreen(player), pendingMessages: ['`7You already have that armour.'] });

  // Mirror price calculation from getArmorShopScreen
  const todayNum = Math.floor(Date.now() / 86400000);
  const eligibleNums = ARMORS.slice(1).filter(a => a && a.tier <= maxTier).map(a => a.num);
  const dailyDiscountNum = owner.dailyDiscount && eligibleNums.length ? eligibleNums[todayNum % eligibleNums.length] : null;

  let effectiveMult = owner.armorMult;
  if (owner.tierCap && armor.tier > owner.tierCap) effectiveMult = 1.0;
  if (owner.fleeDiscount && armor.bonus === 'flee_bonus') effectiveMult *= 0.85;
  if (owner.poisonGearDiscount && armor.bonus === 'poison_resist') effectiveMult *= 0.85;
  if (dailyDiscountNum === armor.num) effectiveMult *= 0.80;
  const displayPrice = Math.floor(armor.price * effectiveMult);

  const cur = player.arm_num > 0 ? getArmorByNum(player.arm_num) : null;
  let sellMult = owner.sellMult;
  if (owner.charmBonus && player.charm >= 20) sellMult *= 1.08;
  const tradeIn = cur ? Math.floor(cur.price * sellMult) : 0;
  const netPrice = Math.max(0, displayPrice - tradeIn);

  if (Number(player.gold) < netPrice)
    return res.json({ ...getArmorShopScreen(player), pendingMessages: [`\`@You can't afford that!`] });

  const newDef = Number(player.defense) - (cur ? cur.defense : 0) + armor.defense;
  await updatePlayer(player.id, {
    gold: Number(player.gold) - netPrice,
    defense: newDef,
    arm_num: armor.num,
    arm_name: armor.name,
    forge_armor_upgraded: 0,
  });
  player = await getPlayer(player.id);
  return res.json({ ...getArmorShopScreen(player), pendingMessages: [`\`0You purchased ${armor.name}!`] });
}

async function shop_steal({ action, player, req, res, pendingMessages }) {
  if (player.class !== 3)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`@Only Thieves can attempt this!'] });

  const stealTown = TOWNS[player.current_town || 'dawnmark'] || TOWNS.dawnmark;
  const stealOwner = SHOP_OWNERS[stealTown.id] || SHOP_OWNERS.dawnmark;
  const isWeapon = action === 'shop_steal_weapon';
  const items = isWeapon ? WEAPONS : ARMORS;
  const currentNum = isWeapon ? player.weapon_num : player.arm_num;
  const nextTierItems = items.filter(w => w && w.tier === (currentNum + 1));

  if (nextTierItems.length === 0) {
    const screen = isWeapon ? getWeaponShopScreen(player) : getArmorShopScreen(player);
    return res.json({ ...screen, pendingMessages: ['`7Nothing worth stealing here.'] });
  }

  const target = nextTierItems[Math.floor(Math.random() * nextTierItems.length)];

  if (Math.random() < 0.20) {
    if (isWeapon) {
      const cur = getWeaponByNum(player.weapon_num);
      const newStr = Number(player.strength) - (cur ? cur.strength : 0) + target.strength;
      await updatePlayer(player.id, { strength: newStr, weapon_num: target.num, weapon_name: target.name });
    } else {
      const cur = getArmorByNum(player.arm_num);
      const newDef = Number(player.defense) - (cur ? cur.defense : 0) + target.defense;
      await updatePlayer(player.id, { defense: newDef, arm_num: target.num, arm_name: target.name });
    }
    player = await getPlayer(player.id);
    const screen = isWeapon ? getWeaponShopScreen(player) : getArmorShopScreen(player);
    await addNews(`\`3${player.handle}\`% quietly liberated a ${target.name} from ${stealOwner.name}'s shop...`);
    return res.json({ ...screen, pendingMessages: [`\`3Smooth. You walk out with a ${target.name}. No one saw a thing.`] });
  } else {
    const penalty = Math.floor(player.hit_max * 0.20);
    await updatePlayer(player.id, { hit_points: Math.max(1, player.hit_points - penalty) });
    player = await getPlayer(player.id);
    const screen = isWeapon ? getWeaponShopScreen(player) : getArmorShopScreen(player);
    return res.json({ ...screen, pendingMessages: [`\`@Caught! The shopkeeper throws you out. You lost ${penalty} HP in the scuffle.`] });
  }
}

// ── GARDEN ────────────────────────────────────────────────────────────────────

async function garden({ player, req, res, pendingMessages }) {
  return res.json({ ...getGardenScreen(player), pendingMessages });
}

async function garden_female({ player, req, res, pendingMessages }) {
  await updatePlayer(player.id, { charm: player.charm + 1, flirted_today: 1 });
  player = await getPlayer(player.id);
  return res.json({ ...getTownScreen(player), pendingMessages: [`\`#Lysa gives you a rose. Your charm is now ${player.charm}!`] });
}

async function garden_flower({ player, req, res, pendingMessages }) {
  await updatePlayer(player.id, { flirted_today: 1 });
  if (Math.random() < 0.3) {
    await updatePlayer(player.id, { charm: player.charm + 1 });
    player = await getPlayer(player.id);
    return res.json({ ...getTownScreen(player), pendingMessages: [`\`#"How sweet of you!" Lysa smiles. Your charm is now ${player.charm}!`] });
  }
  player = await getPlayer(player.id);
  return res.json({ ...getTownScreen(player), pendingMessages: ['`#Lysa blushes and accepts the flower gracefully.'] });
}

async function garden_compliment({ player, req, res, pendingMessages }) {
  await updatePlayer(player.id, { flirted_today: 1 });
  if (player.charm >= 15 && Math.random() < 0.4) {
    await updatePlayer(player.id, { charm: player.charm + 1 });
    player = await getPlayer(player.id);
    return res.json({ ...getTownScreen(player), pendingMessages: [`\`#"Flattery will get you everywhere." Your charm is now ${player.charm}!`] });
  }
  player = await getPlayer(player.id);
  return res.json({ ...getTownScreen(player), pendingMessages: ['`#Lysa raises an eyebrow. "Flattery will get you everywhere."'] });
}

async function garden_kiss({ player, req, res, pendingMessages }) {
  await updatePlayer(player.id, { flirted_today: 1 });
  if (player.charm >= 12 && Math.random() < 0.3) {
    await updatePlayer(player.id, { charm: player.charm + 2, lays: player.lays + 1 });
    player = await getPlayer(player.id);
    return res.json({ ...getTownScreen(player), pendingMessages: [`\`#Lysa leans in and kisses your cheek. Your charm soars! Now ${player.charm}.`] });
  }
  player = await getPlayer(player.id);
  return res.json({ ...getTownScreen(player), pendingMessages: [
    '`#Lysa steps back laughing. "Perhaps when you\'re more... charming."',
    '`7(You need at least 12 charm to have a chance.)',
  ]});
}

// ── BARD / NEWS / CHARACTER / CRIER ───────────────────────────────────────────

async function bard({ player, req, res, pendingMessages }) {
  return res.json({ ...getBardScreen(await getHallOfKings()), pendingMessages });
}

async function news({ player, req, res, pendingMessages }) {
  return res.json({ ...getNewsScreen(await getRecentNews(20)), pendingMessages });
}

async function character({ player, req, res, pendingMessages }) {
  return res.json({ ...getCharacterScreen(player), pendingMessages });
}

async function crier({ player, req, res, pendingMessages }) {
  return res.json({ ...getCrierScreen(player), pendingMessages });
}

async function post_crier({ player, param, req, res, pendingMessages }) {
  const msg = (param || '').trim().substring(0, 60);
  if (!msg) return res.json({ ...getCrierScreen(player), pendingMessages: ['`7No message entered.'] });
  if (Number(player.gold) < 50)
    return res.json({ ...getCrierScreen(player), pendingMessages: ['`@Not enough gold! Town crier costs 50 gold.'] });
  await updatePlayer(player.id, {
    gold: Number(player.gold) - 50,
    crier_message: msg,
    crier_day: Math.floor(Date.now() / 86400000),
  });
  await addNews(`\`6[CRIER]\`% ${player.handle}: "${msg}"`);
  player = await getPlayer(player.id);
  const crierTown = (TOWNS[player.current_town || 'dawnmark'] || TOWNS.dawnmark).name;
  return res.json({ ...getTownScreen(player), pendingMessages: [`\`6The town crier bellows your message across ${crierTown}!`] });
}

module.exports = {
  inn, inn_rest, inn_gem, inn_antidote,
  bank, bank_deposit, bank_withdraw,
  master, master_train,
  training,
  training_fight: training_action,
  training_spar: training_action,
  weapon_shop, buy_weapon,
  shop_steal_weapon: shop_steal,
  armor_shop, buy_armor,
  shop_steal_armor: shop_steal,
  garden, garden_female, garden_flower, garden_compliment, garden_kiss,
  bard, news, character, crier, post_crier,
};
