// City social space handlers — one unique location per town
const { getPlayer, updatePlayer, getAllPlayers, addNews } = require('../../db');
const { getRandomMonster, NAMED_ITEMS } = require('../data');
const {
  getTownScreen,
  getSocialVelmoraScreen, getSocialIronholdScreen, getSocialSilverkeepScreen,
  getSocialThornreachScreen, getSocialDuskveilScreen, getSocialGraveportScreen,
  getSocialStormwatchScreen, getSocialOldKarthScreen, getSocialAshenfallScreen,
  getSocialBrackenHollowScreen, getSocialMirefenScreen, getSocialFrostmereScreen,
} = require('../engine');

// ── Velmora: The Silken Chamber ───────────────────────────────────────────────
async function social_velmora({ player, req, res, pendingMessages }) {
  return res.json({ ...getSocialVelmoraScreen(player), pendingMessages });
}

async function social_velmora_enter({ player, req, res, pendingMessages }) {
  if (Number(player.gold) < 100)
    return res.json({ ...getSocialVelmoraScreen(player), pendingMessages: ['`@Not enough gold.'] });

  await updatePlayer(player.id, { gold: Number(player.gold) - 100 });
  player = await getPlayer(player.id);

  const roll = Math.random();
  let msgs;
  if (roll < 0.40) {
    // Good night
    const stamMax = player.stamina_max || 10;
    const stam = Math.min(stamMax, (player.stamina ?? stamMax) + 2);
    const newCharm = Math.min(50, (player.charm || 10) + 2);
    await updatePlayer(player.id, { stamina: stam, charm: newCharm });
    player = await getPlayer(player.id);
    msgs = [
      '`#The evening passes in warmth and music.',
      `\`#You feel refreshed. +2 stamina, +2 charm. (Charm now ${player.charm})`,
    ];
  } else if (roll < 0.60) {
    // Robbed
    const goldLost = Math.floor(Number(player.gold) * 0.20);
    await updatePlayer(player.id, { gold: Math.max(0, Number(player.gold) - goldLost) });
    player = await getPlayer(player.id);
    msgs = [
      '`@You wake in an alley. Your purse is lighter.',
      `\`@You were robbed of ${goldLost.toLocaleString()} gold. Expensive lesson.`,
    ];
  } else if (roll < 0.70) {
    // Poisoned
    await updatePlayer(player.id, { poisoned: Math.max(player.poisoned || 0, 3) });
    msgs = [
      '`@The wine tasted strange. You feel sick by morning.',
      '`@You have been poisoned!',
    ];
  } else {
    // Informant
    const goldGain = 15 * player.level + Math.floor(Math.random() * 100);
    await updatePlayer(player.id, { gold: Number(player.gold) + goldGain });
    const monster = getRandomMonster(player.level);
    msgs = [
      '`7A well-dressed stranger leans close and whispers in your ear.',
      `\`7"There is a \`%${monster.name}\`7 on the east road. Word to the wise."`,
      `\`$They press ${goldGain.toLocaleString()} gold into your hand and leave without another word.`,
    ];
  }

  player = await getPlayer(player.id);
  return res.json({ ...getTownScreen(player), pendingMessages: msgs });
}

// ── Ironhold: The Fighting Pit ────────────────────────────────────────────────
async function social_ironhold({ player, req, res, pendingMessages }) {
  return res.json({ ...getSocialIronholdScreen(player), pendingMessages });
}

async function social_ironhold_watch({ player, req, res, pendingMessages }) {
  const monster = getRandomMonster(player.level);
  const templates = [
    `\`6A fighter goes down hard. "Watch out for \`%${monster.name}\`6s on the south road," someone mutters.`,
    `\`6The crowd goes wild as the victor raises his fist. \`7"I've faced worse than that outside Ironhold."`,
    `\`6A grizzled veteran beside you: "You've got good eyes. \`%${monster.name}\`6s move like that — unpredictable."`,
    `\`6The loser limps out. "Stay off the roads alone," he warns you quietly.`,
  ];
  return res.json({ ...getSocialIronholdScreen(player), pendingMessages: [
    templates[Math.floor(Math.random() * templates.length)],
  ]});
}

async function social_ironhold_enter({ player, req, res, pendingMessages }) {
  if (Number(player.gold) < 100)
    return res.json({ ...getSocialIronholdScreen(player), pendingMessages: ['`@Not enough gold for the entry fee.'] });

  await updatePlayer(player.id, { gold: Number(player.gold) - 100 });
  player = await getPlayer(player.id);

  // Quick-resolve pit fight (no multi-round session state — instant result)
  const monster = getRandomMonster(Math.max(1, player.level - 1));
  const playerScore  = player.hit_points * 0.3 + player.strength * 0.7 + Math.random() * 60;
  const monsterScore = monster.hp * 0.3 + monster.strength * 0.7 + Math.random() * 60;
  const won = playerScore > monsterScore;

  if (won) {
    const prize = 100 + player.level * 30;
    await updatePlayer(player.id, { gold: Number(player.gold) + prize, exp: Number(player.exp) + monster.exp });
    player = await getPlayer(player.id);
    return res.json({ ...getSocialIronholdScreen(player), pendingMessages: [
      `\`0You face the ${monster.name} and emerge victorious!`,
      `\`$Prize: ${prize.toLocaleString()} gold  +${monster.exp.toLocaleString()} exp`,
      '`6The crowd roars your name.',
    ]});
  } else {
    const hpLost = Math.floor(player.hit_points * 0.30);
    await updatePlayer(player.id, { hit_points: Math.max(1, player.hit_points - hpLost) });
    player = await getPlayer(player.id);
    return res.json({ ...getSocialIronholdScreen(player), pendingMessages: [
      `\`@The ${monster.name} gets the better of you. You stagger from the pit.`,
      `\`@You lost ${hpLost} HP and your entry gold.`,
    ]});
  }
}

async function social_ironhold_bet({ player, param, req, res, pendingMessages }) {
  const bet = Math.max(10, parseInt(param) || 0);
  if (bet > Number(player.gold))
    return res.json({ ...getSocialIronholdScreen(player), pendingMessages: [`\`@You don't have ${bet.toLocaleString()} gold.`] });

  const capped = Math.min(bet, 500 + player.level * 100);
  const won = Math.random() < 0.48;
  if (won) {
    await updatePlayer(player.id, { gold: Number(player.gold) + capped });
    player = await getPlayer(player.id);
    return res.json({ ...getSocialIronholdScreen(player), pendingMessages: [
      `\`0Your fighter wins! You collect \`$${capped.toLocaleString()}\`0 gold.`,
    ]});
  } else {
    await updatePlayer(player.id, { gold: Number(player.gold) - capped });
    player = await getPlayer(player.id);
    return res.json({ ...getSocialIronholdScreen(player), pendingMessages: [
      `\`@Your fighter goes down in the third round. \`$${capped.toLocaleString()}\`@ gold gone.`,
    ]});
  }
}

// ── Silverkeep: Temple of Valor ───────────────────────────────────────────────
async function social_silverkeep({ player, req, res, pendingMessages }) {
  return res.json({ ...getSocialSilverkeepScreen(player), pendingMessages });
}

async function social_silverkeep_pray({ player, req, res, pendingMessages }) {
  const msgs = ['`!You kneel before the altar. The priest murmurs a prayer over you.'];
  const updates = {};
  if ((player.poisoned || 0) > 0) {
    updates.poisoned = 0;
    msgs.push('`!The poison is drawn from your body. You feel clean.');
  }
  const heal = Math.floor(player.hit_max * 0.08);
  updates.hit_points = Math.min(player.hit_max, player.hit_points + heal);
  msgs.push(`\`!You are healed for ${heal} HP.`);
  await updatePlayer(player.id, updates);
  player = await getPlayer(player.id);
  return res.json({ ...getSocialSilverkeepScreen(player), pendingMessages: msgs });
}

async function social_silverkeep_donate({ player, req, res, pendingMessages }) {
  if (Number(player.gold) < 50)
    return res.json({ ...getSocialSilverkeepScreen(player), pendingMessages: ['`@Not enough gold.'] });
  const heal = Math.floor(player.hit_max * 0.30);
  const newHp = Math.min(player.hit_max, player.hit_points + heal);
  await updatePlayer(player.id, { gold: Number(player.gold) - 50, hit_points: newHp });
  player = await getPlayer(player.id);
  return res.json({ ...getSocialSilverkeepScreen(player), pendingMessages: [
    `\`!You donate 50 gold. The priest lays hands upon your wounds.`,
    `\`!Restored ${heal} HP. (${newHp}/${player.hit_max})`,
  ]});
}

async function social_silverkeep_bless({ player, req, res, pendingMessages }) {
  const cost = player.level * 50;
  if (Number(player.gold) < cost)
    return res.json({ ...getSocialSilverkeepScreen(player), pendingMessages: [`\`@Not enough gold.`] });
  await updatePlayer(player.id, {
    gold: Number(player.gold) - cost,
    hit_points: player.hit_max,
    poisoned: 0,
  });
  player = await getPlayer(player.id);
  return res.json({ ...getTownScreen(player), pendingMessages: [
    `\`!The priest raises his staff over you. Golden light fills the temple.`,
    `\`!You are fully healed. All afflictions removed.`,
    `\`!"Go with valor, warrior."`,
  ]});
}

// ── Thornreach: The Ancient Grove ─────────────────────────────────────────────
async function social_thornreach({ player, req, res, pendingMessages }) {
  return res.json({ ...getSocialThornreachScreen(player), pendingMessages });
}

async function social_thornreach_commune({ player, req, res, pendingMessages }) {
  if (player.grove_healed_today)
    return res.json({ ...getSocialThornreachScreen(player), pendingMessages: ['`2The grove has given what it can today.'] });
  const heal = Math.floor(player.hit_max * 0.10);
  const newHp = Math.min(player.hit_max, player.hit_points + heal);
  await updatePlayer(player.id, { hit_points: newHp, grove_healed_today: 1 });
  player = await getPlayer(player.id);
  return res.json({ ...getSocialThornreachScreen(player), pendingMessages: [
    '`2You place your hands on the oldest oak. Something ancient stirs.',
    `\`2The grove heals your wounds. +${heal} HP.`,
  ]});
}

async function social_thornreach_herbs({ player, req, res, pendingMessages }) {
  if (Number(player.gold) < 30)
    return res.json({ ...getSocialThornreachScreen(player), pendingMessages: ['`@Not enough gold.'] });
  await updatePlayer(player.id, { gold: Number(player.gold) - 30, antidote_owned: 1 });
  player = await getPlayer(player.id);
  return res.json({ ...getSocialThornreachScreen(player), pendingMessages: [
    '`2You gather bitter herbs from the grove floor.',
    '`2You now carry an antidote. Use it from the Inn when poisoned.',
  ]});
}

async function social_thornreach_whisper({ player, req, res, pendingMessages }) {
  if (Number(player.gold) < 50)
    return res.json({ ...getSocialThornreachScreen(player), pendingMessages: ['`@Not enough gold.'] });
  const expGain = player.level * 55;
  await updatePlayer(player.id, { gold: Number(player.gold) - 50, exp: Number(player.exp) + expGain });
  const monster = getRandomMonster(player.level);
  player = await getPlayer(player.id);
  return res.json({ ...getSocialThornreachScreen(player), pendingMessages: [
    '`2The spirits stir. Old voices whisper in a language older than words.',
    `\`2You understand something new about combat. +${expGain.toLocaleString()} experience.`,
    `\`8They warn you: something like a \`%${monster.name}\`8 haunts the eastern paths.`,
  ]});
}

// ── Duskveil: The Shadow Market ───────────────────────────────────────────────
async function social_duskveil({ player, req, res, pendingMessages }) {
  return res.json({ ...getSocialDuskveilScreen(player), pendingMessages });
}

async function social_duskveil_intel({ player, req, res, pendingMessages }) {
  if (Number(player.gold) < 150)
    return res.json({ ...getSocialDuskveilScreen(player), pendingMessages: ['`@Not enough gold.'] });
  const hints = ['bandits', 'monster', 'safe', 'encounter'];
  const hint = hints[Math.floor(Math.random() * hints.length)];
  const hintDesc = {
    bandits:   '`#"Armed men on the road ahead. Travel prepared."',
    monster:   '`#"Something large has been crossing the roads. Be ready to fight."',
    safe:      '`#"The roads are quiet just now. Good time to travel."',
    encounter: '`#"You\'ll meet someone on the road. Friend or foe — unclear."',
  };
  await updatePlayer(player.id, { gold: Number(player.gold) - 150, road_hint: hint });
  player = await getPlayer(player.id);
  return res.json({ ...getSocialDuskveilScreen(player), pendingMessages: [
    '`8The masked woman leans close.',
    hintDesc[hint],
    '`8She pockets the coin and fades back into the crowd.',
  ]});
}

async function social_duskveil_guide({ player, req, res, pendingMessages }) {
  if (Number(player.gold) < 200)
    return res.json({ ...getSocialDuskveilScreen(player), pendingMessages: ['`@Not enough gold.'] });
  await updatePlayer(player.id, { gold: Number(player.gold) - 200, guide_hired: 1 });
  player = await getPlayer(player.id);
  return res.json({ ...getSocialDuskveilScreen(player), pendingMessages: [
    '`8A silent figure in a grey cloak nods once.',
    '`8"I know the roads. I\'ll keep you off the dangerous stretches."',
    '`#Road encounter chance halved for your next journey.',
  ]});
}

async function social_duskveil_market({ player, req, res, pendingMessages }) {
  return res.json({ ...getSocialDuskveilScreen(player, 'market'), pendingMessages });
}

const CURSED_ITEM_PRICES = { blooddrinker: 50000, voidplate: 100000 };

async function social_duskveil_buy_cursed_weapon({ player, param, req, res, pendingMessages }) {
  const itemId = param;
  const item = NAMED_ITEMS[itemId];
  if (!item || item.type !== 'weapon' || !item.cursed)
    return res.json({ ...getSocialDuskveilScreen(player, 'market'), pendingMessages: ['`@Unknown item.'] });
  if (player.weapon_cursed || player.named_weapon_id)
    return res.json({ ...getSocialDuskveilScreen(player, 'market'), pendingMessages: ['`@You already carry a cursed or named weapon.'] });

  const price = CURSED_ITEM_PRICES[itemId] || 50000;
  if (Number(player.gold) < price)
    return res.json({ ...getSocialDuskveilScreen(player, 'market'), pendingMessages: [`\`@You need ${price.toLocaleString()} gold.`] });

  await updatePlayer(player.id, {
    gold: Number(player.gold) - price,
    named_weapon_id: itemId,
    weapon_cursed: true,
    strength: player.strength + item.strength,
  });
  player = await getPlayer(player.id);
  return res.json({ ...getSocialDuskveilScreen(player, 'market'), pendingMessages: [
    `\`@The dealer slides \`!${item.name}\`@ across the table without a word.`,
    `\`8"${item.lore}"`,
    `\`@It is yours now. For better or worse.`,
  ]});
}

async function social_duskveil_buy_cursed_armor({ player, param, req, res, pendingMessages }) {
  const itemId = param;
  const item = NAMED_ITEMS[itemId];
  if (!item || item.type !== 'armor' || !item.cursed)
    return res.json({ ...getSocialDuskveilScreen(player, 'market'), pendingMessages: ['`@Unknown item.'] });
  if (player.armor_cursed || player.named_armor_id)
    return res.json({ ...getSocialDuskveilScreen(player, 'market'), pendingMessages: ['`@You already carry a cursed or named armour.'] });

  const price = CURSED_ITEM_PRICES[itemId] || 100000;
  if (Number(player.gold) < price)
    return res.json({ ...getSocialDuskveilScreen(player, 'market'), pendingMessages: [`\`@You need ${price.toLocaleString()} gold.`] });

  await updatePlayer(player.id, {
    gold: Number(player.gold) - price,
    named_armor_id: itemId,
    armor_cursed: true,
    defense: player.defense + item.defense,
  });
  player = await getPlayer(player.id);
  return res.json({ ...getSocialDuskveilScreen(player, 'market'), pendingMessages: [
    `\`@The dealer lifts \`!${item.name}\`@ from beneath the table.`,
    `\`8"${item.lore}"`,
    `\`@You feel the cold of it through the cloth. You buy it anyway.`,
  ]});
}

// ── Graveport: The Drowned Man ────────────────────────────────────────────────
async function social_graveport({ player, req, res, pendingMessages }) {
  return res.json({ ...getSocialGraveportScreen(player), pendingMessages });
}

async function social_graveport_drink({ player, req, res, pendingMessages }) {
  if (Number(player.gold) < 40)
    return res.json({ ...getSocialGraveportScreen(player), pendingMessages: ['`@Not enough gold.'] });
  const stamMax = player.stamina_max || 10;
  const stam = Math.min(stamMax, (player.stamina ?? stamMax) + 2);
  const monster = getRandomMonster(player.level);
  await updatePlayer(player.id, { gold: Number(player.gold) - 40, stamina: stam });
  player = await getPlayer(player.id);
  return res.json({ ...getSocialGraveportScreen(player), pendingMessages: [
    '`6The barman pours something dark and potent.',
    '`6You drink. It burns going down and warms for an hour after.',
    `\`0+2 stamina. (${stam}/${stamMax})`,
    `\`8A sailor leans over: "Saw a \`%${monster.name}\`8 off the docks last night. Big one."`,
  ]});
}

async function social_graveport_gossip({ player, req, res, pendingMessages }) {
  const monster = getRandomMonster(player.level);
  const gossip = [
    `\`8"The harbormaster won't say what came in on last night's tide. But the deckhands are scared."`,
    `\`8"Three ships didn't make port this week. Something's in the water between here and Velmora."`,
    `\`6"Saw a \`%${monster.name}\`6 near the breakwater. Don't ask me how it got there."`,
    `\`8"There's gold to be made for the brave. The kind of gold that comes with a story you can't tell."`,
  ];
  return res.json({ ...getSocialGraveportScreen(player), pendingMessages: [
    gossip[Math.floor(Math.random() * gossip.length)],
  ]});
}

// ── Stormwatch: The Arcane Library ────────────────────────────────────────────
async function social_stormwatch({ player, req, res, pendingMessages }) {
  return res.json({ ...getSocialStormwatchScreen(player), pendingMessages });
}

async function social_stormwatch_study({ player, req, res, pendingMessages }) {
  const cost = player.level * 50;
  if (Number(player.gold) < cost)
    return res.json({ ...getSocialStormwatchScreen(player), pendingMessages: ['`@Not enough gold.'] });
  const expGain = player.level * 60;
  await updatePlayer(player.id, { gold: Number(player.gold) - cost, exp: Number(player.exp) + expGain });
  player = await getPlayer(player.id);
  return res.json({ ...getSocialStormwatchScreen(player), pendingMessages: [
    '`!You spend hours in the stacks, studying combat theory and arcane tactics.',
    `\`0+${expGain.toLocaleString()} experience.`,
  ]});
}

async function social_stormwatch_sage({ player, req, res, pendingMessages }) {
  if (Number(player.gold) < 400)
    return res.json({ ...getSocialStormwatchScreen(player), pendingMessages: ['`@Not enough gold.'] });
  const newCharm = Math.min(50, (player.charm || 10) + 1);
  const monster = getRandomMonster(player.level);
  await updatePlayer(player.id, { gold: Number(player.gold) - 400, charm: newCharm });
  player = await getPlayer(player.id);
  return res.json({ ...getSocialStormwatchScreen(player), pendingMessages: [
    '`!The sage removes his spectacles and considers you for a long moment.',
    `\`!"Your bearing improves with knowledge." +1 charm. (${newCharm})`,
    `\`!He opens a dusty tome: "The \`%${monster.name}\`! is weakest at its flanks. Remember that."`,
  ]});
}

async function social_stormwatch_scroll({ player, req, res, pendingMessages }) {
  const cost = player.level * 200;
  if (Number(player.gold) < cost)
    return res.json({ ...getSocialStormwatchScreen(player), pendingMessages: ['`@Not enough gold.'] });
  await updatePlayer(player.id, { gold: Number(player.gold) - cost, gems: (player.gems || 0) + 1 });
  player = await getPlayer(player.id);
  return res.json({ ...getSocialStormwatchScreen(player), pendingMessages: [
    '`!The archivist produces a sealed scroll from behind the counter.',
    '`!"Use this in combat. The magic within holds one charge."',
    '`0+1 gem. (Use gems at the Inn to fully restore HP.)',
  ]});
}

// ── Old Karth: The Crypts ─────────────────────────────────────────────────────
async function social_old_karth({ player, req, res, pendingMessages }) {
  return res.json({ ...getSocialOldKarthScreen(player), pendingMessages });
}

async function social_old_karth_loot({ player, req, res, pendingMessages }) {
  if (Math.random() < 0.50) {
    const goldFound = player.level * 20 + Math.floor(Math.random() * player.level * 30);
    await updatePlayer(player.id, { gold: Number(player.gold) + goldFound });
    player = await getPlayer(player.id);
    return res.json({ ...getSocialOldKarthScreen(player), pendingMessages: [
      '`8You move through the dark passages, disturbing only dust.',
      `\`$Your hands close around a burial offering. ${goldFound.toLocaleString()} gold — ancient but still spendable.`,
    ]});
  } else {
    // Cursed — lose HP
    const hpLost = Math.floor(player.hit_max * 0.15);
    await updatePlayer(player.id, { hit_points: Math.max(1, player.hit_points - hpLost) });
    player = await getPlayer(player.id);
    return res.json({ ...getSocialOldKarthScreen(player), pendingMessages: [
      '`@Something moves in the dark. You run.',
      `\`@Whatever touched you left a mark. -${hpLost} HP.`,
    ]});
  }
}

async function social_old_karth_commune({ player, req, res, pendingMessages }) {
  if (Number(player.gold) < 100)
    return res.json({ ...getSocialOldKarthScreen(player), pendingMessages: ['`@Not enough gold.'] });
  const expGain = player.level * 45;
  const newCharm = Math.min(50, (player.charm || 10) + 1);
  await updatePlayer(player.id, { gold: Number(player.gold) - 100, charm: newCharm, exp: Number(player.exp) + expGain });
  player = await getPlayer(player.id);
  return res.json({ ...getSocialOldKarthScreen(player), pendingMessages: [
    '`8You burn a coin at the ancient altar and speak into the dark.',
    '`8Something answers. It speaks of old enemies, older techniques.',
    `\`7+1 charm. +${expGain.toLocaleString()} experience.`,
  ]});
}

// ── Ashenfall: The Forge of Ruin ──────────────────────────────────────────────
async function social_ashenfall({ player, req, res, pendingMessages }) {
  return res.json({ ...getSocialAshenfallScreen(player), pendingMessages });
}

async function social_ashenfall_weapon({ player, req, res, pendingMessages }) {
  const cost = player.level * 3000;
  if (Number(player.gold) < cost)
    return res.json({ ...getSocialAshenfallScreen(player), pendingMessages: ['`@Not enough gold.'] });
  if (player.forge_weapon_upgraded)
    return res.json({ ...getSocialAshenfallScreen(player), pendingMessages: ['`7This weapon has already been tempered here.'] });
  await updatePlayer(player.id, {
    gold: Number(player.gold) - cost,
    strength: Number(player.strength) + 5,
    forge_weapon_upgraded: 1,
  });
  player = await getPlayer(player.id);
  return res.json({ ...getSocialAshenfallScreen(player), pendingMessages: [
    '`@Vorn thrusts your weapon into the heart of the fire.',
    '`@He hammers it for what feels like hours.',
    `\`$Your weapon is sharper, heavier, deadlier. Permanent +5 STR. (${player.strength} total)`,
  ]});
}

async function social_ashenfall_armor({ player, req, res, pendingMessages }) {
  const cost = player.level * 2000;
  if (Number(player.gold) < cost)
    return res.json({ ...getSocialAshenfallScreen(player), pendingMessages: ['`@Not enough gold.'] });
  if (player.forge_armor_upgraded)
    return res.json({ ...getSocialAshenfallScreen(player), pendingMessages: ['`7This armour has already been reinforced here.'] });
  await updatePlayer(player.id, {
    gold: Number(player.gold) - cost,
    defense: Number(player.defense) + 3,
    forge_armor_upgraded: 1,
  });
  player = await getPlayer(player.id);
  return res.json({ ...getSocialAshenfallScreen(player), pendingMessages: [
    '`@Vorn rivets new steel plates over the weak points.',
    '`@The work is brutal and unhurried.',
    `\`$Your armour fits tighter, stops more. Permanent +3 DEF. (${player.defense} total)`,
  ]});
}

// ── Bracken Hollow: The Village Well ─────────────────────────────────────────
async function social_bracken_hollow({ player, req, res, pendingMessages }) {
  return res.json({ ...getSocialBrackenHollowScreen(player), pendingMessages });
}

async function social_bracken_drink({ player, req, res, pendingMessages }) {
  if (player.well_used_today)
    return res.json({ ...getSocialBrackenHollowScreen(player), pendingMessages: ['`7The well has given you its gift today. Come back tomorrow.'] });
  const stamMax = player.stamina_max || 10;
  const heal = Math.min(player.hit_max, player.hit_points + 2);
  const stam = Math.min(stamMax, (player.stamina ?? stamMax) + 1);
  await updatePlayer(player.id, { hit_points: heal, stamina: stam, well_used_today: 1 });
  player = await getPlayer(player.id);
  return res.json({ ...getSocialBrackenHollowScreen(player), pendingMessages: [
    '`%The water is clean and cold. You drink your fill.',
    `\`0+2 HP, +1 stamina. (${player.hit_points}/${player.hit_max} HP, ${player.stamina}/${stamMax} STM)`,
  ]});
}

async function social_bracken_talk({ player, req, res, pendingMessages }) {
  const monster = getRandomMonster(Math.max(1, player.level - 1));
  const locals = [
    `\`6A farmer adjusts his cap. "Haven't seen trouble like a \`%${monster.name}\`6 in years. But last week..."`,
    `\`6An old woman hanging laundry squints at you. "You look like trouble. The \`%${monster.name}\`6 kind."`,
    `\`6A child runs up. "Are you a hero? My da says a \`%${monster.name}\`6 took our best cow last season."`,
    `\`6A man fixing a fence tips his head. "Road to Dawnmark's been rough lately. \`%${monster.name}\`6s mostly."`,
  ];
  return res.json({ ...getSocialBrackenHollowScreen(player), pendingMessages: [
    locals[Math.floor(Math.random() * locals.length)],
  ]});
}

// ── Mirefen: The Bog Witch's Hut ──────────────────────────────────────────────
async function social_mirefen({ player, req, res, pendingMessages }) {
  return res.json({ ...getSocialMirefenScreen(player), pendingMessages });
}

async function social_mirefen_brew({ player, req, res, pendingMessages }) {
  const cost = player.level * 30;
  if (Number(player.gold) < cost)
    return res.json({ ...getSocialMirefenScreen(player), pendingMessages: ['`@Not enough gold.'] });
  const heal = Math.floor(player.hit_max * 0.40);
  const newHp = Math.min(player.hit_max, player.hit_points + heal);
  await updatePlayer(player.id, { gold: Number(player.gold) - cost, hit_points: newHp });
  player = await getPlayer(player.id);
  return res.json({ ...getSocialMirefenScreen(player), pendingMessages: [
    '`2She hands you a clay bottle. The contents glow faintly green.',
    '`2You drink it. It tastes of bog water and old iron. It works.',
    `\`0+${heal} HP. (${player.hit_points}/${player.hit_max})`,
  ]});
}

async function social_mirefen_curse_remove({ player, req, res, pendingMessages }) {
  if (Number(player.gold) < 100)
    return res.json({ ...getSocialMirefenScreen(player), pendingMessages: ['`@Not enough gold.'] });
  await updatePlayer(player.id, { gold: Number(player.gold) - 100, poisoned: 0 });
  player = await getPlayer(player.id);
  return res.json({ ...getSocialMirefenScreen(player), pendingMessages: [
    '`2She mutters over a bowl of murky water, then throws the contents on you.',
    '`2Your skin tingles. Whatever was in you — it\'s gone.',
    '`0Poison and afflictions cleared.',
  ]});
}

async function social_mirefen_curse_enemy({ player, req, res, pendingMessages }) {
  if (Number(player.gold) < 200)
    return res.json({ ...getSocialMirefenScreen(player), pendingMessages: ['`@Not enough gold.'] });

  // Pick a random player to curse
  const allPlayers = await getAllPlayers();
  const targets = allPlayers.filter(p => p.id !== player.id && !p.dead && p.setup_complete);
  if (targets.length === 0)
    return res.json({ ...getSocialMirefenScreen(player), pendingMessages: ['`8The witch frowns. "No suitable target. Keep your coin."'] });

  const target = targets[Math.floor(Math.random() * targets.length)];
  const { getPlayer: gp } = require('../../db');
  const fullTarget = await gp(target.id);
  const hpLost = Math.max(1, Math.floor(fullTarget.hit_max * 0.05));
  await updatePlayer(target.id, { hit_points: Math.max(1, fullTarget.hit_points - hpLost) });
  await updatePlayer(player.id, { gold: Number(player.gold) - 200 });
  await addNews(`\`#A dark curse struck \`%${target.handle}\`# somewhere in the realm...`);
  player = await getPlayer(player.id);

  return res.json({ ...getSocialMirefenScreen(player), pendingMessages: [
    '`#The witch plucks a hair from the air — from nowhere — and whispers over it.',
    `\`#${target.handle} will feel this before nightfall.`,
    '`8"Go. And don\'t tell anyone you were here."',
  ]});
}

// ── Frostmere: The Hearthfire Inn ─────────────────────────────────────────────
async function social_frostmere({ player, req, res, pendingMessages }) {
  return res.json({ ...getSocialFrostmereScreen(player), pendingMessages });
}

async function social_frostmere_meal({ player, req, res, pendingMessages }) {
  if (Number(player.gold) < 30)
    return res.json({ ...getSocialFrostmereScreen(player), pendingMessages: ['`@Not enough gold.'] });
  const stamMax = player.stamina_max || 10;
  const stam = Math.min(stamMax, (player.stamina ?? stamMax) + 3);
  await updatePlayer(player.id, { gold: Number(player.gold) - 30, stamina: stam });
  player = await getPlayer(player.id);
  return res.json({ ...getSocialFrostmereScreen(player), pendingMessages: [
    '`!A bowl of thick stew and a heel of dark bread.',
    '`!It\'s simple but hot. Your body thanks you.',
    `\`0+3 stamina. (${stam}/${stamMax})`,
  ]});
}

async function social_frostmere_rest({ player, req, res, pendingMessages }) {
  const cost = 50 + player.level * 10;
  if (Number(player.gold) < cost)
    return res.json({ ...getSocialFrostmereScreen(player), pendingMessages: [`\`@Not enough gold. Costs ${cost.toLocaleString()}.`] });
  await updatePlayer(player.id, { gold: Number(player.gold) - cost, hit_points: player.hit_max });
  player = await getPlayer(player.id);
  return res.json({ ...getSocialFrostmereScreen(player), pendingMessages: [
    '`!You sleep by the fire wrapped in a fur the size of a bear.',
    '`!You wake eight hours later, fully healed.',
    `\`0Full HP restored. (${player.hit_max}/${player.hit_max})`,
  ]});
}

async function social_frostmere_bless({ player, req, res, pendingMessages }) {
  if (Number(player.gold) < 100)
    return res.json({ ...getSocialFrostmereScreen(player), pendingMessages: ['`@Not enough gold.'] });
  const stamMax = player.stamina_max || 10;
  const healAmt = Math.floor(player.hit_max * 0.30);
  const newHp = Math.min(player.hit_max, player.hit_points + healAmt);
  const stam = Math.min(stamMax, (player.stamina ?? stamMax) + 4);
  await updatePlayer(player.id, {
    gold: Number(player.gold) - 100,
    hit_points: newHp,
    stamina: stam,
    poisoned: 0,
  });
  player = await getPlayer(player.id);
  return res.json({ ...getSocialFrostmereScreen(player), pendingMessages: [
    '`!Bjarne marks your forehead with an ancient hunter\'s sign.',
    '`!"The cold preserves. The fire renews. Go well."',
    `\`0+${healAmt} HP, +4 stamina, poison cleared.`,
  ]});
}


module.exports = {
  social_velmora, social_velmora_enter,
  social_ironhold, social_ironhold_watch, social_ironhold_enter, social_ironhold_bet,
  social_silverkeep, social_silverkeep_pray, social_silverkeep_donate, social_silverkeep_bless,
  social_thornreach, social_thornreach_commune, social_thornreach_herbs, social_thornreach_whisper,
  social_duskveil, social_duskveil_intel, social_duskveil_guide,
  social_duskveil_market, social_duskveil_buy_cursed_weapon, social_duskveil_buy_cursed_armor,
  social_graveport, social_graveport_drink, social_graveport_gossip,
  social_stormwatch, social_stormwatch_study, social_stormwatch_sage, social_stormwatch_scroll,
  social_old_karth, social_old_karth_loot, social_old_karth_commune,
  social_ashenfall, social_ashenfall_weapon, social_ashenfall_armor,
  social_bracken_hollow, social_bracken_drink, social_bracken_talk,
  social_mirefen, social_mirefen_brew, social_mirefen_curse_remove, social_mirefen_curse_enemy,
  social_frostmere, social_frostmere_meal, social_frostmere_rest, social_frostmere_bless,
};
