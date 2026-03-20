// Road encounter pool for travelling between towns
// Each event: id, type, weight(how likely), and a build() function that returns encounter data
// build() receives (player, fromId, toId) and returns { title, lines[], choices[], special }

const { TOWNS } = require('./data');
const { getRandomMonster } = require('./data');

// ─────────────────────────────────────────────────────────────────────────────
// Encounter types
// ─────────────────────────────────────────────────────────────────────────────

const ROAD_EVENTS = [

  // ── Uneventful ────────────────────────────────────────────────────────────
  {
    id: 'uneventful',
    weight: 30,
    build(player, fromId, toId) {
      const flavours = [
        'The road stretches ahead in silence. Birds call somewhere in the trees.',
        'A light wind carries the smell of pine and distant rain.',
        'You pass a mossy milestone — someone has scratched a rune into it.',
        'The road is quiet. Your boots are the loudest thing for miles.',
        'Crows watch you from a dead oak. They say nothing of note.',
        'You find a comfortable pace and let the miles pass beneath you.',
      ];
      return {
        title: 'A Quiet Stretch',
        lines: [flavours[Math.floor(Math.random() * flavours.length)]],
        choices: [],
        type: 'uneventful',
      };
    },
  },

  // ── Helpful Traveller ─────────────────────────────────────────────────────
  {
    id: 'helpful_traveller',
    weight: 10,
    build(player) {
      const goldFound = 10 + Math.floor(Math.random() * player.level * 15);
      const flavours = [
        [`A weathered merchant heading back to town waves you down.`,
         `"I've had a profitable run. Take this — the road is long."`,
         `He presses a coin purse into your hand.`],
        [`A pilgrim with a sun-faded sash smiles and bows.`,
         `"The road is kinder when shared. Safe travels, warrior."`,
         `They hand you a small pouch of coin.`],
        [`A wandering bard tips his hat and strums a cheerful chord.`,
         `"Travelling alone? Let me at least pay for your next meal."`,
         `Coins jingle as they drop into your hand.`],
      ];
      const picked = flavours[Math.floor(Math.random() * flavours.length)];
      return {
        title: 'A Generous Soul',
        lines: picked,
        choices: [],
        type: 'helpful_traveller',
        goldGain: goldFound,
      };
    },
  },

  // ── Dead Traveller ────────────────────────────────────────────────────────
  {
    id: 'dead_traveller',
    weight: 8,
    build(player) {
      const goldFound = 5 + Math.floor(Math.random() * player.level * 20);
      const staminaCost = 1;
      return {
        title: 'A Grim Discovery',
        lines: [
          'A body lies half-hidden in the roadside ditch.',
          'Traveller. Merchant. Hard to say. Dead a day or two.',
          'Their purse is still on their belt.',
        ],
        choices: [
          { key: 'T', label: 'Take their coins', param: 'take' },
          { key: 'L', label: 'Leave them be',    param: 'leave' },
        ],
        type: 'dead_traveller',
        goldGain: goldFound,
        staminaCost,
      };
    },
  },

  // ── Road Bandit ───────────────────────────────────────────────────────────
  {
    id: 'road_bandits',
    weight: 20,
    build(player) {
      const monster = getRandomMonster(Math.max(1, player.level - 1));
      const goldDemand = 30 + Math.floor(Math.random() * player.level * 40);
      return {
        title: 'Ambushed!',
        lines: [
          '`@A rough voice cuts through the silence: "Stand and deliver!"',
          '`%Armed men step from the tree line. There are three of them.',
          `\`%They demand \`$${goldDemand.toLocaleString()}\`% gold. Refuse and they'll take it in blood.`,
        ],
        choices: [
          { key: 'F', label: 'Fight!',            param: 'fight' },
          { key: 'P', label: `Pay ${goldDemand.toLocaleString()} gold`, param: 'pay' },
        ],
        type: 'road_bandits',
        monster,
        goldDemand,
      };
    },
  },

  // ── Corrupt Sheriff ───────────────────────────────────────────────────────
  {
    id: 'corrupt_sheriff',
    weight: 8,
    build(player) {
      const toll = 20 + Math.floor(Math.random() * player.level * 30);
      return {
        title: 'A Toll on the Road',
        lines: [
          '`7A fat man in a dented badge blocks the road.',
          `\`7"Traveller's toll. \`$${toll.toLocaleString()}\`7 gold. King's law."`,
          '`7He has two mean-looking deputies with him.',
          '`8(This toll is entirely unofficial. Everyone knows it.)',
        ],
        choices: [
          { key: 'P', label: `Pay ${toll.toLocaleString()} gold (avoid trouble)`, param: 'pay' },
          { key: 'F', label: 'Refuse (fight)',                                    param: 'fight' },
          { key: 'R', label: 'Show your steel and bluff',                         param: 'bluff' },
        ],
        type: 'corrupt_sheriff',
        toll,
        monster: getRandomMonster(Math.max(1, player.level - 1)),
      };
    },
  },

  // ── Road Monster ──────────────────────────────────────────────────────────
  {
    id: 'road_monster',
    weight: 18,
    build(player) {
      const monster = getRandomMonster(player.level);
      return {
        title: 'Something Crosses Your Path',
        lines: [
          monster.meet,
          `\`%A \`@${monster.name}\`% blocks the road.`,
        ],
        choices: [
          { key: 'F', label: 'Fight!', param: 'fight' },
          { key: 'R', label: 'Run!',   param: 'run' },
        ],
        type: 'road_monster',
        monster,
      };
    },
  },

  // ── Kidnapper Gang (women only) ───────────────────────────────────────────
  {
    id: 'kidnapper_gang',
    weight: 0,   // Injected conditionally for women — weight is irrelevant
    sexFilter: 5,
    build(player) {
      return {
        title: 'A Dangerous Encounter',
        lines: [
          '`@A gang of rough men blocks the road ahead.',
          '`@Their leader — a broad woman with cold eyes — looks you over slowly.',
          '`%"Well, well. Travelling alone? That\'s a shame."',
          '`%Her men spread out around you. You count six. Too many.',
        ],
        choices: [
          { key: 'F', label: 'Draw your weapon and fight!',       param: 'fight' },
          { key: 'S', label: 'Submit (avoid a fight)',            param: 'submit' },
        ],
        type: 'kidnapper_gang',
        monster: getRandomMonster(Math.max(1, player.level)),
      };
    },
  },

  // ── Damsel Trap (men only) ────────────────────────────────────────────────
  {
    id: 'damsel_trap',
    weight: 0,   // Injected conditionally for men
    sexFilter: 0,
    build(player) {
      const goldLoss = Number(player.gold);
      return {
        title: 'A Cry for Help',
        lines: [
          '`%A woman in torn clothing stumbles from the trees, reaching toward you.',
          '`%"Please — bandits! They took everything. My children—"',
          '`%She falls to her knees in the mud.',
          '`8Something in the trees shifts. A twig snaps.',
        ],
        choices: [
          { key: 'H', label: 'Help her (investigate the trees)', param: 'help' },
          { key: 'N', label: 'Negotiate (offer gold)',           param: 'negotiate' },
          { key: 'W', label: 'Walk on (ignore her)',             param: 'walk_on' },
        ],
        type: 'damsel_trap',
        monster: getRandomMonster(player.level),
        goldLoss: Math.floor(goldLoss * 0.8),
      };
    },
  },

];

function pickRoadEncounter(player) {
  // Build the pool — include sex-specific events
  const pool = ROAD_EVENTS.filter(e => {
    if (e.sexFilter !== undefined) return player.sex === e.sexFilter;
    return true;
  });

  // Weighted random
  const totalWeight = pool.reduce((s, e) => s + (e.weight || 15), 0);
  let r = Math.random() * totalWeight;
  for (const event of pool) {
    r -= (event.weight || 15);
    if (r <= 0) return { ...event, data: event.build(player) };
  }
  return { ...pool[0], data: pool[0].build(player) };
}

// Camping night ambush — similar to road_bandits but limited choices
function buildCampAmbush(player) {
  const monster = getRandomMonster(Math.max(1, player.level - 1));
  return {
    title: 'Night Ambush!',
    lines: [
      '`@You wake to the crack of a branch.',
      '`@Shadows rush your camp from the tree line!',
      `\`%A \`@${monster.name}\`% lunges at you before you can rise!`,
    ],
    monster,
  };
}

module.exports = { ROAD_EVENTS, pickRoadEncounter, buildCampAmbush };
