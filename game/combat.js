// Combat resolution for SoT
const { hasPerk, hasSpec } = require('./data');

function rollDice(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// Returns damage dealt by attacker (before defense)
function rollAttack(strength) {
  const base = Math.floor(strength * 0.75);
  const variance = Math.floor(strength * 0.5);
  return base + rollDice(0, variance);
}

// Defense mitigation: takes the better of flat reduction (old formula) or
// percentage mitigation (scales well vs. boss-tier damage). Both are capped
// so neither can reduce damage below 1. The hybrid means armor never performs
// worse than the original flat formula, but gains extra value at very high damage.
function applyDefense(rawDamage, defense) {
  const flatReduced = rawDamage - Math.floor(defense * 0.4);
  const pct = Math.min(0.75, defense / (defense + 50));
  const pctReduced = Math.floor(rawDamage * (1 - pct));
  return Math.max(1, Math.min(flatReduced, pctReduced)); // lower damage = higher protection
}

// Resolve one round of combat
// action: 'attack' | 'run' | 'power'
// Returns { playerDamage, monsterDamage, poisonDamage, fled, monsterFled, appliedPoison, log, playerCrit, monsterCrit }
function resolveRound(player, monster, action) {
  const { parseWounds, getLocationPenalties, getCrushDefPenalty } = require('./wounds');
  const wounds = parseWounds(player);
  const locPen = getLocationPenalties(wounds);

  const log = [];
  let playerDamage = 0;
  let monsterDamage = 0;
  let poisonDamage = 0;
  let fled = false;
  let monsterFled = false;
  let appliedPoison = false;
  let playerCrit = false;
  let monsterCrit = false;

  // Poison DoT — applied at the top of every round
  if ((player.poisoned || 0) > 0) {
    poisonDamage = Math.max(1, Math.floor((player.hit_max || player.hit_points) * 0.05));
    log.push({ type: 'poison', text: `\`2Poison courses through your veins for \`@${poisonDamage}\`% damage!` });
  }

  if (action === 'run') {
    // Vampire: Bat Form — always flee successfully
    if (player.is_vampire) {
      log.push({ type: 'flee_success', text: '`#You dissolve into a swarm of bats and vanish from combat!' });
      return { playerDamage: 0, monsterDamage: 0, poisonDamage, fled: true, monsterFled: false, appliedPoison: false, log, playerCrit, monsterCrit };
    }

    // Flee chance: 45% base, +15% for Thieves, +15% if critically low HP, -scaled by monster strength
    // Leg wounds reduce flee chance
    let fleeChance = 0.45;
    if (player.class === 3) fleeChance += 0.15;
    const hpRatio = (player.hit_points - poisonDamage) / Math.max(1, player.hit_max || player.hit_points);
    if (hpRatio < 0.20) fleeChance += 0.15;
    fleeChance -= (monster.strength / 2000) * 0.30;
    fleeChance -= locPen.fleePct;
    // Perk: Mage Foresight — +20% flee chance
    if (hasPerk(player, 'foresight')) fleeChance += 0.20;
    // Perk: Druid Shapeshift — +15% flee chance (wolf aspect)
    if (hasPerk(player, 'shapeshift')) fleeChance += 0.15;
    // Spec: Ranger Strider — +10% flee chance
    if (hasSpec(player, 'strider')) fleeChance += 0.10;
    // Named armor: Coward's Cloak — +25% flee chance
    if (player.named_armor_id === 'cowards_cloak') fleeChance += 0.25;
    fleeChance = Math.min(0.90, Math.max(0.05, fleeChance));
    if (locPen.fleePct > 0) log.push({ type: 'wound_penalty', text: '`8Your wounded leg slows your escape!' });

    if (Math.random() < fleeChance) {
      log.push({ type: 'flee_success', text: `You turn and flee from the ${monster.name}!` });
      fled = true;
      return { playerDamage: 0, monsterDamage: 0, poisonDamage, fled: true, monsterFled: false, appliedPoison: false, log, playerCrit, monsterCrit };
    } else {
      log.push({ type: 'flee_fail', text: `\`7You try to flee, but the ${monster.name} cuts off your escape!` });
      const mAtk = rollAttack(monster.strength);
      monsterCrit = Math.random() < 0.05;
      let mDmg = applyDefense(mAtk, player.defense);
      if (monsterCrit) {
        mDmg = Math.floor(mDmg * 1.8);
        log.push({ type: 'monster_crit', text: `\`@** CRITICAL HIT! **\`% The ${monster.name} savagely strikes you with its ${monster.weapon} for \`@${mDmg}\`% damage!` });
      } else {
        log.push({ type: 'monster_attack', text: `The ${monster.name} strikes you with its ${monster.weapon} for \`@${mDmg}\`% damage!` });
      }
      monsterDamage = mDmg;
      if (monster.behavior === 'venomous' && mDmg > 0 && Math.random() < 0.40) {
        appliedPoison = true;
        log.push({ type: 'poison_applied', text: `\`2The ${monster.name}'s ${monster.weapon} injects venom into your wound!` });
      }
      return { playerDamage: 0, monsterDamage, poisonDamage, fled: false, monsterFled: false, appliedPoison, log, playerCrit, monsterCrit };
    }
  }

  // Fleeing monsters try to escape when badly wounded
  const terrifyBonus = hasPerk(player, 'terrify') ? 0.20 : 0;
  if (monster.behavior === 'fleeing' && monster.currentHp < monster.maxHp * 0.30 && Math.random() < (0.40 + terrifyBonus)) {
    log.push({ type: 'monster_flee', text: `\`7The ${monster.name} turns tail and flees into the darkness!` });
    monsterFled = true;
    return { playerDamage: 0, monsterDamage: 0, poisonDamage, fled: false, monsterFled: true, appliedPoison: false, log, playerCrit, monsterCrit };
  }
  // Perk: Dread Knight Terrify — any monster below 25% HP may be terrified into fleeing
  if (terrifyBonus > 0 && monster.behavior !== 'fleeing' && monster.currentHp < monster.maxHp * 0.25 && Math.random() < 0.15) {
    log.push({ type: 'monster_flee', text: `\`#Your terrifying presence breaks the ${monster.name}\'s will — it flees!` });
    monsterFled = true;
    return { playerDamage: 0, monsterDamage: 0, poisonDamage, fled: false, monsterFled: true, appliedPoison: false, log, playerCrit, monsterCrit };
  }

  // Player attacks — arm wounds reduce effective strength
  const effectiveStrength = Math.max(1, Math.floor(player.strength * (1 - locPen.strengthPct)));
  let rawAttack = rollAttack(effectiveStrength);
  if (locPen.strengthPct > 0 && action !== 'run') {
    log.push({ type: 'wound_penalty', text: `\`8Your wounded arm weakens your strike! (-${Math.round(locPen.strengthPct * 100)}% strength)` });
  }
  if (action === 'power') {
    const { CLASS_POWER_MOVES } = require('./data');
    const move = CLASS_POWER_MOVES[player.class];
    rawAttack = Math.floor(rawAttack * move.damageMult);
    log.push({ type: 'power_move', text: `\`!You channel your power and unleash ${move.name}!\`` });
  }

  // Perk: Ranger Hunter's Eye — +8% crit chance
  // Spec: Rogue Assassin — +15% crit chance
  const critChance = 0.08
    + (hasPerk(player, 'hunters_eye')  ? 0.08 : 0)
    + (hasSpec(player, 'assassin')     ? 0.15 : 0);
  // Spec: Warrior Champion — guaranteed crit when below 35% HP
  const isChampionCrit = hasSpec(player, 'champion')
    && (player.hit_points / Math.max(1, player.hit_max)) < 0.35;
  playerCrit = action !== 'power' && (isChampionCrit || Math.random() < critChance);
  if (playerCrit) rawAttack = Math.floor(rawAttack * 2.2);

  // Defensive monsters absorb 20% of incoming damage
  if (monster.behavior === 'defensive') rawAttack = Math.floor(rawAttack * 0.80);

  playerDamage = Math.max(1, rawAttack);

  if (playerCrit) {
    log.push({ type: 'player_crit', text: `\`$** CRITICAL HIT! **\`% You land a devastating blow on the ${monster.name} for \`$${playerDamage}\`% damage!` });
  } else {
    log.push({ type: 'player_attack', text: `You strike the ${monster.name} with your ${player.weapon_name} for \`$${playerDamage}\`7 damage!` });
  }
  if (monster.behavior === 'defensive') {
    log.push({ type: 'defensive', text: `\`7The ${monster.name}'s thick hide absorbs some of the blow!` });
  }

  // Monster counterattack (if still alive after player hit)
  if (monster.currentHp - playerDamage > 0) {
    // Aggressive monsters attack twice
    const attackTimes = monster.behavior === 'aggressive' ? 2 : 1;
    for (let i = 0; i < attackTimes; i++) {
      const mAtk = rollAttack(monster.strength);
      const isCrit = Math.random() < 0.05;
      let mDmg = applyDefense(mAtk, player.defense);
      if (isCrit) {
        mDmg = Math.floor(mDmg * 1.8);
        if (i === 0) monsterCrit = true;
        log.push({ type: 'monster_crit', text: `\`@** CRITICAL HIT! **\`% The ${monster.name} viciously strikes you with its ${monster.weapon} for \`@${mDmg}\`% damage!` });
      } else {
        if (i === 1) {
          log.push({ type: 'monster_attack', text: `\`7The ${monster.name} strikes AGAIN with its ${monster.weapon} for \`@${mDmg}\`% damage!` });
        } else {
          log.push({ type: 'monster_attack', text: `The ${monster.name} swings its ${monster.weapon} at you for \`@${mDmg}\`7 damage!` });
        }
      }
      monsterDamage += mDmg;
    }

    // Venomous monsters may inject poison
    if (monster.behavior === 'venomous' && monsterDamage > 0 && Math.random() < 0.35) {
      appliedPoison = true;
      log.push({ type: 'poison_applied', text: `\`2The ${monster.name}'s ${monster.weapon} injects venom into your wound!` });
    }
  }

  return { playerDamage, monsterDamage, poisonDamage, fled, monsterFled, appliedPoison, log, playerCrit, monsterCrit };
}

// Resolve full PvP combat (non-interactive, returns winner info)
function resolvePvP(attacker, defender) {
  let aHp = attacker.hit_points;
  let dHp = defender.hit_points;
  const log = [];
  let rounds = 0;

  while (aHp > 0 && dHp > 0 && rounds < 50) {
    rounds++;
    const aDmg = applyDefense(rollAttack(attacker.strength), defender.defense);
    const dDmg = applyDefense(rollAttack(defender.strength), attacker.defense);
    dHp -= aDmg;
    if (dHp > 0) aHp -= dDmg;
    log.push(`Round ${rounds}: You deal \`$${aDmg}\`% damage, ${defender.handle} deals \`@${dDmg}\`% damage.`);
  }

  return { attackerWon: aHp > 0, log, attackerHpLeft: aHp, defenderHpLeft: dHp };
}

module.exports = { resolveRound, resolvePvP };
