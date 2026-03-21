// Tavern random encounters for LORD web port
// Fires ~40% of the time when entering the The Rusted Flagon
// Each encounter has display data and a resolver function

const { getPlayer, updatePlayer, addNews } = require('../db');
const { resolveRound } = require('./combat');
const { getTownScreen, getTavernScreen } = require('./engine');

// ── NPC Art ───────────────────────────────────────────────────────────────────

const NPC_ART = {

  stranger: {
    color: 'magenta',
    lines: [
      "    *  .  *  .  *  ",
      "   ( -     - )     ",
      "    \\ \\___/ /      ",
      "   /|       |\\    ",
      "  ( |  * *  | )    ",
      "   \\_________/     ",
    ],
  },

  merchant: {
    color: 'brown',
    lines: [
      "  ,============,   ",
      "  | .--------. |   ",
      "  | | $    $ | |   ",
      "  | '--------' |   ",
      "  |  [WARES]   |   ",
      "  '============'   ",
    ],
  },

  soldier: {
    color: 'gray',
    lines: [
      "  ,--[HELM]--,     ",
      " ( . )    ( . )    ",
      "  '-----------'    ",
      " [==BREASTPLATE==] ",
      "  |  |  .  |  |    ",
      "  |  |_____|  |    ",
    ],
  },

  cards: {
    color: 'yellow',
    lines: [
      "  .--. .--.        ",
      "  |A | |K |        ",
      "  |  | |  |        ",
      "  | A| | K|        ",
      "  '--' '--'        ",
      "   [THE  TABLE]    ",
    ],
  },

  widow: {
    color: 'white',
    lines: [
      "    .-------.       ",
      "   ( T  T    )     ",
      "    '--(  )--'     ",
      "     /|    |\\     ",
      "    ( |    | )     ",
      "     '-'  '-'      ",
    ],
  },

  veteran: {
    color: 'gray',
    lines: [
      "  ,---[SCAR]---,   ",
      " ( o )      (o )   ",
      "  '--'---+--'--'   ",
      "  |  MEDALS  |     ",
      "  | * * * *  |     ",
      "  |___________|    ",
    ],
  },

  pickpocket: {
    color: 'dgray',
    lines: [
      "  ,----------,     ",
      " (  ^ )  ( ^  )    ",
      "  \\ '-------' /   ",
      "   |  [CLOAK]  |   ",
      "  /| *fingers* |\\  ",
      " (_|           |_) ",
    ],
  },

};

// ── Quick brawl resolution (3 rounds, no session state) ───────────────────────

function resolveBrawl(player, monster) {
  let playerHp = player.hit_points;
  let monsterHp = monster.currentHp;
  const log = [];

  for (let round = 0; round < 4 && playerHp > 0 && monsterHp > 0; round++) {
    const result = resolveRound(
      { ...player, hit_points: playerHp, poisoned: 0 },
      { ...monster, currentHp: monsterHp },
      'attack',
    );
    monsterHp = Math.max(0, monsterHp - result.playerDamage);
    playerHp  = Math.max(0, playerHp  - result.monsterDamage);
    result.log.forEach(e => log.push(e.text));
  }

  return { playerWon: monsterHp <= 0, playerHpLeft: Math.max(1, playerHp), log };
}

// ── Encounter pool ────────────────────────────────────────────────────────────

const TAVERN_ENCOUNTERS = [

  // ── 1. The Shapely Stranger ─────────────────────────────────────────────────
  {
    id: 'shapely_stranger',
    title: 'A Mysterious Stranger',
    weight: 12,
    minLevel: 1,
    art: NPC_ART.stranger,
    intro: [
      'A shapely woman with dark, knowing eyes catches your gaze across the smoky room.',
      'She moves through the crowd like smoke and takes the seat beside you uninvited.',
      `"My, my... you look like someone who deserves a little company tonight."`,
      'Her smile is warm. Her eyes are something else entirely.',
    ],
    choices: [
      { key: 'A', label: 'Accept her company', param: 'accept' },
      { key: 'B', label: 'Buy her a drink first', param: 'drink' },
      { key: 'I', label: 'Politely decline', param: 'ignore' },
    ],
  },

  // ── 2. The Hooded Merchant ──────────────────────────────────────────────────
  {
    id: 'hooded_merchant',
    title: 'The Hooded Merchant',
    weight: 10,
    minLevel: 1,
    art: NPC_ART.merchant,
    intro: [
      'A hooded figure slides into the seat across from you without a word.',
      'From beneath the cloak comes a small wooden box, placed deliberately on the table.',
      '"Belonged to a warrior," he says quietly. "One who won\'t be needing it anymore."',
      '"Yours for two hundred gold. No questions. No receipts."',
    ],
    choices: [
      { key: 'B', label: 'Buy the item (200 gold)', param: 'buy' },
      { key: 'H', label: 'Haggle (100 gold, Thieves only)', param: 'haggle' },
      { key: 'R', label: 'Refuse and walk away', param: 'refuse' },
    ],
  },

  // ── 3. The Dying Soldier ────────────────────────────────────────────────────
  {
    id: 'dying_soldier',
    title: 'A Soldier\'s Last Words',
    weight: 7,
    minLevel: 2,
    art: NPC_ART.soldier,
    intro: [
      'A soldier in battered armour collapses against your table, breathing hard.',
      'His wounds are serious. He grabs your arm with surprising strength.',
      '"Listen... you have to listen. I found something in the forest. Before they got me..."',
      'His eyes are fading fast. He presses something cold into your hand.',
    ],
    choices: [
      { key: 'L', label: 'Listen carefully to his words', param: 'listen' },
      { key: 'H', label: 'Call for help and tend his wounds', param: 'help' },
      { key: 'I', label: 'Slip away before anyone notices', param: 'ignore' },
    ],
  },

  // ── 4. The Card Sharp ───────────────────────────────────────────────────────
  {
    id: 'card_sharp',
    title: 'The Card Sharp',
    weight: 10,
    minLevel: 1,
    art: NPC_ART.cards,
    intro: [
      'A lean man with quick hands and quicker eyes is dealing cards alone at a corner table.',
      'He notices your gaze and grins, flicking a card across to you face-down.',
      '"One hand. High card wins. You put up fifty gold, I put up a hundred."',
      '"Unless... you\'d like to raise the stakes?" He fans the deck with practiced ease.',
    ],
    choices: [
      { key: 'L', label: 'Play for low stakes (50 gold)', param: 'low' },
      { key: 'H', label: 'Raise the stakes (200 gold)', param: 'high' },
      { key: 'W', label: 'Walk away', param: 'refuse' },
    ],
  },

  // ── 5. The Crying Widow ─────────────────────────────────────────────────────
  {
    id: 'crying_widow',
    title: 'The Widow\'s Grief',
    weight: 8,
    minLevel: 2,
    art: NPC_ART.widow,
    intro: [
      'A woman in black sits alone, weeping quietly into a cup she hasn\'t touched.',
      'The barkeep catches your eye and shakes his head slowly.',
      '"Her husband went into the forest three days ago," Hrok murmurs. "Never came back."',
      'As if sensing your attention, she looks up. Her eyes are hollow with grief — and rage.',
    ],
    choices: [
      { key: 'V', label: 'Vow to avenge her husband', param: 'avenge' },
      { key: 'C', label: 'Offer comfort and gold', param: 'comfort' },
      { key: 'I', label: 'Look away — not your problem', param: 'ignore' },
    ],
  },

  // ── 6. The Old Veteran ──────────────────────────────────────────────────────
  {
    id: 'old_veteran',
    title: 'The Old Veteran',
    weight: 9,
    minLevel: 1,
    art: NPC_ART.veteran,
    intro: [
      'An old warrior with a scarred face and a chest full of medals sits at the bar.',
      'He\'s been watching you. Not hostile — appraising.',
      '"You\'ve got the look," he says, nodding slowly. "Fought in the old wars myself."',
      '"Buy an old soldier a drink and I\'ll tell you something worth knowing."',
    ],
    choices: [
      { key: 'B', label: 'Buy him a drink (25 gold)', param: 'buy' },
      { key: 'T', label: 'Just talk — no drink', param: 'talk' },
      { key: 'I', label: 'You\'re busy tonight', param: 'ignore' },
    ],
  },

  // ── 7. The Thief in the Night ───────────────────────────────────────────────
  {
    id: 'thief_in_night',
    title: 'Light Fingers',
    weight: 9,
    minLevel: 1,
    art: NPC_ART.pickpocket,
    intro: [
      'You feel it before you see it — a slight tug at your belt pouch.',
      'A cloaked figure is already backing into the crowd, your gold in hand.',
      'The crowd is thick. Most people haven\'t noticed. You have a moment to act.',
    ],
    choices: [
      { key: 'C', label: 'Give chase through the crowd', param: 'chase' },
      { key: 'S', label: 'Shout for the barkeep to stop them', param: 'shout' },
      { key: 'L', label: 'Let them go — not worth it', param: 'let_go' },
    ],
  },

];

// ── Resolvers ─────────────────────────────────────────────────────────────────
// Each resolver: async (player, param, req, res, pendingMessages) => void
// Must call res.json() with a screen

const RESOLVERS = {

  // ── 1. The Shapely Stranger ─────────────────────────────────────────────────
  shapely_stranger: async (player, param, req, res, pendingMessages) => {
    const others = await (require('../db').getAllPlayers)();

    if (param === 'ignore') {
      return res.json({ ...getTavernScreen(player, others), pendingMessages: [
        '`7You give her a polite nod and turn back to your drink.',
        '`8She watches you for a moment, then glides away into the crowd. Was that a smirk?',
      ]});
    }

    if (param === 'drink') {
      if (Number(player.gold) < 25) {
        return res.json({ ...getTavernScreen(player, others), pendingMessages: [
          "`@You don't have enough gold to buy her a drink.",
          '`8She raises an eyebrow and finds more interesting company.',
        ]});
      }
      await updatePlayer(player.id, { gold: Number(player.gold) - 25 });
      player = await getPlayer(player.id);
      // Buying a drink improves the charm check
      player = { ...player, charm: player.charm + 3 }; // temporary for check only
    }

    // Charm-based outcome
    const roll = Math.random();
    const charmBonus = (player.charm || 10) / 100;

    if (roll < 0.15 + charmBonus) {
      // Best outcome: wonderful night
      const hpGain = player.hit_max - player.hit_points;
      await updatePlayer(player.id, { hit_points: player.hit_max, charm: Math.min(50, player.charm + 1) });
      player = await getPlayer(player.id);
      return res.json({ ...getTavernScreen(player, others), pendingMessages: [
        '`#She leans in close and whispers something that makes the room feel warmer.',
        '`#You wake the next morning feeling... remarkably well rested.',
        `\`0HP fully restored${hpGain > 0 ? ` (+${hpGain})` : ''}. Charm increased!`,
      ]});
    }

    if (roll < 0.40 + charmBonus) {
      // Gold stolen while distracted
      const stolen = Math.max(10, Math.floor(Number(player.gold) * 0.30));
      const safeStolen = Math.min(stolen, Number(player.gold));
      await updatePlayer(player.id, { gold: Number(player.gold) - safeStolen });
      player = await getPlayer(player.id);
      return res.json({ ...getTavernScreen(player, others), pendingMessages: [
        '`#The evening starts well enough. Conversation, laughter, another round...',
        '`@You wake up slumped in an alley behind the tavern.',
        `\`@Your purse is lighter by \`$${safeStolen.toLocaleString()}\`@ gold. You've been played.`,
        '`8Hrok shrugs when you ask. "She paid for her drinks. That\'s all I know."',
      ]});
    }

    // Bad outcome: she's not what she seems — fight!
    const monsterLevel = Math.max(1, player.level);
    const succubus = {
      name: 'Succubus', weapon: 'claws',
      strength: 20 + monsterLevel * 8,
      defense: 5 + monsterLevel * 2,
      currentHp: 40 + monsterLevel * 15,
      maxHp: 40 + monsterLevel * 15,
      behavior: 'aggressive',
    };

    const { playerWon, playerHpLeft, log } = resolveBrawl(player, succubus);

    if (playerWon) {
      const goldReward = 50 + monsterLevel * 20;
      await updatePlayer(player.id, {
        hit_points: playerHpLeft,
        gold: Number(player.gold) + goldReward,
        charm: Math.max(1, player.charm - 1),
      });
      player = await getPlayer(player.id);
      await addNews(`\`#${player.handle}\`% survived a \`#succubus\`% encounter at the The Rusted Flagon!`);
      return res.json({ ...getTavernScreen(player, others), pendingMessages: [
        '`#Her smile becomes something terrible. The shadows around her deepen.',
        '`@The woman\'s form twists — claws, wings, a shriek that splits the air!',
        ...log,
        '`0You drive her back! She dissolves into shadow with a hiss.',
        `\`$The scattered patrons toss you \`$${goldReward.toLocaleString()}\`$ gold for the show.`,
      ]});
    } else {
      await updatePlayer(player.id, { hit_points: Math.max(1, Math.floor(player.hit_max * 0.15)) });
      player = await getPlayer(player.id);
      return res.json({ ...getTavernScreen(player, others), pendingMessages: [
        '`#Her smile becomes something terrible. The shadows around her deepen.',
        '`@The woman\'s form twists — claws, wings, a shriek that splits the air!',
        ...log,
        '`@She escapes into the night, leaving you battered on the tavern floor.',
        '`8Hrok pours cold water on you. "Told you she looked trouble."',
      ]});
    }
  },

  // ── 2. The Hooded Merchant ──────────────────────────────────────────────────
  hooded_merchant: async (player, param, req, res, pendingMessages) => {
    const others = await (require('../db').getAllPlayers)();

    if (param === 'refuse') {
      return res.json({ ...getTavernScreen(player, others), pendingMessages: [
        '`8The merchant shrugs, tucks the box away, and vanishes into the crowd.',
        '`7You\'ll never know what was in there.',
      ]});
    }

    const cost = param === 'haggle' ? 100 : 200;

    if (param === 'haggle' && player.class !== 3) {
      return res.json({ ...getTavernScreen(player, others), pendingMessages: [
        '`@The merchant\'s eyes narrow. "I don\'t deal with amateurs. Full price or nothing."',
      ]});
    }

    if (Number(player.gold) < cost) {
      return res.json({ ...getTavernScreen(player, others), pendingMessages: [
        `\`@You don't have ${cost} gold. The merchant eyes you with contempt and leaves.`,
      ]});
    }

    await updatePlayer(player.id, { gold: Number(player.gold) - cost });
    player = await getPlayer(player.id);

    const roll = Math.random();

    if (roll < 0.35) {
      // Gem
      await updatePlayer(player.id, { gems: player.gems + 1 });
      player = await getPlayer(player.id);
      return res.json({ ...getTavernScreen(player, others), pendingMessages: [
        '`8You open the box slowly. Inside, nestled in black velvet...',
        '`!A perfectly cut gem catches the candlelight.',
        '`0You gained 1 gem! The merchant is already gone.',
      ]});
    }

    if (roll < 0.60) {
      // Stat boost
      const boost = 2 + Math.floor(Math.random() * 3);
      await updatePlayer(player.id, { strength: player.strength + boost });
      player = await getPlayer(player.id);
      return res.json({ ...getTavernScreen(player, others), pendingMessages: [
        '`8You open the box. Inside is a small vial of dark liquid.',
        '`7A label in cramped script reads: "Drink before battle."',
        `\`0You drink it. A warmth spreads through your sword arm. Strength +${boost}!`,
      ]});
    }

    if (roll < 0.80) {
      // Gold windfall
      const found = cost * 2;
      await updatePlayer(player.id, { gold: Number(player.gold) + found });
      player = await getPlayer(player.id);
      return res.json({ ...getTavernScreen(player, others), pendingMessages: [
        '`8The box is heavier than it looks. Inside — coins. Many coins.',
        `\`$\`$${found.toLocaleString()} gold\`% — more than you paid. The merchant had no idea what he had.`,
      ]});
    }

    // Cursed item — lose HP
    const curseDmg = Math.floor(player.hit_max * 0.25);
    await updatePlayer(player.id, { hit_points: Math.max(1, player.hit_points - curseDmg) });
    player = await getPlayer(player.id);
    return res.json({ ...getTavernScreen(player, others), pendingMessages: [
      '`8The box springs open on its own. A black mist pours out.',
      '`@A cold numbness spreads through your chest. You\'ve been cursed.',
      `\`@You lost ${curseDmg} HP. The merchant knew exactly what he had.`,
    ]});
  },

  // ── 3. The Dying Soldier ────────────────────────────────────────────────────
  dying_soldier: async (player, param, req, res, pendingMessages) => {
    const others = await (require('../db').getAllPlayers)();

    if (param === 'ignore') {
      return res.json({ ...getTavernScreen(player, others), pendingMessages: [
        '`8You slip out before anyone notices you were there.',
        '`7Behind you, a chair scrapes as someone goes to help the fallen man.',
        '`8Whatever he knew died with him.',
      ]});
    }

    if (param === 'help') {
      const expGain = player.level * 30;
      const charmGain = 1;
      await updatePlayer(player.id, {
        exp: Number(player.exp) + expGain,
        charm: Math.min(50, player.charm + charmGain),
      });
      player = await getPlayer(player.id);
      return res.json({ ...getTavernScreen(player, others), pendingMessages: [
        '`0You call for help. Hrok brings water and bandages.',
        '`%The soldier\'s breathing steadies. He may survive the night.',
        `\`$Your selfless act earns you ${expGain.toLocaleString()} exp and +1 charm.`,
        '`7In his delirium he mutters something about "gold... buried under the old oak..."',
      ]});
    }

    // Listen — treasure map
    const goldBonus = 100 + player.level * 50;
    const expGain = player.level * 50;
    await updatePlayer(player.id, {
      gold: Number(player.gold) + goldBonus,
      exp: Number(player.exp) + expGain,
    });
    player = await getPlayer(player.id);
    return res.json({ ...getTavernScreen(player, others), pendingMessages: [
      '`7He pulls you close, his voice barely a whisper.',
      '`%"North of the third clearing... a hollow oak... I left everything there..."',
      '`8His grip loosens. By the time the barkeep arrives, he\'s gone.',
      `\`$You slip out and find the location at first light. \`$${goldBonus.toLocaleString()}\`$ gold\`% and the knowledge earns you ${expGain.toLocaleString()} exp.`,
    ]});
  },

  // ── 4. The Card Sharp ───────────────────────────────────────────────────────
  card_sharp: async (player, param, req, res, pendingMessages) => {
    const others = await (require('../db').getAllPlayers)();

    if (param === 'refuse') {
      return res.json({ ...getTavernScreen(player, others), pendingMessages: [
        '`7You shake your head. The card sharp shrugs and looks for another mark.',
      ]});
    }

    const betMap = { low: 50, high: 200 };
    const bet = betMap[param] || 50;
    const payout = param === 'low' ? 100 : 400;

    if (Number(player.gold) < bet) {
      return res.json({ ...getTavernScreen(player, others), pendingMessages: [
        `\`@You don't have ${bet} gold to bet. The card sharp loses interest.`,
      ]});
    }

    // Thief gets +15% win chance
    const winChance = player.class === 3 ? 0.52 : 0.37;
    const playerCard = Math.floor(Math.random() * 13) + 1;
    const houseCard  = Math.floor(Math.random() * 13) + 1;
    const cardNames  = ['', 'A','2','3','4','5','6','7','8','9','10','J','Q','K'];

    await updatePlayer(player.id, { gold: Number(player.gold) - bet });
    player = await getPlayer(player.id);

    const won = Math.random() < winChance || playerCard > houseCard;

    if (won) {
      await updatePlayer(player.id, { gold: Number(player.gold) + payout });
      player = await getPlayer(player.id);
      return res.json({ ...getTavernScreen(player, others), pendingMessages: [
        `\`6You draw: \`$${cardNames[playerCard]}\`6   He draws: \`@${cardNames[houseCard]}`,
        `\`0You win! The card sharp slides \`$${payout.toLocaleString()}\`0 gold across the table.`,
        player.class === 3 ? '`3Your trained eye spotted the tell. He never had a chance.' : '',
      ].filter(Boolean)});
    }

    return res.json({ ...getTavernScreen(player, others), pendingMessages: [
      `\`6You draw: \`$${cardNames[playerCard]}\`6   He draws: \`@${cardNames[houseCard]}`,
      `\`@You lose. The card sharp pockets your \`$${bet.toLocaleString()}\`@ gold with a sympathetic smile.`,
      '`8"Better luck next time, friend. Another hand?"',
    ]});
  },

  // ── 5. The Crying Widow ─────────────────────────────────────────────────────
  crying_widow: async (player, param, req, res, pendingMessages) => {
    const others = await (require('../db').getAllPlayers)();

    if (param === 'ignore') {
      return res.json({ ...getTavernScreen(player, others), pendingMessages: [
        '`8You look away. Her quiet weeping follows you as you leave.',
        '`7Some things aren\'t your problem. You tell yourself that.',
      ]});
    }

    if (param === 'comfort') {
      const gift = Math.min(Number(player.gold), 50 + player.level * 10);
      await updatePlayer(player.id, {
        gold: Number(player.gold) - gift,
        charm: Math.min(50, player.charm + 2),
        exp: Number(player.exp) + player.level * 25,
      });
      player = await getPlayer(player.id);
      return res.json({ ...getTavernScreen(player, others), pendingMessages: [
        '`%You sit with her a while. You don\'t say much — there\'s nothing to say.',
        `\`$You leave ${gift.toLocaleString()} gold with her. She takes it without a word.`,
        '`#Her gratitude is quiet but genuine. +2 charm.',
        `\`0You gain ${(player.level * 25).toLocaleString()} experience for your compassion.`,
      ]});
    }

    // Avenge — start quest
    if (player.quest_id && player.quest_id !== '') {
      return res.json({ ...getTavernScreen(player, others), pendingMessages: [
        '`7You already have matters that demand your attention.',
        '`8She nods sadly. "Another time, perhaps."',
      ]});
    }

    await updatePlayer(player.id, {
      quest_id: 'widow_revenge',
      quest_step: 1,
      quest_data: JSON.stringify({ level: player.level }),
    });
    player = await getPlayer(player.id);
    return res.json({ ...getTavernScreen(player, others), pendingMessages: [
      '"His name was Aldric," she says, voice steadying with something colder than grief.',
      '"He was hunting near the old creek. Something found him first."',
      '`$You swear to avenge Aldric. Find the creature that killed him in the forest.',
      '`$[QUEST STARTED: Widow\'s Revenge — slay a forest creature for bonus rewards]',
    ]});
  },

  // ── 6. The Old Veteran ──────────────────────────────────────────────────────
  old_veteran: async (player, param, req, res, pendingMessages) => {
    const others = await (require('../db').getAllPlayers)();

    if (param === 'ignore') {
      return res.json({ ...getTavernScreen(player, others), pendingMessages: [
        '`8The old soldier watches you go, then turns back to his drink.',
        '`7Some wisdom goes unshared.',
      ]});
    }

    if (param === 'buy') {
      if (Number(player.gold) < 25) {
        return res.json({ ...getTavernScreen(player, others), pendingMessages: [
          "`@You don't have 25 gold for a drink.",
          '`8The old soldier nods knowingly. "Hard times. I\'ve been there."',
          '`7He tells you a little anyway. Not much, but something.',
        ]});
      }
      await updatePlayer(player.id, { gold: Number(player.gold) - 25 });
      player = await getPlayer(player.id);
    }

    // Random veteran wisdom — one of several outcomes
    const tips = [
      {
        msg: [
          '`7"Defense is survival," he says, tracing a scar on his jaw.',
          '`%"Every point of armour is a fight you didn\'t have to win with HP."',
          '`0His words sharpen your focus. +1 Defense today.',
        ],
        update: { defense: player.defense + 1 },
      },
      {
        msg: [
          '`7"You know what kills more warriors than monsters?" he asks.',
          '`%"Charging in tired. Watch your stamina. That\'s the real weapon."',
          `\`0His advice steadies you. +${player.level * 20} experience from the lesson.`,
        ],
        update: { exp: Number(player.exp) + player.level * 20 },
      },
      {
        msg: [
          '`7He leans close. "The forest has patterns. Learn them."',
          '`%"Certain creatures always flee when wounded. Let them tire themselves out."',
          '`0His tactical insight is valuable. +2 Strength for the day.',
        ],
        update: { strength: player.strength + 2 },
      },
      {
        msg: [
          '`7He drinks deeply, then laughs — a dry, rattling sound.',
          '`%"I had a horse once. Best partner I ever had. Better than any of my wives."',
          '`8He falls asleep mid-sentence. The drink was perhaps not his first.',
          '`7You learn nothing useful. But the story was worth it.',
        ],
        update: {},
      },
    ];

    const tip = tips[Math.floor(Math.random() * tips.length)];
    if (Object.keys(tip.update).length) await updatePlayer(player.id, tip.update);
    player = await getPlayer(player.id);

    return res.json({ ...getTavernScreen(player, others), pendingMessages: tip.msg });
  },

  // ── 7. The Thief in the Night ───────────────────────────────────────────────
  thief_in_night: async (player, param, req, res, pendingMessages) => {
    const others = await (require('../db').getAllPlayers)();
    const goldAtRisk = Math.max(10, Math.floor(Number(player.gold) * 0.15));

    if (param === 'let_go') {
      await updatePlayer(player.id, { gold: Math.max(0, Number(player.gold) - goldAtRisk) });
      player = await getPlayer(player.id);
      return res.json({ ...getTavernScreen(player, others), pendingMessages: [
        '`8You watch the figure slip out the side door.',
        `\`@You lost ${goldAtRisk.toLocaleString()} gold. Lesson learned — keep your pouch inside your shirt.`,
      ]});
    }

    if (param === 'shout') {
      const caught = Math.random() < 0.50;
      if (caught) {
        await addNews(`\`3${player.handle}\`% caught a pickpocket at the The Rusted Flagon!`);
        return res.json({ ...getTavernScreen(player, others), pendingMessages: [
          '`6"THIEF!" The whole tavern turns.',
          '`0Hrok vaults the bar and grabs the figure before they reach the door.',
          `\`$The thief drops your gold and more besides — you recover \`$${goldAtRisk.toLocaleString()}\`$ gold\`% plus a bonus \`$${Math.floor(goldAtRisk * 0.5).toLocaleString()}\`$ from what they had on them.`,
        ]});
      }
      return res.json({ ...getTavernScreen(player, others), pendingMessages: [
        '`6"THIEF!" A few people look up, but the crowd is thick.',
        `\`@The figure slips out before anyone reacts. You lost ${goldAtRisk.toLocaleString()} gold.`,
      ]});
    }

    // Chase
    // Thief class is better at this
    const catchChance = player.class === 3 ? 0.80 : 0.45 + (player.charm / 200);

    if (Math.random() < catchChance) {
      const bonus = Math.floor(goldAtRisk * 0.75);
      await updatePlayer(player.id, { gold: Number(player.gold) + bonus });
      player = await getPlayer(player.id);
      return res.json({ ...getTavernScreen(player, others), pendingMessages: [
        '`3You weave through the crowd like smoke, cutting off every exit.',
        '`3The thief runs straight into a wall. Literally.',
        `\`$You recover your gold and relieve them of a bonus \`$${bonus.toLocaleString()}\`$ gold\`% for the trouble.`,
        player.class === 3 ? '`3Takes one to catch one.' : '',
      ].filter(Boolean)});
    }

    await updatePlayer(player.id, { gold: Math.max(0, Number(player.gold) - goldAtRisk) });
    player = await getPlayer(player.id);
    return res.json({ ...getTavernScreen(player, others), pendingMessages: [
      '`7You push through the crowd but lose the figure in the alley maze outside.',
      `\`@They got away with ${goldAtRisk.toLocaleString()} gold. Slippery devil.`,
    ]});
  },

};

// ── Weighted random selection ─────────────────────────────────────────────────

function pickEncounter(player) {
  const eligible = TAVERN_ENCOUNTERS.filter(e =>
    e.minLevel <= player.level &&
    e.id !== player.last_encounter_id
  );
  if (!eligible.length) return null;

  const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const encounter of eligible) {
    roll -= encounter.weight;
    if (roll <= 0) return encounter;
  }
  return eligible[eligible.length - 1];
}

module.exports = { TAVERN_ENCOUNTERS, RESOLVERS, pickEncounter };
