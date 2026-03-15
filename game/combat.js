// Combat resolution for LORD web port

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
    // Flee chance: 45% base, +15% for Thieves, +15% if critically low HP, -scaled by monster strength
    let fleeChance = 0.45;
    if (player.class === 3) fleeChance += 0.15;
    const hpRatio = (player.hit_points - poisonDamage) / Math.max(1, player.hit_max || player.hit_points);
    if (hpRatio < 0.20) fleeChance += 0.15;
    fleeChance -= (monster.strength / 2000) * 0.30;
    fleeChance = Math.min(0.90, Math.max(0.10, fleeChance));

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
  if (monster.behavior === 'fleeing' && monster.currentHp < monster.maxHp * 0.30 && Math.random() < 0.40) {
    log.push({ type: 'monster_flee', text: `\`7The ${monster.name} turns tail and flees into the darkness!` });
    monsterFled = true;
    return { playerDamage: 0, monsterDamage: 0, poisonDamage, fled: false, monsterFled: true, appliedPoison: false, log, playerCrit, monsterCrit };
  }

  // Player attacks
  let rawAttack = rollAttack(player.strength);
  if (action === 'power') {
    const { CLASS_POWER_MOVES } = require('./data');
    const move = CLASS_POWER_MOVES[player.class];
    rawAttack = Math.floor(rawAttack * move.damageMult);
    log.push({ type: 'power_move', text: `\`!You channel your power and unleash ${move.name}!\`` });
  }

  playerCrit = action !== 'power' && Math.random() < 0.08;
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
