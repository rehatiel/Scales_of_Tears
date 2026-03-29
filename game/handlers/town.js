const { getPlayer, updatePlayer, addNews, getHallOfKings, getRecentNews, getRetiredPlayersInTown, getActiveWorldEvent, getActiveHunts, getAllPlayers, getNpcMemory, saveNpcMemory, getNpcWorldContext, getNpcDialogueCache } = require('../../db');
const { recordVisit, pickTopic, updateNotes } = require('../npc');
const { WEAPONS, ARMORS, TOWNS, SHOP_OWNERS, getWeaponByNum, getArmorByNum, PERKS, getPerksForClass, hasPerk, SPECIALIZATIONS, getSpecsForClass } = require('../data');
const { checkLevelUp } = require('../newday');
const { getEventDef } = require('../world_events');
const {
  getTownScreen, getMarketScreen, getGatesScreen, getTrainingGroundsScreen, getSocialHallScreen,
  getWeaponShopScreen, getArmorShopScreen, getInnScreen, getInnHealerScreen,
  getHerbalistScreen, getBankScreen, getMasterScreen, getTrainingScreen, getGardenScreen,
  getBardScreen, getNewsScreen, getCharacterScreen, getCharacterGearScreen, getCharacterRecordsScreen, getCharacterFactionsScreen, getCrierScreen, getLevelUpScreen,
  getPerkSelectionScreen, getSpecSelectionScreen,
} = require('../engine');
const {
  parseWounds, healerWoundCost, healerInfectionCost, healerCanTreat,
  herbalistCanTreatWound, herbalistCanTreatInfection, herbalistWoundCost, herbalistInfectionCost,
} = require('../wounds');
const { startAbduction } = require('./abduction');
const { isRefused, adjustReps } = require('../factions');
const { executeQuestChoice } = require('../quest_runner');

// ── INN ───────────────────────────────────────────────────────────────────────

async function inn({ player, req, res, pendingMessages }) {
  const townId = player.current_town || 'dawnmark';
  const [sleeperCount, mem] = await Promise.all([
    getRetiredPlayersInTown(townId),
    getNpcMemory(`innkeeper_${townId}`, player.id),
  ]);
  const updatedMem = recordVisit(mem);
  await saveNpcMemory(`innkeeper_${townId}`, player.id, updatedMem);
  return res.json({ ...getInnScreen(player, sleeperCount, updatedMem), pendingMessages });
}

async function inn_rest({ player, req, res, pendingMessages }) {
  const sleeperCount = await getRetiredPlayersInTown(player.current_town || 'dawnmark');
  const cost = Math.max(50, Math.floor(player.level * 50 * (player.class === 4 ? 0.9 : 1.0)));
  if (Number(player.gold) < cost)
    return res.json({ ...getInnScreen(player, sleeperCount), pendingMessages: [`\`@Not enough gold! Costs ${cost} gold.`] });
  if (player.hit_points >= player.hit_max)
    return res.json({ ...getInnScreen(player, sleeperCount), pendingMessages: ['`7You are already at full health!'] });
  await updatePlayer(player.id, { gold: Number(player.gold) - cost, hit_points: player.hit_max });
  player = await getPlayer(player.id);
  try {
    const { checkSecrets } = require('../secrets');
    const secret = await checkSecrets(player, 'inn');
    if (secret) {
      if (secret.damage > 0) {
        await updatePlayer(player.id, { hit_points: Math.max(1, player.hit_points - secret.damage) });
        player = await getPlayer(player.id);
      }
      return res.json({ ...getInnScreen(player, sleeperCount), pendingMessages: ['`0You sleep peacefully and wake fully restored!', ...secret.lines] });
    }
  } catch { /* non-critical */ }
  return res.json({ ...getInnScreen(player, sleeperCount), pendingMessages: ['`0You sleep peacefully and wake fully restored!'] });
}

async function inn_gem({ player, req, res, pendingMessages }) {
  const sleeperCount = await getRetiredPlayersInTown(player.current_town || 'dawnmark');
  if (player.gems <= 0)
    return res.json({ ...getInnScreen(player, sleeperCount), pendingMessages: ['`@You have no gems!'] });
  await updatePlayer(player.id, { gems: player.gems - 1, hit_points: player.hit_max });
  player = await getPlayer(player.id);
  return res.json({ ...getInnScreen(player, sleeperCount), pendingMessages: ['`0The gem glows and you are fully healed!'] });
}

async function inn_antidote({ player, req, res, pendingMessages }) {
  const sleeperCount = await getRetiredPlayersInTown(player.current_town || 'dawnmark');
  if (!player.antidote_owned)
    return res.json({ ...getInnScreen(player, sleeperCount), pendingMessages: ['`@You don\'t have an antidote.'] });
  if (!player.poisoned)
    return res.json({ ...getInnScreen(player, sleeperCount), pendingMessages: ['`7You are not poisoned.'] });
  await updatePlayer(player.id, { poisoned: 0, antidote_owned: 0 });
  player = await getPlayer(player.id);
  return res.json({ ...getInnScreen(player, sleeperCount), pendingMessages: ['`0You drink the antidote. The sickness fades.', '`2You feel yourself again.'] });
}

async function inn_retire({ player, req, res, pendingMessages }) {
  const sleeperCount = await getRetiredPlayersInTown(player.current_town || 'dawnmark');
  const sleepCost = Math.max(1, sleeperCount + 1);

  if (Number(player.gold) < sleepCost) {
    return res.json({ ...getInnScreen(player, sleeperCount), pendingMessages: [
      `\`@Not enough gold. A room costs ${sleepCost} gold tonight.`,
      '`7Without a room, you\'ll have to take your chances in the tavern.',
    ]});
  }

  const updates = {
    gold: Number(player.gold) - sleepCost,
    retired_today: 1,
    retired_town: player.current_town || 'dawnmark',
  };

  // First sleep of the day: +2 stamina bonus (up to 2× cap)
  if (!player.slept_today) {
    const cap = (player.stamina_max || 10) * 2;
    const current = player.stamina ?? 0;
    const bonus = Math.min(2, cap - current);
    if (bonus > 0) updates.stamina = current + bonus;
    updates.slept_today = true;
  }

  await updatePlayer(player.id, updates);
  player = await getPlayer(player.id);

  // 5% abduction event
  if (Math.random() < 0.05) {
    const { state, screen } = startAbduction(player);
    req.session.abduction = state;
    return res.json({ ...screen, pendingMessages });
  }

  const SLEEP_MESSAGES = [
    'The innkeeper leads you to a quiet room. You pull the blanket over yourself and close your eyes.',
    'The candles gutter out. You sink into a deep sleep, dreaming of the challenges ahead.',
    'The innkeeper snuffs the last lantern. You are already asleep before the door clicks shut.',
    'You stretch out on the straw mattress. Sleep takes you quickly — dreams of fortune and steel.',
    'The fire burns low in the hearth. You drift off. In your dreams, the dragon waits — but so do you.',
    'You sink into the warmest bed you\'ve had in weeks. Your body finally rests.',
  ];
  const sleepMsg = SLEEP_MESSAGES[Math.floor(Math.random() * SLEEP_MESSAGES.length)];

  return res.json({ ...getInnScreen(player, sleeperCount + 1), pendingMessages: [
    `\`8${sleepMsg}`,
    '`2You are sleeping safely at the inn. No one can trouble you here.',
    ...(updates.stamina ? [`\`0The rest restores your strength. (+${Math.min(2, (player.stamina_max||10)*2 - (player.stamina??0))} stamina)`] : []),
    '`8Use [W] Wake Up when you are ready to rise.',
  ]});
}

async function inn_wake({ player, req, res, pendingMessages }) {
  await updatePlayer(player.id, { retired_today: 0, retired_town: '' });
  player = await getPlayer(player.id);
  const sleeperCount = await getRetiredPlayersInTown(player.current_town || 'dawnmark');
  return res.json({ ...getInnScreen(player, sleeperCount), pendingMessages: [
    '`7You awake violently from a deep sleep, shouting something unintelligible.',
    '`8Several other guests glare at you. The innkeeper asks you to keep the noise down.',
  ]});
}

async function inn_healer({ player, req, res, pendingMessages }) {
  const wounds = parseWounds(player);
  const mult = player.active_title === 'undying' ? 2 : 1;
  const woundCost = healerWoundCost(wounds, player.level) * mult;
  const infectionCost = player.infection_type
    ? healerInfectionCost(player.infection_type, player.infection_stage, player.level) * mult
    : 0;
  const msgs = [...pendingMessages];
  if (mult > 1) msgs.push('`@The healer eyes you with unease. "You keep coming back from the dead. I charge double."');
  return res.json({ ...getInnHealerScreen(player, wounds, woundCost, infectionCost), pendingMessages: msgs });
}

async function inn_healer_wounds({ player, req, res, pendingMessages }) {
  const wounds = parseWounds(player);
  const mult = player.active_title === 'undying' ? 2 : 1;
  const cost = healerWoundCost(wounds, player.level) * mult;
  if (!wounds.length)
    return res.json({ ...getInnHealerScreen(player, wounds, 0, 0), pendingMessages: ['`7You have no wounds to treat.'] });
  if (Number(player.gold) < cost) {
    const infCost = player.infection_type ? healerInfectionCost(player.infection_type, player.infection_stage, player.level) * mult : 0;
    return res.json({ ...getInnHealerScreen(player, wounds, cost, infCost), pendingMessages: [`\`@Not enough gold! Treating wounds costs ${cost.toLocaleString()} gold.`] });
  }
  await updatePlayer(player.id, { gold: Number(player.gold) - cost, wounds: '[]' });
  player = await getPlayer(player.id);
  const sleeperCount = await getRetiredPlayersInTown(player.current_town || 'dawnmark');
  return res.json({ ...getInnScreen(player, sleeperCount), pendingMessages: ['`0The healer tends to your wounds carefully. You feel much better!'] });
}

async function inn_healer_infection({ player, req, res, pendingMessages }) {
  if (!player.infection_type || !healerCanTreat(player.infection_type, player.infection_stage) || player.vampire_feasted) {
    const sleeperCount = await getRetiredPlayersInTown(player.current_town || 'dawnmark');
    return res.json({ ...getInnScreen(player, sleeperCount), pendingMessages: ['`7There is nothing to treat.'] });
  }
  const mult = player.active_title === 'undying' ? 2 : 1;
  const cost = healerInfectionCost(player.infection_type, player.infection_stage, player.level) * mult;
  if (Number(player.gold) < cost) {
    const wounds = parseWounds(player);
    const wCost = healerWoundCost(wounds, player.level) * mult;
    return res.json({ ...getInnHealerScreen(player, wounds, wCost, cost), pendingMessages: [`\`@Not enough gold! Treating the infection costs ${cost.toLocaleString()} gold.`] });
  }
  await updatePlayer(player.id, {
    gold: Number(player.gold) - cost,
    infection_type: '',
    infection_stage: 0,
    infection_days: 0,
    vampire_bites: 0,
  });
  player = await getPlayer(player.id);
  const sleeperCount = await getRetiredPlayersInTown(player.current_town || 'dawnmark');
  return res.json({ ...getInnScreen(player, sleeperCount), pendingMessages: ['`0The healer applies poultices and recites an ancient ward. The infection clears!'] });
}

async function inn_use_bandage({ player, req, res, pendingMessages }) {
  const sleeperCount = await getRetiredPlayersInTown(player.current_town || 'dawnmark');
  const wounds = parseWounds(player);
  const slashWounds = wounds.filter(w => w.type === 'slash');
  if (!slashWounds.length || player.bandages <= 0)
    return res.json({ ...getInnScreen(player, sleeperCount), pendingMessages: ['`7No slash wounds to bandage, or no bandages remaining.'] });

  // Treat the most severe slash wound
  const worstIdx = wounds.reduce((best, w, i) =>
    w.type === 'slash' && w.severity > (wounds[best]?.severity ?? 0) ? i : best,
    wounds.findIndex(w => w.type === 'slash'));
  wounds[worstIdx].severity -= 1;
  if (wounds[worstIdx].severity <= 0) wounds.splice(worstIdx, 1);

  await updatePlayer(player.id, { wounds: JSON.stringify(wounds), bandages: player.bandages - 1 });
  player = await getPlayer(player.id);
  return res.json({ ...getInnScreen(player, sleeperCount), pendingMessages: ['`0You carefully bind the wound. It will heal faster now.'] });
}

// ── BANK ──────────────────────────────────────────────────────────────────────

async function bank({ player, req, res, pendingMessages }) {
  try {
    const { checkSecrets } = require('../secrets');
    const secret = await checkSecrets(player, 'bank');
    if (secret) {
      if (secret.damage > 0) {
        await updatePlayer(player.id, { hit_points: Math.max(1, player.hit_points - secret.damage) });
        player = await getPlayer(player.id);
      }
      return res.json({ ...getBankScreen(player), pendingMessages: [...pendingMessages, ...secret.lines] });
    }
  } catch { /* non-critical */ }
  return res.json({ ...getBankScreen(player), pendingMessages });
}

async function bank_deposit({ player, param, req, res, pendingMessages }) {
  const amount = Math.max(0, parseInt(param) || 0);
  if (!amount) return res.json({ ...getBankScreen(player), pendingMessages: ['`7No amount specified.'] });
  if (amount > Number(player.gold))
    return res.json({ ...getBankScreen(player), pendingMessages: [`\`@You don't have that much gold!`] });
  const bankRepUpdates = adjustReps(player, { merchants: 1 });
  await updatePlayer(player.id, { gold: Number(player.gold) - amount, bank: Number(player.bank) + amount, ...bankRepUpdates });
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
  let mem = await getNpcMemory('master_aldric', player.id);
  mem = recordVisit(mem);
  await saveNpcMemory('master_aldric', player.id, mem);
  return res.json({ ...getMasterScreen(player, mem), pendingMessages });
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
  return res.json({ ...getMasterScreen(player), pendingMessages: [`\`0Aldric nods approvingly. Your ${stat} increased by ${points}!`] });
}

// ── TRAINING ──────────────────────────────────────────────────────────────────

async function training({ player, req, res, pendingMessages }) {
  return res.json({ ...getTrainingScreen(player), pendingMessages });
}

async function training_endurance({ player, req, res, pendingMessages }) {
  const current = player.stamina_max || 10;
  if (current >= 15)
    return res.json({ ...getTrainingScreen(player), pendingMessages: ['`7Your endurance is already at its peak. Nothing more can be gained here.'] });
  const cost = current * 2000;
  if (Number(player.gold) < cost)
    return res.json({ ...getTrainingScreen(player), pendingMessages: [`\`@Not enough gold! Expanding endurance costs ${cost.toLocaleString()} gold.`] });
  await updatePlayer(player.id, { gold: Number(player.gold) - cost, stamina_max: current + 1 });
  player = await getPlayer(player.id);
  return res.json({ ...getTrainingScreen(player), pendingMessages: [
    '`$Grimwald drives you through three days of gruelling endurance training.',
    `\`$Your body has adapted. Maximum stamina increased to \`!${player.stamina_max}\`$!`,
  ]});
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
  const townId = player.current_town || 'dawnmark';
  let mem = await getNpcMemory(`weapon_shop_${townId}`, player.id);
  mem = recordVisit(mem);
  await saveNpcMemory(`weapon_shop_${townId}`, player.id, mem);
  return res.json({ ...getWeaponShopScreen(player, mem), pendingMessages });
}

async function buy_weapon({ player, param, req, res, pendingMessages }) {
  const num = parseInt(param);
  if (!num || num === 0) return res.json(getTownScreen(player));
  const weapon = getWeaponByNum(num);
  if (!weapon) return res.json(getWeaponShopScreen(player));
  const weaponTown = TOWNS[player.current_town || 'dawnmark'] || TOWNS.dawnmark;
  const maxTier = weaponTown.shopMaxTier || 15;
  const owner = SHOP_OWNERS[weaponTown.id] || SHOP_OWNERS.dawnmark;
  if (isRefused(player, owner.faction))
    return res.json({ ...getWeaponShopScreen(player), pendingMessages: [`\`@${owner.name} crosses their arms. "I don't do business with your kind. Get out."`] });
  if (weapon.tier && weapon.tier > maxTier && player.weapon_num !== weapon.num)
    return res.json({ ...getWeaponShopScreen(player), pendingMessages: ['`@That weapon is not available here. Travel to a larger city.'] });
  if (player.weapon_num === weapon.num)
    return res.json({ ...getWeaponShopScreen(player), pendingMessages: ['`7You already have that weapon.'] });
  if (player.weapon_cursed)
    return res.json({ ...getWeaponShopScreen(player), pendingMessages: ['`@Your cursed weapon cannot be removed — it is bound to your hand!'] });

  // Mirror price calculation from getWeaponShopScreen
  const todayNum = Math.floor(Date.now() / 86400000);
  const eligibleNums = WEAPONS.slice(1).filter(w => w && w.tier <= maxTier).map(w => w.num);
  const dailyDiscountNum = owner.dailyDiscount && eligibleNums.length ? eligibleNums[todayNum % eligibleNums.length] : null;

  let effectiveMult = owner.weaponMult;
  if (owner.tierCap && weapon.tier > owner.tierCap) effectiveMult = 1.0;
  if (owner.fleeDiscount && weapon.bonus === 'flee_bonus') effectiveMult *= 0.85;
  if (owner.poisonGearDiscount && weapon.bonus && weapon.bonusDesc && weapon.bonusDesc.toLowerCase().includes('poison')) effectiveMult *= 0.85;
  if (dailyDiscountNum === weapon.num) effectiveMult *= 0.80;
  let displayPrice = Math.floor(weapon.price * effectiveMult);

  const activeWorldEvent = await getActiveWorldEvent();
  if (activeWorldEvent) {
    const evDef = getEventDef(activeWorldEvent.type);
    if (evDef?.effects?.shopPriceMult && evDef.effects.shopPriceMult !== 1.0)
      displayPrice = Math.floor(displayPrice * evDef.effects.shopPriceMult);
  }

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
  const townId = player.current_town || 'dawnmark';
  let mem = await getNpcMemory(`armor_shop_${townId}`, player.id);
  mem = recordVisit(mem);
  await saveNpcMemory(`armor_shop_${townId}`, player.id, mem);
  return res.json({ ...getArmorShopScreen(player, mem), pendingMessages });
}

async function buy_armor({ player, param, req, res, pendingMessages }) {
  const num = parseInt(param);
  if (!num || num === 0) return res.json(getTownScreen(player));
  const armor = getArmorByNum(num);
  if (!armor) return res.json(getArmorShopScreen(player));
  const armorTown = TOWNS[player.current_town || 'dawnmark'] || TOWNS.dawnmark;
  const maxTier = armorTown.shopMaxTier || 15;
  const owner = SHOP_OWNERS[armorTown.id] || SHOP_OWNERS.dawnmark;
  if (isRefused(player, owner.faction))
    return res.json({ ...getArmorShopScreen(player), pendingMessages: [`\`@${owner.name} crosses their arms. "I don't do business with your kind. Get out."`] });
  if (armor.tier && armor.tier > maxTier && player.arm_num !== armor.num)
    return res.json({ ...getArmorShopScreen(player), pendingMessages: ['`@That armour is not available here. Travel to a larger city.'] });
  if (player.arm_num === armor.num)
    return res.json({ ...getArmorShopScreen(player), pendingMessages: ['`7You already have that armour.'] });
  if (player.armor_cursed)
    return res.json({ ...getArmorShopScreen(player), pendingMessages: ['`@Your cursed armour cannot be removed — it has fused to your body!'] });

  // Mirror price calculation from getArmorShopScreen
  const todayNum = Math.floor(Date.now() / 86400000);
  const eligibleNums = ARMORS.slice(1).filter(a => a && a.tier <= maxTier).map(a => a.num);
  const dailyDiscountNum = owner.dailyDiscount && eligibleNums.length ? eligibleNums[todayNum % eligibleNums.length] : null;

  let effectiveMult = owner.armorMult;
  if (owner.tierCap && armor.tier > owner.tierCap) effectiveMult = 1.0;
  if (owner.fleeDiscount && armor.bonus === 'flee_bonus') effectiveMult *= 0.85;
  if (owner.poisonGearDiscount && armor.bonus === 'poison_resist') effectiveMult *= 0.85;
  if (dailyDiscountNum === armor.num) effectiveMult *= 0.80;
  let displayPrice = Math.floor(armor.price * effectiveMult);

  const activeWorldEvent = await getActiveWorldEvent();
  if (activeWorldEvent) {
    const evDef = getEventDef(activeWorldEvent.type);
    if (evDef?.effects?.shopPriceMult && evDef.effects.shopPriceMult !== 1.0)
      displayPrice = Math.floor(displayPrice * evDef.effects.shopPriceMult);
  }

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
    const repUpdates = adjustReps(player, { guild: 3, merchants: -5 });
    await updatePlayer(player.id, repUpdates);
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
  let mem = await getNpcMemory('lysa', player.id);
  mem = recordVisit(mem);
  await saveNpcMemory('lysa', player.id, mem);
  const worldCtx = await getNpcWorldContext();
  return res.json({ ...getGardenScreen(player, mem, worldCtx), pendingMessages });
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

// ── GARDEN — Talk ─────────────────────────────────────────────────────────────

async function garden_talk({ player, req, res, pendingMessages }) {
  let mem = await getNpcMemory('lysa', player.id);
  const [worldCtx, dialogueCache] = await Promise.all([getNpcWorldContext(), getNpcDialogueCache()]);
  const { lines, mem: updatedMem } = getLysaDialogue(player, mem, worldCtx, dialogueCache);
  await saveNpcMemory('lysa', player.id, updatedMem);
  return res.json({ ...getGardenScreen(player, updatedMem, worldCtx), pendingMessages: lines });
}

async function garden_respond({ player, param, req, res, pendingMessages }) {
  let mem = await getNpcMemory('lysa', player.id);
  const pending = mem.notes && mem.notes.pending_question;
  if (!pending) return res.json({ ...getGardenScreen(player, mem), pendingMessages });

  const { topic_key, answer_key } = pending;
  const dialogueCache = await getNpcDialogueCache();
  const entry = dialogueCache['lysa'] && dialogueCache['lysa'][topic_key];

  if (!entry) {
    mem = updateNotes(mem, { pending_question: null });
    await saveNpcMemory('lysa', player.id, mem);
    return res.json({ ...getGardenScreen(player, mem), pendingMessages });
  }

  const chosen = (entry.responses || []).find(r => r.key === param);
  if (!chosen) return res.json({ ...getGardenScreen(player, mem), pendingMessages });

  const { storeAnswer } = require('../npc');
  mem = storeAnswer(mem, answer_key, chosen.answer_value);
  mem = updateNotes(mem, { pending_question: null });
  await saveNpcMemory('lysa', player.id, mem);

  const worldCtx = await getNpcWorldContext();
  return res.json({ ...getGardenScreen(player, mem, worldCtx), pendingMessages: chosen.reaction || [] });
}

// ─────────────────────────────────────────────────────────────────────────────
// Lysa dialogue system
// Priority: story overrides → topic pool (by relationship level)
// ─────────────────────────────────────────────────────────────────────────────

// Topic registry — each entry is a function(player, mem, worldCtx) → lines[]
// Organized by minimum relationship level required.
const LYSA_TOPICS = {
  // rel=0 (stranger)
  first_look: (p) => [
    '`#"I don\'t believe I\'ve seen you before."',
    '`%She eyes you briefly — not unkindly — then returns to her work.',
    '`#"The garden is open to anyone who doesn\'t trample things."',
    '`8A pause.',
    '`#"Most people just want the charm bonus. I can tell the difference."',
  ],
  the_garden: (p) => [
    '`#"I planted most of this myself." She gestures at the beds.',
    '`%"It took three years for the roses to take. The soil here is stubborn."',
    '`#"People assume it\'s decorative. But half of this is medicinal."',
    '`%She holds up a sprig of something pale and sharp-smelling.',
    '`#"You\'d be surprised what a garden can tell you about a place."',
  ],
  what_brings_you: (p) => [
    '`#She studies you with more attention than she lets on.',
    '`%"Most adventurers who come through here are on their way somewhere."',
    '`#"You have that look." A pause. "The one where you\'ve decided something."',
    '`%She snips a dead branch.',
    '`#"I won\'t ask where. But I notice things."',
  ],

  // rel=1 (acquaintance)
  noticed_you: (p) => [
    '`#"You\'ve been back." Not a question. "I notice who comes and goes."',
    '`%"Most adventurers pass through once and you never see them again."',
    '`#She tilts her head slightly.',
    '`8"I find myself wondering what keeps bringing you here."',
    '`%"That\'s unusual for me."',
  ],
  class_remark: (p) => {
    const lines = {
      1:  ['`#"Dread Knight. I can always tell — the way you carry tension in your shoulders."', '`%"The class isn\'t the person. But it leaves marks."', '`#"You look like someone who\'s made decisions they live with."'],
      2:  ['`#"There\'s something quiet about real warriors."', '`%"They\'ve made peace with what they do. Or they\'re trying to."', '`8"Which are you, I wonder."'],
      3:  ['`#"A Rogue." A small smile. "The careful ones always check the exits first."', '`%"You did that when you came in. I noticed."', '`#"It\'s not a criticism. It\'s just a way of moving through the world."'],
      4:  ['`#"Mage." She says it thoughtfully. "The practical ones are my favourites."', '`%"The theatrical ones..." A small gesture. "Less so."', '`#"You seem like one of the practical ones."'],
      5:  ['`#"Rangers tend to look at the sky when they think no one\'s watching."', '`%She glances up deliberately.', '`#"You\'ve been doing it since you walked in."'],
      6:  ['`#"A Paladin. You have the look — measuring everything against a standard."', '`%"I respect it. Even when the standard is wrong."', '`8"Especially then, maybe."'],
      7:  ['`#"Druids and gardens." A genuine smile. "You\'re not the first to linger here."', '`%"There\'s something about people who pay attention to growing things."', '`#"I think it\'s the patience."'],
      8:  ['`#"Necromancer." She considers this without flinching.', '`%"People assume that\'s a dark thing. But death and life aren\'t opposites."', '`#"Gardeners know that better than most."'],
      9:  ['`#"Elementalist." She glances at your hands. "You\'re good at holding still."', '`%"Most people who work with raw force can\'t."', '`#"That takes practice. Or very good teachers."'],
      10: ['`#"A Monk." A moment of consideration. "You\'re harder to read than most."', '`%"I appreciate that. Easy-to-read people usually aren\'t paying attention."', '`#"You\'re paying attention."'],
    };
    return lines[p.class] || lines[1];
  },
  the_road: (p) => [
    '`#"You\'ve been travelling." She says it with certainty.',
    '`%"There\'s a tiredness that only the road gives you."',
    '`#"Not unpleasant, exactly. But it accumulates."',
    '`%She pauses.',
    '`#"Do you know why you keep going? Or is it just what you do now?"',
    '`8She means it as a real question. She doesn\'t need an answer.',
  ],
  garden_meaning_hint: (p) => [
    '`#"People assume the garden is my job." She snips carefully at a stem.',
    '`%"It\'s not. Or it is — but that\'s not why I do it."',
    '`#"This place was..." She trails off. Starts again.',
    '`8"There was a reason I chose here. I don\'t talk about it with most people."',
    '`#"Maybe another time."',
  ],
  world_question: (p, m, w) => {
    const enemy = w && w.namedEnemies && w.namedEnemies.length > 0 ? w.namedEnemies[0] : null;
    if (enemy) return [
      `\`#"I\'ve been hearing things." She doesn\'t look up. "About something in the wilderness."`,
      `\`%"${enemy.given_name}${enemy.title ? ', ' + enemy.title : ''}. That\'s the name I\'ve heard."`,
      `\`#"Two travellers last week mentioned it. The crier as well."`,
      `\`%She clips a dead head from a rose with more force than necessary.`,
      `\`8"Is it as bad as they say?"`,
    ];
    return [
      '`#"What\'s it like out there right now?" She asks it without ceremony.',
      '`%"I hear things. But always through other people."',
      '`#"The news is always someone\'s version of events."',
      '`%A pause.',
      '`#"What\'s your version?"',
    ];
  },

  // rel=2 (regular)
  opinion_fighters: (p) => [
    '`#"Can I ask you something?" She sets down her shears.',
    '`%"What actually drives fighters — the ones who keep going?"',
    '`#"I\'ve had years to watch them come through here. I still don\'t have a clean answer."',
    '`%She looks at you directly.',
    '`#"Some are running from something. Some are looking for it."',
    '`8"You don\'t have to tell me which you are."',
  ],
  cross_player_ref: (p, m, w) => {
    const slayer = w && w.recentSlayers && w.recentSlayers.find(s => s.handle !== p.handle);
    const top = w && w.topPlayer && w.topPlayer.handle !== p.handle ? w.topPlayer : null;
    const enemy = w && w.namedEnemies && w.namedEnemies.find(e => e.kills >= 2 && e.given_name !== p.handle);
    if (slayer) return [
      `\`#"${slayer.handle} came through here after the dragon." She says it quietly.`,
      `\`%"Didn\'t stay long. They had the look of someone who\'d just finished something."`,
      `\`#"And now didn\'t know what to do with the quiet."`,
      `\`%She works in silence a moment.`,
      `\`8"I recognised it. I\'ve had that look."`,
    ];
    if (enemy) return [
      `\`#"${enemy.given_name}." She says the name carefully.`,
      `\`%"That\'s killed ${enemy.kills} people now. The forest keeps score even when we don\'t."`,
      `\`#"I lit a candle last week. Old habit." A pause.`,
      `\`8"I don\'t know who they were. But someone does."`,
    ];
    if (top) return [
      `\`#"${top.handle}." She tries the name. "People keep mentioning them."`,
      `\`%"Strength they can point at. Proof the struggle means something."`,
      `\`#"I find myself more interested in what they\'re like when no one\'s watching."`,
    ];
    return [
      '`#"More adventurers passing through lately." She looks pensive.',
      '`%"Something\'s drawing them. Or pushing them."',
      '`8"I can\'t always tell which."',
    ];
  },
  named_enemy_concern: (p, m, w) => {
    const enemy = w && w.namedEnemies && w.namedEnemies.find(e => e.kills > 0);
    if (enemy) return [
      `\`#"${enemy.given_name}." She says it quietly. "I keep hearing that name."`,
      `\`%"${enemy.kills} ${enemy.kills === 1 ? 'person' : 'people'} now, if the news is right."`,
      `\`#"The forest always had its horrors. But this one feels different."`,
      `\`%She looks at her roses with a strange expression.`,
      `\`8"Gardens grow over graves. That\'s the whole thing, really."`,
    ];
    return [
      '`#"The forest has been strange lately. I can tell by who comes back through here."',
      '`%"There\'s a quiet that falls on someone after a bad fight."',
      '`#"I used to ask about it. Now I just..." She gestures at the garden.',
      '`8"Make tea. Tend things."',
    ];
  },
  asks_why_fight: (p) => [
    '`#"I want to ask you something. You don\'t have to answer."',
    '`%She sets down her shears. Direct eye contact — unusual for her.',
    '`#"Why do you keep fighting? Not the surface answer."',
    '`%"Not \'for gold\' or \'it\'s what I do.\' The real one."',
    '`#"The one you think about in the quiet."',
    '`8She lets the question sit there. Returns to her plants.',
  ],
  she_used_to_travel: (p) => [
    '`#"I used to travel." She says it simply.',
    '`%"Years ago. Before I found this place."',
    '`#"I was good at it. The resilience, the adaptation."',
    '`%A small pause.',
    '`#"I wasn\'t good at the loneliness."',
    '`8"So I stopped." She clips a stem.',
    '`%"Not everyone has to keep going. That took me a while to understand."',
  ],
  on_alignment: (p) => {
    if ((p.alignment || 0) <= -20) return [
      '`#She doesn\'t say anything for a moment when you walk in.',
      '`%Then, carefully: "You\'ve made some choices lately."',
      '`#"I\'m not judging. I stopped judging." She clips a stem.',
      '`%"But choices have shapes. They leave traces."',
      '`8"Yours have been getting darker. I notice. I won\'t say it twice."',
    ];
    if ((p.alignment || 0) >= 30) return [
      '`#"You\'ve been doing good work." She says it without fanfare.',
      '`%"I hear things. The news, the people who come through here."',
      '`#"What you\'ve been doing — it\'s not going unnoticed."',
      '`8"Even when it feels like it is."',
    ];
    return [
      '`#"You\'re careful." She says it thoughtfully. "Not cruel. Not righteous, exactly."',
      '`%"Just careful."',
      '`#"That\'s rarer than people think."',
      '`8"Most fall one way or the other, eventually."',
    ];
  },
  faction_observation: (p) => {
    if ((p.rep_knights || 0) >= 50) return [
      '`#"I see Silverkeep in you." Not a compliment or a criticism.',
      '`%"The Knights leave a mark. Posture. The way you watch the door."',
      '`#"There are worse things to be. Just..." She pauses.',
      '`#"Don\'t let them make you rigid. The realm needs people who can still bend."',
    ];
    if ((p.rep_druids || 0) >= 50) return [
      '`#"Thornreach has left its mark on you." She sounds approving.',
      '`%"You move differently. Quieter. Like you\'ve learned to listen."',
      '`#"The Circle doesn\'t give that to just anyone."',
      '`8"I used to go to the Grove. Before I found this place."',
    ];
    if ((p.rep_necromancers || 0) >= 50) return [
      '`#She looks at you a long moment before speaking.',
      '`8"I\'ve noticed you and the Conclave."',
      '`#"I won\'t pretend I understand it. Death magic has always unsettled me."',
      '`%"But you\'re here, talking to flowers." A slight smile.',
      '`#"Maybe that\'s the point. Everyone contains more than one thing."',
    ];
    if ((p.rep_guild || 0) >= 50) return [
      '`#"Careful with those friends." She says it lightly, but means it.',
      '`7"The Guild remembers debts longer than kindnesses."',
      '`#"Know what you owe, and to whom."',
      '`8"That\'s the only way to stay ahead of them."',
    ];
    return [
      '`#"Every faction in this realm thinks it\'s the important one." She clips a stem.',
      '`%"I\'ve met people from all of them. The true believers and the mercenaries."',
      '`#"The ones I respect are the ones who know which they are."',
    ];
  },

  // rel=3 (trusted)
  garden_origin: (p) => [
    '`#"Can I tell you something?" She sits on the low wall — unusual for her.',
    '`%"I came here because of a specific thing. Not just wandering."',
    '`#"There was a woman who had this garden before me. She died here."',
    '`%A pause.',
    '`#"She left notes in the shed. Recipes. A name carved into the door frame."',
    '`8"I didn\'t know her. But I felt like I owed it to her to keep it alive."',
    '`%"That was nine years ago." She looks at the roses.',
    '`#"I\'m still not sure what that says about me."',
  ],
  druid_past: (p) => [
    '`#"I spent two years with the Circle in Thornreach." She says it quietly.',
    '`%"It wasn\'t what I expected."',
    '`#"They don\'t talk about themselves the way other orders do."',
    '`%"No glory. No hierarchy." A pause.',
    '`#"Just attention. To small things. To what\'s actually there."',
    '`8"I brought that back with me." She gestures at the garden.',
    '`#"That\'s what this is, really. Sustained attention."',
  ],
  veilborn_knowledge: (p) => [
    '`#"I have a confession." She doesn\'t look up.',
    '`%"I\'ve been researching the old texts. The ones about what was sealed here."',
    '`#"Most people think the Dragon was just a monster."',
    '`%She finally meets your eyes.',
    '`8"It wasn\'t. Or it was — but that\'s not what it was *for*."',
    '`#"Something needed to stay down. The Dragon was keeping it there."',
    '`%She sets down her shears.',
    '`#"I don\'t know how much you know. I just think you should know someone else does."',
  ],
  what_she_wants: (p) => [
    '`#She works in silence for a while before speaking.',
    '`%"Do you know what I actually want? Not what I\'ve settled for."',
    '`#"I want to write something. Not a garden journal."',
    '`%"Something true. About this place. About what passes through here."',
    '`#"The people. The things they carry."',
    '`8A long pause.',
    '`#"I haven\'t started yet." She clips a stem.',
    '`%"I keep waiting until I have something worth saying."',
    '`8"I think that\'s the wrong approach, honestly."',
  ],
  the_quiet: (p) => [
    '`8She looks at you — a longer look than usual.',
    '`#"Can I say something strange?"',
    '`%"When you\'re not here... the garden feels emptier than it used to."',
    '`#"I\'ve had regulars before. But you actually listen."',
    '`%A pause.',
    '`8"That\'s rarer than you\'d think."',
    '`#"I wanted you to know that." She turns back to her work.',
    '`%"You don\'t have to do anything about it."',
  ],

  // rel=4 (confidant)
  full_honesty: (p) => [
    '`#"I\'m going to be honest with you." She sets down her shears.',
    '`%"I\'ve been thinking about what this place actually is."',
    '`#"I tell people it\'s a garden. That\'s true. But it\'s also a refuge."',
    '`%"For people who need somewhere quiet for a minute."',
    '`#"Including me." A pause.',
    '`8"Especially me."',
    '`%"I built it to be that. I just didn\'t know that was what I was doing."',
    '`#"Until people like you started coming back."',
  ],
  the_thing_she_fears: (p) => [
    '`#"I have a fear." She says it plainly. "Not of combat or death."',
    '`%"I fear being forgotten. Not dramatically. Just gradually."',
    '`#"The garden will outlast me. That\'s fine. That\'s good."',
    '`%"But the garden won\'t remember anything."',
    '`8A pause. She clips a bloom.',
    '`#"That\'s why I write things down. Even the small things."',
    '`%"You wonder why I asked you that question, months ago?"',
    '`#"That was me writing something down."',
  ],
  she_asks_after_you: (p) => [
    '`#"I was wondering if you\'d come back." She says it quietly.',
    '`%"You were gone a while."',
    '`#"I don\'t ask about the fighting. I\'ve learned it doesn\'t help."',
    '`%"But I wondered."',
    '`8She hands you a small bundle of dried herbs tied with twine.',
    '`#"For whatever\'s next." A pause.',
    '`%"Come back when you can."',
  ],
  the_question_back: (p, m) => [
    '`#She looks at you for a long moment.',
    '`%"You\'ve never actually told me why you keep at it."',
    '`#"I\'ve asked, in my way. You\'ve deflected, in your way."',
    '`%"I don\'t mind. But I notice."',
    '`8A pause.',
    '`#"One day, maybe, you\'ll tell me."',
    '`%She returns to her roses. Not disappointed. Just patient.',
  ],
};

// Topic pool per minimum relationship level
const LYSA_TOPIC_POOLS = [
  { minRel: 0, topics: ['first_look', 'the_garden', 'what_brings_you'] },
  { minRel: 1, topics: ['noticed_you', 'class_remark', 'the_road', 'garden_meaning_hint', 'world_question'] },
  { minRel: 2, topics: ['opinion_fighters', 'cross_player_ref', 'named_enemy_concern', 'asks_why_fight', 'she_used_to_travel', 'on_alignment', 'faction_observation'] },
  { minRel: 3, topics: ['garden_origin', 'druid_past', 'veilborn_knowledge', 'what_she_wants', 'the_quiet'] },
  { minRel: 4, topics: ['full_honesty', 'the_thing_she_fears', 'she_asks_after_you', 'the_question_back'] },
];

function getLysaDialogue(player, mem, worldCtx, dialogueCache = null) {
  const title   = player.active_title || '';
  const align   = player.alignment   || 0;
  const questId = player.quest_id    || '';
  const rel     = mem.relationship_level || 0;

  // ── Story overrides (don't consume a topic) ──────────────────────────────
  if (title === 'wardens_champion') {
    return { lines: [
      '`#Lysa looks up slowly when you enter. Something different in her eyes.',
      '`#"I felt something shift. Three nights ago." She sets down her shears.',
      '`#"Like a held breath finally released."',
      '`%"The Veilborn is gone, isn\'t it."',
      '`8It isn\'t a question.',
      '`#"There are old texts — most destroyed — that described what was sealed beneath the realm."',
      '`#"I spent years trying to find them. Couldn\'t understand why I cared so much."',
      '`%A long silence. She looks at you steadily.',
      '`#"Thank you. I don\'t think you fully understand what you\'ve actually done."',
    ], mem };
  }

  if (title === 'dragonslayer' && questId !== 'warden_fall' && rel < 3) {
    return { lines: [
      '`#"I know who you are." She doesn\'t look up from her pruning.',
      '`#"The Dragonslayer. Everyone\'s saying it in the market."',
      '`%She clips a stem with more force than necessary.',
      '`#"I\'ve read about the Dragon. The old texts — what survived."',
      '`%She finally looks at you. Her expression is careful.',
      '`#"It wasn\'t just a monster, was it."',
      '`8Again, not a question.',
      '`#"Something is going to come through now. I hope you\'re as capable as they say."',
    ], mem };
  }

  if (questId === 'warden_fall' && (player.quest_step || 0) >= 3) {
    return { lines: [
      '`#"You look like someone carrying weight they can\'t set down."',
      '`%She wraps a small bundle of dried herbs and holds it out.',
      '`#"For clarity of mind. Old druid recipe. Don\'t ask how I know it."',
      '`%You take it. She hesitates.',
      '`#"The Seal wasn\'t just a prison. It was also a warning."',
      '`%She turns back to her work.',
      '`8"Be careful what you\'re opening."',
    ], mem };
  }

  if (align <= -40) {
    return { lines: [
      '`#She looks up when you enter. Something in her expression closes — not fear.',
      '`%Watchfulness.',
      '`#"The garden is open to all. That\'s the rule."',
      '`%She returns to her work. A long pause.',
      '`8"You have interesting eyes, for someone who\'s done what you\'ve done."',
      '`#"I\'m not judging. Good and evil aren\'t that tidy."',
      '`%"Just... try not to break anything in here."',
    ], mem };
  }

  // ── Topic pool system ─────────────────────────────────────────────────────
  // Build the available pool for this relationship level
  const available = LYSA_TOPIC_POOLS
    .filter(p => p.minRel <= rel)
    .flatMap(p => p.topics);

  const { topic, mem: memAfterPick } = pickTopic(mem, available);
  const fn = topic && LYSA_TOPICS[topic];
  const lines = fn ? fn(player, memAfterPick, worldCtx) : [
    '`#She looks up from the flower bed and studies you for a moment.',
    '`#"You know, most people who come through here want something specific."',
    '`%"Someone to look at them like they matter."',
    '`%She tilts her head.',
    '`8"What is it you actually want?"',
    '`%She doesn\'t wait for an answer. Returns to her work. Smiling slightly.',
  ];

  // Check if this topic has interactive responses in the DB
  let finalMem = memAfterPick;
  if (topic && dialogueCache) {
    const entry = dialogueCache['lysa'] && dialogueCache['lysa'][topic];
    if (entry && entry.responses && entry.responses.length > 0) {
      // Store pending question — choices (key+label only) baked in so screen stays sync
      const choices = entry.responses.map(r => ({ key: r.key, label: r.label }));
      finalMem = updateNotes(memAfterPick, {
        pending_question: { topic_key: topic, answer_key: entry.answer_key, choices },
      });
    }
  }

  return { lines, mem: finalMem };
}

// ── PLAYERS LIST ─────────────────────────────────────────────────────────────

async function players({ player, req, res, pendingMessages }) {
  const all = await getAllPlayers();
  const c = { yellow: '`$', white: '`%', gray: '`7', dgray: '`8', red: '`@', cyan: '`!', green: '`0', magenta: '`#' };
  const lines = [
    `${c.dgray}  ══════════════════════════════════════`,
    `${c.yellow}        ADVENTURERS OF THE REALM`,
    `${c.dgray}  ══════════════════════════════════════`,
    '',
  ];
  if (all.length === 0) {
    lines.push(`${c.dgray}  No other adventurers found.`);
  } else {
    all.forEach(p => {
      const titlePart = p.active_title ? `${c.dgray}, ${c.yellow}${p.active_title}` : '';
      const deadPart  = p.dead         ? ` ${c.red}[DEAD]` : '';
      lines.push(`${c.gray}  ${c.white}${p.handle}${titlePart}${c.gray}  Lv ${c.yellow}${p.level}${deadPart}`);
    });
  }
  lines.push('');
  lines.push(`${c.yellow}  [L]${c.white} Return to Town`);
  return res.json({ screen: 'players', title: 'Other Players', lines, choices: [{ key: 'L', label: 'Return', action: 'town' }], pendingMessages });
}

// ── BARD / NEWS / CHARACTER / CRIER ───────────────────────────────────────────

async function bard({ player, req, res, pendingMessages }) {
  const [hallOfKings, worldCtx] = await Promise.all([getHallOfKings(), getNpcWorldContext()]);
  return res.json({ ...getBardScreen(hallOfKings, worldCtx, player), pendingMessages });
}

async function news({ player, req, res, pendingMessages }) {
  const [newsList, hunts] = await Promise.all([getRecentNews(20), getActiveHunts()]);
  return res.json({ ...getNewsScreen(newsList, hunts), pendingMessages });
}

async function character({ player, req, res, pendingMessages }) {
  return res.json({ ...getCharacterScreen(player), pendingMessages });
}

async function character_gear({ player, res, pendingMessages }) {
  return res.json({ ...getCharacterGearScreen(player), pendingMessages });
}

async function character_records({ player, res, pendingMessages }) {
  return res.json({ ...getCharacterRecordsScreen(player), pendingMessages });
}

async function character_factions({ player, res, pendingMessages }) {
  return res.json({ ...getCharacterFactionsScreen(player), pendingMessages });
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

// ── HERBALIST ─────────────────────────────────────────────────────────────────

async function herbalist({ player, req, res, pendingMessages }) {
  const townId = player.current_town || 'dawnmark';
  const wounds = parseWounds(player);
  const treatableWounds = wounds.filter(herbalistCanTreatWound).sort((a, b) => b.severity - a.severity);
  const worstTreatable   = treatableWounds[0] || null;
  const woundCost        = worstTreatable ? herbalistWoundCost(worstTreatable, player.level) : 0;
  const infTreatable     = herbalistCanTreatInfection(player.infection_type, player.infection_stage || 0);
  const infCost          = infTreatable ? herbalistInfectionCost(player.infection_type, player.infection_stage || 0, player.level) : 0;
  let mem = await getNpcMemory(`herbalist_${townId}`, player.id);
  // track total wounds treated over lifetime (for dialogue)
  const hadWoundsThisVisit = wounds.length > 0 || !!player.infection_type;
  if (hadWoundsThisVisit) {
    mem = updateNotes(mem, { ever_injured: true });
  }
  mem = recordVisit(mem);
  await saveNpcMemory(`herbalist_${townId}`, player.id, mem);
  return res.json({ ...getHerbalistScreen(player, wounds, treatableWounds, infTreatable, woundCost, infCost, mem), pendingMessages });
}

async function herbalist_wound({ player, req, res, pendingMessages }) {
  if ((player.herbalist_today || 0) >= 3)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`8Mira shakes her head. "I\'ve done what I can for you today. Come back tomorrow."'] });

  const wounds = parseWounds(player);
  const treatableWounds = wounds.filter(herbalistCanTreatWound).sort((a, b) => b.severity - a.severity);
  if (!treatableWounds.length)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`7You have no wounds the herbalist can treat.'] });

  const worst = treatableWounds[0];
  const cost  = herbalistWoundCost(worst, player.level);
  if (Number(player.gold) < cost)
    return res.json({ ...getTownScreen(player), pendingMessages: [`\`@Not enough gold! Treatment costs ${cost.toLocaleString()} gold.`] });

  // Reduce the worst treatable wound by one tier, remove if healed
  const idx = wounds.indexOf(worst);
  wounds[idx] = { ...worst, severity: worst.severity - 1 };
  const newWounds = wounds.filter(w => w.severity > 0);

  await updatePlayer(player.id, {
    gold: Number(player.gold) - cost,
    wounds: JSON.stringify(newWounds),
    herbalist_today: (player.herbalist_today || 0) + 1,
  });
  player = await getPlayer(player.id);

  const msgs = ['`2Mira cleans the wound carefully and packs it with a poultice of honey and yarrow.'];
  if (worst.severity === 1) msgs.push('`0The scratch is clean and bound. It should heal on its own now.');
  else msgs.push('`2The wound is better — though not gone. Rest will finish the work.');

  const updatedWounds = parseWounds(player);
  const treatableLeft = updatedWounds.filter(herbalistCanTreatWound);
  const infTreatable  = herbalistCanTreatInfection(player.infection_type, player.infection_stage || 0);
  const woundCost2    = treatableLeft[0] ? herbalistWoundCost(treatableLeft[0], player.level) : 0;
  const infCost2      = infTreatable ? herbalistInfectionCost(player.infection_type, player.infection_stage || 0, player.level) : 0;
  return res.json({ ...getHerbalistScreen(player, updatedWounds, treatableLeft, infTreatable, woundCost2, infCost2), pendingMessages: msgs });
}

async function herbalist_infection({ player, req, res, pendingMessages }) {
  if ((player.herbalist_today || 0) >= 3)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`8Mira shakes her head. "I\'ve done what I can for you today. Come back tomorrow."'] });

  if (!herbalistCanTreatInfection(player.infection_type, player.infection_stage || 0))
    return res.json({ ...getTownScreen(player), pendingMessages: ['`7Mira cannot treat this affliction.'] });

  const cost = herbalistInfectionCost(player.infection_type, player.infection_stage || 0, player.level);
  if (Number(player.gold) < cost)
    return res.json({ ...getTownScreen(player), pendingMessages: [`\`@Not enough gold! Treatment costs ${cost.toLocaleString()} gold.`] });

  const typeLabel = player.infection_type === 'rot' ? 'festering' : 'fever-sickness';
  const msgs = [
    `\`2Mira brews a tea of ${player.infection_type === 'rabies' ? 'wolfsbane root and willow bark' : 'garlic, honey, and thyme'}.`,
    `\`2"Drink all of it. Don't make a face."`,
    `\`0The ${typeLabel} in the wound begins to calm.`,
  ];

  await updatePlayer(player.id, {
    gold: Number(player.gold) - cost,
    infection_type: '',
    infection_stage: 0,
    infection_days: 0,
    herbalist_today: (player.herbalist_today || 0) + 1,
  });
  player = await getPlayer(player.id);
  return res.json({ ...getTownScreen(player), pendingMessages: msgs });
}

// ── PERKS ─────────────────────────────────────────────────────────────────────

async function perk_select({ player, req, res, pendingMessages }) {
  if ((player.perk_points || 0) <= 0)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`7You have no perk points to spend.'] });
  return res.json({ ...getPerkSelectionScreen(player), pendingMessages });
}

async function choose_perk({ player, param, req, res, pendingMessages }) {
  if ((player.perk_points || 0) <= 0)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`7You have no perk points to spend.'] });

  const perkId = param;
  const perk = PERKS[perkId];
  if (!perk) return res.json({ ...getPerkSelectionScreen(player), pendingMessages: ['`@Unknown perk.'] });

  // Validate class ownership
  const classPerks = getPerksForClass(player.class);
  if (!classPerks.some(p => p.id === perkId))
    return res.json({ ...getPerkSelectionScreen(player), pendingMessages: ['`@That perk is not available for your class.'] });

  // Prevent duplicate picks
  if (hasPerk(player, perkId))
    return res.json({ ...getPerkSelectionScreen(player), pendingMessages: ['`@You have already mastered that perk.'] });

  const currentPerks = (() => { try { return JSON.parse(player.perks || '[]'); } catch { return []; } })();
  const updates = {
    perks: JSON.stringify([...currentPerks, perkId]),
    perk_points: (player.perk_points || 0) - 1,
  };

  // Apply immediate stat bonuses
  if (perk.effect === 'hp_bonus' || perk.effect === 'shapeshift') {
    updates.hit_max    = player.hit_max + perk.value;
    updates.hit_points = Math.min(player.hit_max + perk.value, player.hit_points + perk.value);
  }
  if (perk.effect === 'def_bonus') {
    updates.defense = player.defense + perk.value;
  }
  if (perk.effect === 'str_bonus') {
    updates.strength = player.strength + perk.value;
  }

  await updatePlayer(player.id, updates);
  player = await getPlayer(player.id);

  const msgs = [
    `\`$You have mastered \`!\`${perk.name}\`$!`,
    `\`%${perk.desc}`,
  ];
  if (updates.perk_points > 0) msgs.push(`\`7You have \`$${updates.perk_points}\`7 perk point(s) remaining — visit Perks to spend them.`);

  return res.json({ ...getTownScreen(player), pendingMessages: [...pendingMessages, ...msgs] });
}

// ── SPECIALISATION ────────────────────────────────────────────────────────────

async function spec_select({ player, req, res, pendingMessages }) {
  if (!player.spec_pending)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`7You have no specialisation to choose.'] });
  return res.json({ ...getSpecSelectionScreen(player), pendingMessages });
}

async function choose_spec({ player, param, req, res, pendingMessages }) {
  if (!player.spec_pending)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`7You have no specialisation to choose.'] });
  if (player.specialization)
    return res.json({ ...getTownScreen(player), pendingMessages: ['`@You have already chosen a specialisation.'] });

  const specId = param;
  const spec = SPECIALIZATIONS[specId];
  if (!spec) return res.json({ ...getSpecSelectionScreen(player), pendingMessages: ['`@Unknown specialisation.'] });

  const classSpecs = getSpecsForClass(player.class);
  if (!classSpecs.some(s => s.id === specId))
    return res.json({ ...getSpecSelectionScreen(player), pendingMessages: ['`@That specialisation is not available for your class.'] });

  const updates = { specialization: specId, spec_pending: false };

  // Immediate stat bonuses
  if (spec.effect === 'def_bonus') updates.defense   = player.defense   + spec.value;
  if (spec.effect === 'str_bonus') updates.strength  = player.strength  + spec.value;
  if (spec.effect === 'hp_bonus') {
    updates.hit_max    = player.hit_max    + spec.value;
    updates.hit_points = Math.min(player.hit_max + spec.value, player.hit_points + spec.value);
  }

  await updatePlayer(player.id, updates);
  player = await getPlayer(player.id);

  const msgs = [
    `\`!You have chosen the path of \`$${spec.name}\`!!`,
    `\`%${spec.desc}`,
    `\`7Your specialisation is permanent — embrace your path.`,
  ];

  return res.json({ ...getTownScreen(player), pendingMessages: [...pendingMessages, ...msgs] });
}

// ── QUEST HANDLERS ─────────────────────────────────────────────────────────────

async function merchant_help({ player, req, res, pendingMessages }) {
  if (player.quest_id !== 'missing_merchant') return res.json({ ...getTownScreen(player), pendingMessages });
  const expReward  = 500 * player.level;
  const alignGain  = 15;
  const repUpdates = { rep_knights: Math.min(100, (player.rep_knights || 0) + 3), rep_merchants: Math.min(100, (player.rep_merchants || 0) + 2) };
  await updatePlayer(player.id, {
    quest_id: '', quest_step: 0, quest_data: '',
    charm: player.charm + 3,
    exp:   Number(player.exp) + expReward,
    alignment: Math.min(100, (player.alignment || 0) + alignGain),
    ...repUpdates,
  });
  player = await getPlayer(player.id);
  await addNews(`\`0${player.handle}\`% rescued a missing merchant on the road!`);
  const levelUp = checkLevelUp(player);
  if (levelUp) {
    await updatePlayer(player.id, levelUp.updates);
    player = await getPlayer(player.id);
    await addNews(`\`$${player.handle}\`% has advanced to level \`$${levelUp.newLevel}\`%!`);
    return res.json({ ...getLevelUpScreen(player, levelUp.newLevel, levelUp.hpGain, levelUp.strGain, levelUp.perkPoint, levelUp.specPoint), pendingMessages: [
      ...pendingMessages,
      '`0You heave the merchant onto his horse and walk him back to town.',
      '`#He grips your hand, speechless with relief.',
      `\`$+${expReward.toLocaleString()} exp, +3 charm, +${alignGain} alignment.`,
    ]});
  }
  return res.json({ ...getTownScreen(player), pendingMessages: [
    ...pendingMessages,
    '`0You heave the merchant onto his horse and walk him back to town.',
    '`#He grips your hand, speechless with relief.',
    `\`$+${expReward.toLocaleString()} exp, +3 charm, +${alignGain} alignment.`,
  ]});
}

async function merchant_loot({ player, req, res, pendingMessages }) {
  if (player.quest_id !== 'missing_merchant') return res.json({ ...getTownScreen(player), pendingMessages });
  const goldReward = 300 * player.level;
  const alignLoss  = -20;
  await updatePlayer(player.id, {
    quest_id: '', quest_step: 0, quest_data: '',
    gold: Number(player.gold) + goldReward,
    alignment: Math.max(-100, (player.alignment || 0) + alignLoss),
    rep_merchants: Math.max(-100, (player.rep_merchants || 0) - 3),
  });
  player = await getPlayer(player.id);
  return res.json({ ...getTownScreen(player), pendingMessages: [
    ...pendingMessages,
    '`@You pocket the gold and walk away.',
    '`8He\'ll be found eventually. Probably.',
    `\`$+${goldReward.toLocaleString()} gold. \`@Alignment ${alignLoss}.`,
  ]});
}

async function quest_choice({ player, param, req, res, pendingMessages }) {
  const result = executeQuestChoice(player, param);
  if (!result) return res.json({ ...getTownScreen(player), pendingMessages });

  await updatePlayer(player.id, result.updates);
  player = await getPlayer(player.id);

  if (result.questComplete) {
    await addNews(`\`0${player.handle}\`% has completed the quest: \`$${result.questName}\`%!`);
  }

  const levelUp = checkLevelUp(player);
  if (levelUp) {
    await updatePlayer(player.id, levelUp.updates);
    player = await getPlayer(player.id);
    await addNews(`\`$${player.handle}\`% has advanced to level \`$${levelUp.newLevel}\`%!`);
    return res.json({ ...getLevelUpScreen(player, levelUp.newLevel, levelUp.hpGain, levelUp.strGain, levelUp.perkPoint, levelUp.specPoint), pendingMessages: [
      ...pendingMessages, ...result.messages,
    ]});
  }
  return res.json({ ...getTownScreen(player), pendingMessages: [...pendingMessages, ...result.messages] });
}

// ── DISTRICT SCREENS ──────────────────────────────────────────────────────────

async function district_market({ player, req, res, pendingMessages }) {
  return res.json({ ...getMarketScreen(player), pendingMessages });
}

async function district_gates({ player, req, res, pendingMessages }) {
  return res.json({ ...getGatesScreen(player), pendingMessages });
}

async function district_training({ player, req, res, pendingMessages }) {
  return res.json({ ...getTrainingGroundsScreen(player), pendingMessages });
}

async function district_social({ player, req, res, pendingMessages }) {
  return res.json({ ...getSocialHallScreen(player), pendingMessages });
}

module.exports = {
  inn, inn_rest, inn_gem, inn_antidote,
  inn_retire, inn_wake,
  inn_healer, inn_healer_wounds, inn_healer_infection, inn_use_bandage,
  bank, bank_deposit, bank_withdraw,
  master, master_train,
  training,
  training_fight: training_action,
  training_spar: training_action,
  training_endurance,
  weapon_shop, buy_weapon,
  shop_steal_weapon: shop_steal,
  armor_shop, buy_armor,
  shop_steal_armor: shop_steal,
  garden, garden_female, garden_flower, garden_compliment, garden_kiss, garden_talk, garden_respond,
  players,
  bard, news, character, character_gear, character_records, character_factions, crier, post_crier,
  herbalist,
  herbalist_wound,
  herbalist_infection,
  perk_select,
  choose_perk,
  spec_select,
  choose_spec,
  merchant_help,
  merchant_loot,
  quest_choice,
  district_market, district_gates, district_training, district_social,
};
