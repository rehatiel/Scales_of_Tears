// Forest events and monster ASCII art for LORD web port
// Non-combat random encounters in the forest

// ─────────────────────────────────────────────────────────────────────────────
//  MONSTER ART
//  Each entry: 6 lines, max 20 chars wide, padded to consistent width.
//  Colors use the engine color keys: dgreen, dred, dcyan, brown, magenta,
//  dgray, red, cyan, yellow, white, green, gray
// ─────────────────────────────────────────────────────────────────────────────

const MONSTER_ART = {

  goblin: {
    color: 'dgreen',
    lines: [
      "   ,^   ^,         ",
      "  (>o   o<)        ",
      "  .'-{=}-.         ",
      "  /|  )(  |\\      ",
      " (_/ /  \\ \\_)     ",
      "   /_|  |_\\        ",
    ],
  },

  orc: {
    color: 'dgreen',
    lines: [
      "  ,-[====]-,       ",
      " (| O    O |)      ",
      " {|  >==<  |}      ",
      "  \\| |  | |/      ",
      " _||        ||_    ",
      "// \\        / \\\\  ",
    ],
  },

  bandit: {
    color: 'brown',
    lines: [
      "  ,----------,     ",
      " / .-. .-.    \\    ",
      "(  ( -   - )   )   ",
      " \\ '---^---'  /   ",
      "  [##########]     ",
      " /|  |     |  |\\  ",
    ],
  },

  skeleton: {
    color: 'white',
    lines: [
      "   ,-( )---,       ",
      "  ( O)   (O)       ",
      "   '-( )( )-'      ",
      "   --|    |--      ",
      "  (_/ \\  / \\_)    ",
      "  /|        |\\    ",
    ],
  },

  zombie: {
    color: 'dgreen',
    lines: [
      "  ,----------,     ",
      " ( X  )  (  X)     ",
      "  |  (----)  |     ",
      "\\-|  |    |  |-/  ",
      "  |  |    |  |     ",
      " /|__|    |__|\\ .  ",
    ],
  },

  wraith: {
    color: 'dgray',
    lines: [
      "  .~(      )~.     ",
      " ~   (*  *)   ~    ",
      "  ~--(    )--~     ",
      "    ~  \\  /  ~    ",
      "   ~    \\/    ~   ",
      " ~    /    \\    ~  ",
    ],
  },

  wolf: {
    color: 'dgray',
    lines: [
      "  ,--. ,--.        ",
      " ( o ) ( o )       ",
      "  )-( ^ )-(        ",
      " (   '---'  )      ",
      "  \\         /     ",
      "   V         V     ",
    ],
  },

  bear: {
    color: 'brown',
    lines: [
      "-(   )---(   )-    ",
      "( o   .   o  )     ",
      " '-----------'     ",
      "/| [#######] |\\   ",
      "(               )  ",
      " '-----------'     ",
    ],
  },

  spider: {
    color: 'dgray',
    lines: [
      "  -\\  |||  /-      ",
      "   -\\ ||| /-       ",
      "   --(o.o)--       ",
      "   --( ^ )--       ",
      "  -/   |   \\-     ",
      " -/    |    \\-    ",
    ],
  },

  dragon: {
    color: 'red',
    lines: [
      " /\\   .---.   /\\   ",
      "/__\\ ( o o ) /__\\  ",
      "|   ( ===== )   |  ",
      " \\__|         |__/ ",
      "    |         |    ",
      "   /|_________|\\   ",
    ],
  },

  demon: {
    color: 'dred',
    lines: [
      " /\\ ,-, /\\         ",
      "(<< (v v) >>)      ",
      " '--'---'--'       ",
      " |  /||| \\  |     ",
      " | ( ||| ) |       ",
      " |_/  |   \\_|     ",
    ],
  },

  golem: {
    color: 'dgray',
    lines: [
      "  .----------.     ",
      "  | [#]  [#] |     ",
      "  |  [####]  |     ",
      "  |----------|     ",
      " /|           |\\  ",
      "[_|___________|_]  ",
    ],
  },

  giant: {
    color: 'brown',
    lines: [
      "  ,----------,     ",
      " ( O        O)     ",
      " (  --------  )    ",
      " /| ||||||||  |\\  ",
      "/  | ||||||||  | \\ ",
      "   |__|    |__|    ",
    ],
  },

  knight: {
    color: 'dgray',
    lines: [
      "  ,-[#####]-,      ",
      " ( [# . . #] )     ",
      "  '-[#####]-'      ",
      "  |[#######]|      ",
      "  |[#######]|      ",
      "  |_|     |_|      ",
    ],
  },

  wizard: {
    color: 'cyan',
    lines: [
      "    ,/\\,           ",
      "   / ** \\          ",
      "  / *  * \\         ",
      " ( .----. )        ",
      "  |  **  |   /     ",
      " (_|____|_) /      ",
    ],
  },

};

// ─────────────────────────────────────────────────────────────────────────────
//  FOREST EVENTS
//  Non-combat encounters triggered randomly in the forest.
//
//  Outcome properties (all optional):
//    goldFlat  : flat gold change (negative = lose gold)
//    goldMult  : gold gain = goldMult * player.level
//    expMult   : exp gain  = expMult  * player.level
//    hp        : flat HP change (negative = take damage; can be lethal)
//    hpPct     : HP change as fraction of max HP (0.3 = heal 30%)
//    charm     : charm change (+/-)
//    gem       : gem count change
//    msg       : array of flavor lines displayed to the player
//    fight     : true = trigger a random monster fight immediately after
//    charmCheck: minimum charm required for a charm-gated choice to appear
// ─────────────────────────────────────────────────────────────────────────────

const FOREST_EVENTS = [

  // ── 1. THE OLD HERMIT (riddle / puzzle) ────────────────────────────────────
  {
    id: 'hermit_riddle',
    title: 'The Old Hermit',
    minLevel: 1,
    art: [
      "   _|_             ",
      "  (o_o)            ",
      "  /| |\\           ",
      " (_/ \\_)          ",
      "   | |             ",
      "  )~(~)~(          ",
    ],
    artColor: 'brown',
    intro: [
      'An ancient hermit crouches beside a dying fire, poking it with a stick.',
      'He squints up at you without fear.',
      '"Answer my riddle, warrior, and I shall reward you.',
      ' Fail, and I shall merely laugh."',
    ],
    choices: [
      { key: 'A', label: 'Answer: A Mountain',     param: 'correct'  },
      { key: 'B', label: 'Answer: A Shadow',        param: 'wrong'    },
      { key: 'G', label: 'Offer him 50 gold',       param: 'pay'      },
      { key: 'L', label: 'Walk away',               param: 'leave'    },
    ],
    riddleText: [
      '"The more you take, the more you leave behind.',
      ' What am I?"',
    ],
    outcomes: {
      correct: {
        goldMult: 80,
        expMult:  60,
        msg: [
          '"Footsteps! Hah! Well answered, warrior."',
          'He tosses you a worn but heavy coin purse and cackles with delight.',
        ],
      },
      wrong: {
        hp: -10,
        msg: [
          'The hermit slaps his knee and cackles.',
          '"Footsteps, fool! Footsteps! Now away with you -- that cost you your dignity AND your composure."',
          'You stumble away, flustered, and clip your shin on a root.',
        ],
      },
      pay: {
        goldFlat: -50,
        charm: 1,
        msg: [
          'The hermit pockets the coins without blinking.',
          '"Wise enough to pay rather than guess. I respect that."',
          'He mutters a quiet blessing over you. Your confidence grows.',
        ],
      },
      leave: {
        msg: [
          'You walk away without a word.',
          'The hermit watches you go, then returns to poking his fire.',
        ],
      },
    },
  },

  // ── 2. THE GLITTERING CHEST (treasure / trap) ──────────────────────────────
  {
    id: 'treasure_trap',
    title: 'A Glittering Chest',
    minLevel: 1,
    art: [
      "  .-----------.    ",
      "  |[=========]|   ",
      "  | * * * * * |   ",
      "  |___________|   ",
      "  |_[O]_[O]___|   ",
      "   \\_________/    ",
    ],
    artColor: 'yellow',
    intro: [
      'A small iron-banded chest sits in a clearing, lid slightly ajar.',
      'Coins wink at you from within.',
      'No tracks in the mud. No sign of its owner.',
      'It almost seems... too easy.',
    ],
    choices: [
      { key: 'O', label: 'Open it carefully',      param: 'careful'  },
      { key: 'K', label: 'Kick it open and grab',  param: 'kick'     },
      { key: 'L', label: 'Leave it alone',          param: 'leave'    },
    ],
    outcomes: {
      careful: {
        goldMult: 120,
        expMult:  30,
        msg: [
          'You ease the lid up slowly, feeling for trip-wires.',
          'A dart pings harmlessly off a nearby tree -- you just avoided it.',
          'Inside: a solid heap of gold coins and a handful of gems.',
        ],
        gem: 1,
      },
      kick: {
        goldMult: 150,
        hp: -25,
        msg: [
          'You boot the chest open with gusto.',
          'SNAP -- a spring-loaded blade catches you across the arm!',
          'It still hurts, but the gold inside is very much worth it... mostly.',
        ],
      },
      leave: {
        expMult: 20,
        msg: [
          'You walk away.',
          'Behind you, a faint mechanical CLICK sounds. Then silence.',
          'Probably wise.',
        ],
      },
    },
  },

  // ── 3. THE WOUNDED TRAVELLER (moral choice NPC) ────────────────────────────
  {
    id: 'wounded_traveller',
    title: 'A Wounded Traveller',
    minLevel: 1,
    art: [
      "   o               ",
      "  /|\\             ",
      "  / \\             ",
      " /   \\            ",
      "~~~~~~~~~~~~~~~~~~~",
      "  . . .            ",
    ],
    artColor: 'brown',
    intro: [
      'A merchant lies bleeding at the base of a tree, clutching a wound in his side.',
      '"Please... bandits. They took everything. I just need to reach the town."',
      'He eyes your coin pouch with desperate hope.',
    ],
    choices: [
      { key: 'H', label: 'Help him (give 75 gold)',     param: 'help'    },
      { key: 'T', label: 'Take his remaining goods',    param: 'steal'   },
      { key: 'L', label: 'Leave him be',                param: 'leave'   },
    ],
    outcomes: {
      help: {
        goldFlat: -75,
        charm:    2,
        expMult:  50,
        msg: [
          'You bind his wounds and press coin into his trembling hand.',
          '"Bless you, warrior. Bless you."',
          'Word of your kindness spreads. Your reputation grows.',
        ],
      },
      steal: {
        goldMult: 40,
        charm:    -2,
        fight:    true,
        msg: [
          'You rifle through his pack and pocket what little he has left.',
          'The merchant stares at you, then closes his eyes in despair.',
          'As you walk away, you hear footsteps -- his friends must be close.',
        ],
      },
      leave: {
        msg: [
          'You step over him and keep moving.',
          'The forest does not judge. But you know what you did.',
        ],
      },
    },
  },

  // ── 4. THE HEALING POOL (heal / hazard) ────────────────────────────────────
  {
    id: 'healing_pool',
    title: 'A Still Forest Pool',
    minLevel: 1,
    art: [
      "  ~~~~~~~~~~~      ",
      " ~  *       ~      ",
      "~ *    *      ~    ",
      " ~    *  *   ~     ",
      "  ~~~~~~~~~~~      ",
      "  ~ ~ ~ ~ ~        ",
    ],
    artColor: 'cyan',
    intro: [
      'You stumble upon a perfectly still forest pool.',
      'The water glows faintly from within -- blue-silver, like moonlight.',
      'An ancient inscription on a mossy stone reads:',
      '"To the worthy, restoration. To the greedy, ruin."',
    ],
    choices: [
      { key: 'D', label: 'Drink from the pool',          param: 'drink'    },
      { key: 'B', label: 'Bathe your wounds in it',      param: 'bathe'    },
      { key: 'F', label: 'Fill your flask (drink deep)', param: 'guzzle'   },
      { key: 'L', label: 'Leave it undisturbed',         param: 'leave'    },
    ],
    outcomes: {
      drink: {
        hpPct: 0.4,
        msg: [
          'You cup your hands and sip carefully.',
          'The water tastes of cold mountain streams and rain.',
          'A warm glow spreads through you. Your wounds close.',
        ],
      },
      bathe: {
        hpPct:   0.25,
        expMult: 20,
        msg: [
          'You kneel and press your injuries against the cool water.',
          'The light seeps into your wounds like dawn into shadow.',
          'You feel steadied, renewed, and oddly wiser.',
        ],
      },
      guzzle: {
        hpPct: 0.6,
        hp:    -30,
        msg: [
          'You plunge your face in and drink deeply -- far too deeply.',
          'The magic surges through you, mending and burning all at once.',
          'Your wounds close, but the power jolts your body hard.',
        ],
      },
      leave: {
        msg: [
          'You study the pool but do not touch it.',
          'The inscription probably means something. You back away slowly.',
        ],
      },
    },
  },

  // ── 5. THE FOREST SHRINE (blessing) ────────────────────────────────────────
  {
    id: 'forest_shrine',
    title: 'An Ancient Shrine',
    minLevel: 2,
    art: [
      "    _|_|_          ",
      "   [     ]         ",
      "   | *** |         ",
      "   |_____|         ",
      "  /       \\       ",
      " ___________       ",
    ],
    artColor: 'yellow',
    intro: [
      'Hidden among moss-covered stones, you find a small shrine.',
      'A carved face watches you from the altar -- ancient, neutral, waiting.',
      'A bowl of ash sits before it. Offerings have been left by others.',
    ],
    choices: [
      { key: 'P', label: 'Pray at the shrine',           param: 'pray'   },
      { key: 'O', label: 'Leave a gem as offering',      param: 'offer'  },
      { key: 'T', label: 'Take the old offerings',       param: 'take'   },
      { key: 'L', label: 'Move on',                      param: 'leave'  },
    ],
    outcomes: {
      pray: {
        hpPct:   0.2,
        expMult: 40,
        msg: [
          'You kneel and bow your head.',
          'A hush falls over the forest. Something ancient listens.',
          'You rise feeling lighter, clearer, more capable.',
        ],
      },
      offer: {
        gem:     -1,
        goldMult: 200,
        expMult:  100,
        charm:    1,
        msg: [
          'You place a gem in the bowl. It flares briefly with golden light.',
          'A warm wind moves through the trees despite the still air.',
          'The shrine rewards your faith with unexpected generosity.',
        ],
      },
      take: {
        goldFlat: 30,
        hp:       -20,
        charm:    -1,
        msg: [
          'You scoop up a handful of old coins from the altar.',
          'The carved face seems to frown. A branch falls, striking you hard.',
          'Coincidence, surely. Surely.',
        ],
      },
      leave: {
        msg: [
          'You nod at the carved face respectfully and walk on.',
          'The forest around you feels somehow gentler for a while.',
        ],
      },
    },
  },

  // ── 6. THE LOST WANDERER (NPC interaction) ─────────────────────────────────
  {
    id: 'lost_wanderer',
    title: 'A Lost Wanderer',
    minLevel: 1,
    art: [
      "    o              ",
      "   /|)             ",
      "   / \\            ",
      " _/   \\_          ",
      " |  ?  |           ",
      " -------           ",
    ],
    artColor: 'brown',
    intro: [
      'A young adventurer, clearly new to the forest, stands at a fork in the path.',
      'She looks equal parts terrified and determined.',
      '"I\'m trying to reach the Red Dragon\'s cave. Am I... close?"',
      'She is absolutely not close.',
    ],
    choices: [
      { key: 'G', label: 'Guide her back to town safely',  param: 'guide'  },
      { key: 'W', label: 'Warn her and send her back',     param: 'warn'   },
      { key: 'R', label: 'Rob her of her supplies',        param: 'rob'    },
      { key: 'L', label: 'Point deeper in and walk away',  param: 'lie'    },
    ],
    outcomes: {
      guide: {
        expMult: 60,
        charm:   2,
        msg: [
          'You walk her to the edge of the forest yourself.',
          '"Thank you! I\'ll come back when I\'m stronger. I promise."',
          'She presses a carved lucky charm into your hand.',
          'Your reputation for goodness spreads through town.',
        ],
        gem: 1,
      },
      warn: {
        expMult: 30,
        charm:   1,
        msg: [
          '"Turn around. Follow the sun west. Do not stop."',
          'She nods, eyes wide, and goes.',
          'You watch her until she disappears between the trees.',
        ],
      },
      rob: {
        goldMult: 50,
        charm:    -3,
        fight:    true,
        msg: [
          'You take her rations and coin purse.',
          'She stares at you, then runs.',
          'You hear her shout something behind you. The forest grows restless.',
        ],
      },
      lie: {
        goldFlat: 0,
        charm:    -1,
        msg: [
          '"Just keep going that way. Can\'t miss it."',
          'You walk away. You try not to think about it.',
          'You mostly succeed.',
        ],
      },
    },
  },

  // ── 7. THE WITCH'S BARGAIN (witch / hag trade) ─────────────────────────────
  {
    id: 'witch_bargain',
    title: "The Witch's Bargain",
    minLevel: 3,
    art: [
      "  /\\  /\\           ",
      " (  \\/  )          ",
      "  \\-##-/           ",
      "   |  |            ",
      " __|  |__          ",
      "(__|  |__)          ",
    ],
    artColor: 'magenta',
    intro: [
      'A hunched woman blocks the path, stirring something in a pot that smells of old pennies.',
      '"I know what you want, warrior," she says without looking up.',
      '"Power. Gold. Life. I can offer all three. For a price."',
      'Her eyes, when she finally meets yours, are entirely black.',
    ],
    choices: [
      { key: 'P', label: 'Buy power (costs 200 gold)',     param: 'power'  },
      { key: 'G', label: 'Buy gold (costs 1 gem)',         param: 'gold'   },
      { key: 'H', label: 'Buy healing (costs 150 gold)',   param: 'heal'   },
      { key: 'R', label: 'Refuse and walk away',           param: 'refuse' },
    ],
    outcomes: {
      power: {
        goldFlat: -200,
        expMult:  150,
        hpPct:    -0.15,
        msg: [
          'She ladles something dark into your mouth before you can reconsider.',
          'It burns like swallowed coals. Your veins surge with terrible power.',
          'The knowledge comes at a cost -- you feel slightly diminished.',
        ],
      },
      gold: {
        gem:      -1,
        goldMult:  300,
        msg: [
          'You hand over the gem. She holds it to the light, then swallows it whole.',
          'She reaches into her pot and draws out a dripping sack of gold.',
          '"Good trade," she says. You are not entirely sure for whom.',
        ],
      },
      heal: {
        goldFlat: -150,
        hpPct:    0.8,
        msg: [
          'She hands you a vial of something the colour of a dying sunset.',
          'You drink it. Your body knits itself back together, painfully but completely.',
          '"Come back when you are broken again," she calls after you.',
        ],
      },
      refuse: {
        expMult: 20,
        msg: [
          '"Wise," she says, not unkindly.',
          '"Most aren\'t."',
          'She steps aside and you walk past. The pot keeps stirring on its own.',
        ],
      },
    },
  },

  // ── 8. THE ABANDONED CAMP (loot event) ─────────────────────────────────────
  {
    id: 'abandoned_camp',
    title: 'An Abandoned Camp',
    minLevel: 2,
    art: [
      "  /\\    /\\         ",
      " /  \\  /  \\       ",
      "/    \\/    \\      ",
      "|  []  []  |       ",
      "|____::____|       ",
      "   .  .  .         ",
    ],
    artColor: 'brown',
    intro: [
      'You come across a campsite, recently abandoned.',
      'Bedrolls are still laid out. A fire has burned to cold ash.',
      'Whatever drove them away, it did so fast.',
      'Several packs and bundles are left behind.',
    ],
    choices: [
      { key: 'S', label: 'Search carefully',             param: 'search'   },
      { key: 'G', label: 'Grab and run quickly',         param: 'grab'     },
      { key: 'W', label: 'Wait and watch for the owner', param: 'wait'     },
      { key: 'L', label: 'Leave it all alone',           param: 'leave'    },
    ],
    outcomes: {
      search: {
        goldMult: 100,
        expMult:  40,
        gem:      1,
        msg: [
          'You comb through each pack methodically.',
          'Gold, a hidden gem, trail rations, and a small journal.',
          'The journal mentions a cache "beneath the flat stone east of camp."',
          'You find it. Today is your day.',
        ],
      },
      grab: {
        goldMult: 70,
        fight:    true,
        msg: [
          'You snatch the heaviest-looking packs and bolt.',
          'A shout rings out -- the owners weren\'t gone, just hiding!',
          'You keep the gold, but they\'re right behind you.',
        ],
      },
      wait: {
        expMult: 50,
        hpPct:   0.15,
        msg: [
          'You settle behind a tree and watch.',
          'After an hour, a figure returns -- a ranger, not a bandit.',
          '"I saw you wait. You\'re an honest one." He shares his meal.',
          'You share stories. You feel better for the rest.',
        ],
      },
      leave: {
        msg: [
          'You leave everything as you found it.',
          'The forest offers no reward for this.',
          'But you sleep easier that night.',
        ],
      },
    },
  },

  // ── 9. THE RAVEN OMEN (mysterious omen) ────────────────────────────────────
  {
    id: 'raven_omen',
    title: 'The Raven',
    minLevel: 1,
    art: [
      "    ___            ",
      "  _/ o \\           ",
      " / \\___/           ",
      " \\ /  \\           ",
      "  V    V           ",
      " ~~~~^~~~~~        ",
    ],
    artColor: 'dgray',
    intro: [
      'A massive raven lands on a branch before you, fixing you with one golden eye.',
      'It opens its beak. What comes out is not a caw but a single clear word:',
      '"...SOON."',
      'Then it spreads its wings and waits.',
    ],
    choices: [
      { key: 'F', label: 'Follow the raven',              param: 'follow'  },
      { key: 'O', label: 'Offer it a piece of bread',     param: 'offer'   },
      { key: 'S', label: 'Shoo it away and carry on',     param: 'shoo'    },
    ],
    outcomes: {
      follow: {
        goldMult: 180,
        expMult:  90,
        fight:    true,
        msg: [
          'The raven hops ahead, leading you deeper into the trees.',
          'It stops at a lightning-blasted oak, then vanishes.',
          'At the base of the oak: a satchel packed with coin.',
          'Behind you, something very large snaps a branch.',
        ],
      },
      offer: {
        charm:   1,
        hpPct:   0.2,
        expMult: 40,
        msg: [
          'You crumble a bit of dried bread from your pack.',
          'The raven takes it delicately, then drops something in return.',
          'A small carved bone token -- a luck charm, old and powerful.',
          'You feel its warmth through your fingers.',
        ],
      },
      shoo: {
        msg: [
          '"Shoo. Get."',
          'The raven stares at you for a long, long moment.',
          'Then it flies away.',
          '"Soon," you hear, very faintly, from somewhere far above.',
        ],
      },
    },
  },

  // ── 10. THE BANDIT TOLL (bandit toll event) ────────────────────────────────
  {
    id: 'bandit_toll',
    title: 'The Toll Road',
    minLevel: 2,
    art: [
      " ---|-----|---      ",
      "    |>--<-|         ",
      "    |$$$$$|         ",
      "    |_____|         ",
      "  -/-------\\-      ",
      "  ___________       ",
    ],
    artColor: 'dred',
    intro: [
      'Three bandits step from the treeline, blocking the path.',
      'The largest crosses his arms. The others finger their weapons.',
      '"Hundred gold. For the privilege of walking OUR road."',
      'They look confident. They\'ve done this before.',
    ],
    choices: [
      { key: 'P', label: 'Pay the toll (100 gold)',        param: 'pay'      },
      { key: 'F', label: 'Fight your way through',         param: 'fight'    },
      { key: 'N', label: 'Negotiate (charm check)',        param: 'charm'    },
      { key: 'R', label: 'Back away into the trees',       param: 'retreat'  },
    ],
    outcomes: {
      pay: {
        goldFlat: -100,
        msg: [
          'You count out the coins. They stand aside.',
          '"Smart," says the big one.',
          'You walk through with your life and your dignity intact.',
          'Mostly.',
        ],
      },
      fight: {
        fight:    true,
        expMult:  80,
        goldMult: 120,
        hp:       -20,
        msg: [
          'You draw your weapon. The bandits grin -- then stop grinning.',
          'It\'s a rough fight. You take a hit.',
          'But you leave them on the ground and their gold in your pocket.',
        ],
      },
      charm: {
        charmCheck: 8,
        goldFlat:    0,
        expMult:     60,
        charm:       1,
        msg: [
          '"You know, I once ran with a crew just like yours."',
          'You spin a tale that is two parts truth and eight parts nonsense.',
          'The big bandit squints... then laughs and waves you through.',
          '"Good story, warrior. On your way."',
        ],
        charmFail: {
          fight:    true,
          hp:       -15,
          msg: [
            'You try to talk your way through, but the words come out wrong.',
            '"Nice try." He shoves you. You shove back.',
            'It goes downhill from there.',
          ],
        },
      },
      retreat: {
        expMult: 15,
        msg: [
          'You back slowly into the treeline, eyes on them.',
          'They don\'t follow -- not worth it.',
          'You take a longer path around. It costs you time.',
          'You arrive safely, if somewhat humbled.',
        ],
      },
    },
  },


  // ── 11. THE WANDERING MERCHANT (general) ───────────────────────────────────
  {
    id: 'wandering_merchant',
    title: 'The Wandering Merchant',
    minLevel: 1,
    art: [
      "  _________        ",
      " |  [CART] |       ",
      " | [] [] []|       ",
      " |_________|       ",
      "  O       O        ",
      "  ~~~ ~~~ ~~~      ",
    ],
    artColor: 'brown',
    intro: [
      'A traveling merchant has parked a small wooden cart in a sunlit clearing.',
      'Bundles of herbs, trinkets, and mysterious parcels hang from every hook.',
      '"Step right up, traveler! Forest wares -- sourced local, priced fair!"',
      'He grins through a salt-and-pepper beard.',
    ],
    choices: [
      { key: 'H', label: 'Buy healing herbs (30 gold)',   param: 'herbs'   },
      { key: 'C', label: 'Buy a lucky charm (1 gem)',     param: 'charm'   },
      { key: 'I', label: 'Haggle for information',        param: 'haggle'  },
      { key: 'L', label: 'Move on',                       param: 'leave'   },
    ],
    outcomes: {
      herbs: {
        goldFlat: -30,
        hpPct:    0.30,
        msg: [
          'You hand over the coin and pocket a bundle of fragrant forest herbs.',
          'They work fast -- your wounds ease, your step lightens.',
        ],
      },
      charm: {
        gem:     -1,
        charm:    2,
        expMult:  20,
        msg: [
          'The merchant produces a small carved fox from beneath his coat.',
          '"Carved under a full moon. Good for luck, better for love."',
          'You feel its warmth in your palm. Something about you feels... charmed.',
        ],
      },
      haggle: {
        expMult: 30,
        msg: [
          'You spend a quarter-hour haggling and learn more than the price.',
          'The merchant lowers his voice: "There\'s a patrol of undead two leagues east.',
          ' Came through last night. Stripped two traders."',
          'You file the warning away. It may save your life.',
        ],
      },
      leave: {
        msg: [
          'You wave him off and keep walking.',
          '"Come back anytime!" he calls after you cheerfully.',
        ],
      },
    },
  },

  // ── 12. THE MUSHROOM RING (fae magic) ──────────────────────────────────────
  {
    id: 'mushroom_ring',
    title: 'The Mushroom Ring',
    minLevel: 2,
    art: [
      " * . * . * .       ",
      ".  _   _   _  .    ",
      "* (_) (_) (_) *    ",
      ".  *   *   *  .    ",
      " * . * . * .       ",
      "  * . * . * .      ",
    ],
    artColor: 'magenta',
    intro: [
      'A perfect circle of luminous mushrooms pulses with faint purple light.',
      'The air inside smells of rain and old magic.',
      'Fae magic -- every woodsman knows the signs.',
      'A blue one. A red one. They glow brighter as you approach.',
    ],
    choices: [
      { key: 'B', label: 'Eat the blue mushroom',        param: 'safe'    },
      { key: 'R', label: 'Eat the glowing red one',      param: 'risky'   },
      { key: 'D', label: 'Dance in the ring',            param: 'dance'   },
      { key: 'P', label: 'Pocket some mushrooms',        param: 'pocket'  },
      { key: 'L', label: 'Leave respectfully',           param: 'leave'   },
    ],
    outcomes: {
      safe: {
        hpPct: 0.3,
        charm: 1,
        msg: [
          'The blue mushroom dissolves on your tongue like cold dew.',
          'Your wounds knit shut. A gentle warmth settles in your chest.',
          'The ring hums approvingly. You feel at peace -- briefly.',
        ],
      },
      risky: {
        hpPct:  0.5,
        hp:     -40,
        poison: true,
        msg: [
          'The red one burns. Then everything burns.',
          'Power floods through you -- tremendous, chaotic, painful.',
          'Your wounds close but something foul lingers in your blood.',
          'Poison, probably. Worth it? Unclear.',
        ],
      },
      dance: {
        expMult: 80,
        msg: [
          'You step inside the ring and begin to move.',
          'Time passes strangely. Minutes or hours -- impossible to say.',
          'When you stop, you feel wiser. The forest seems to know you better.',
        ],
      },
      pocket: {
        gem:   1,
        fight: true,
        msg: [
          'You reach down and snap off a handful of the glowing caps.',
          'The light goes out. The air turns cold.',
          'The fae do not appreciate that.',
        ],
      },
      leave: {
        msg: [
          'You bow your head slightly and step back.',
          'The ring pulses once -- acknowledgment, perhaps -- and returns to its slow glow.',
        ],
      },
    },
  },

  // ── 13. THE TALKING SKULL (cryptic wisdom) ─────────────────────────────────
  {
    id: 'talking_skull',
    title: 'The Talking Skull',
    minLevel: 3,
    art: [
      "     _____         ",
      "    / o o \\        ",
      "   |  ___  |       ",
      "   \\_______/      ",
      "      |||          ",
      "   __|_|__         ",
    ],
    artColor: 'dgray',
    intro: [
      'A yellowed skull is mounted on a wooden stake at the path\'s edge.',
      'Its jaw clicks as you approach.',
      '"You," it says, in a voice like dry leaves.',
      '"I\'ve been waiting for someone interesting."',
    ],
    choices: [
      { key: 'D', label: 'Ask about forest dangers',     param: 'danger'  },
      { key: 'T', label: 'Ask about hidden treasure',    param: 'treasure'},
      { key: 'F', label: 'Ask about your fate',          param: 'fate'    },
      { key: 'S', label: 'Smash the skull',              param: 'smash'   },
      { key: 'L', label: 'Walk away',                    param: 'leave'   },
    ],
    outcomes: {
      danger: {
        expMult: 50,
        msg: [
          '"Something large. Patient. Been circling for three days."',
          '"It smells iron. It smells you."',
          '"Next time you hear breathing -- run first."',
          'You will think about that for longer than you\'d like.',
        ],
      },
      treasure: {
        goldMult: 150,
        expMult:   30,
        msg: [
          'The skull recites a string of compass directions, a landmark, a depth.',
          'You follow them exactly.',
          'The cache is exactly where it said. Unsettlingly precise.',
        ],
      },
      fate: {
        charm: 1,
        hpPct: 0.15,
        msg: [
          '"You will survive today. Beyond that, I don\'t promise."',
          '"But you have more road in you than most I\'ve met."',
          '"Walk carefully. Eat something. You look terrible."',
          'Oddly comforting, from a skull.',
        ],
      },
      smash: {
        fight:    true,
        goldFlat:  20,
        msg: [
          'You bring your weapon down on the stake.',
          'The skull shatters. The coins from its hollow interior scatter.',
          'The air tears open. A guardian spirit rises to avenge it.',
          'You probably should have seen that coming.',
        ],
      },
      leave: {
        msg: [
          '"Come back when you have better questions!" it calls after you.',
          'You do not come back.',
        ],
      },
    },
  },

  // ── 14. THE RIVER CROSSING (environmental obstacle) ────────────────────────
  {
    id: 'river_crossing',
    title: 'The River Crossing',
    minLevel: 1,
    art: [
      "~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~",
      "   |         |      ",
      "~~~|_________|~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~",
    ],
    artColor: 'cyan',
    intro: [
      'A wide, fast-flowing river cuts across the path.',
      'A rickety wooden bridge spans it -- boards missing, ropes fraying.',
      'The current below is white and loud.',
      'Something green and squat shifts beneath the bridge.',
    ],
    choices: [
      { key: 'C', label: 'Cross carefully',               param: 'careful' },
      { key: 'S', label: 'Swim across',                   param: 'swim'    },
      { key: 'B', label: 'Bribe the bridge troll',        param: 'bribe'   },
      { key: 'F', label: 'Fight the bridge troll',        param: 'fight'   },
    ],
    outcomes: {
      careful: {
        expMult: 20,
        hpPct:   0.05,
        msg: [
          'You test each board before trusting it with your weight.',
          'Three times a plank groans -- three times you shift aside.',
          'You make it across. Your nerves are frayed but your body is whole.',
          'The far bank feels somehow reinvigorating.',
        ],
      },
      swim: {
        hp:      -15,
        expMult:  40,
        msg: [
          'You plunge in. The cold hits you like a closed fist.',
          'The current is stronger than it looks -- far stronger.',
          'You fight it every inch. You make it. Just.',
          'Soaked, bruised, and oddly proud.',
        ],
      },
      bribe: {
        goldFlat: -80,
        msg: [
          'You crouch and hold a handful of coins over the edge.',
          'A small green hand reaches up and takes them without a word.',
          'You cross. Every board holds. Every rope holds.',
          'You don\'t look down.',
        ],
      },
      fight: {
        fight:    true,
        goldMult:  100,
        hp:       -10,
        msg: [
          'You step onto the bridge and call it out.',
          'It comes up swinging. Low, fast, ugly.',
          'You take a hit before putting it down.',
          'Its hoard is worth the bruise.',
        ],
      },
    },
  },

  // ── 15. THE ANCIENT MAP (treasure hunt) ────────────────────────────────────
  {
    id: 'ancient_map',
    title: 'The Ancient Map',
    minLevel: 2,
    art: [
      "  __________       ",
      " /  ~ * ~   \\     ",
      "|  N   [X]   |     ",
      "|   \\ /      |    ",
      " \\___________/    ",
      "  ___________      ",
    ],
    artColor: 'yellow',
    intro: [
      'A waterproof scroll case is wedged in the crack of a mossy boulder.',
      'You work it free. Inside: a detailed parchment map of this forest,',
      'drawn with careful ink and annotated in three languages.',
      'Near your current position, someone has marked a bold, unmistakable X.',
    ],
    choices: [
      { key: 'F', label: 'Follow the map now',            param: 'follow'  },
      { key: 'S', label: 'Study it carefully',            param: 'study'   },
      { key: 'E', label: 'Sell it in town',               param: 'sell'    },
      { key: 'L', label: 'Leave it for the next traveler',param: 'leave'   },
    ],
    outcomes: {
      follow: {
        goldMult: 200,
        expMult:   50,
        fight:     true,
        msg: [
          'The map leads you through unmarked paths to a mossy cache.',
          'Coin, provisions, and a quality blade -- a well-stocked hiding spot.',
          'Someone else is already there.',
          'They do not look pleased to have company.',
        ],
      },
      study: {
        expMult: 80,
        charm:    1,
        msg: [
          'You spend time tracing every path, every landmark.',
          'The forest starts to make sense -- how it breathes, where it hides things.',
          'You memorize the paths. You feel more confident in here.',
        ],
      },
      sell: {
        goldFlat: 150,
        msg: [
          'You tuck the case under your arm and mark it for sale.',
          'A merchant in town will pay well for a map this detailed.',
          'You\'re right. They do.',
        ],
      },
      leave: {
        expMult: 25,
        charm:    1,
        msg: [
          'You tuck the case back into the crack, snug as you found it.',
          'Someone else may need this more than you.',
          'The thought sits quietly warm in your chest for a while.',
        ],
      },
    },
  },

  // ── 16. THE SMUGGLER'S CACHE (Thief only) ──────────────────────────────────
  {
    id: 'smugglers_cache',
    title: "The Smuggler's Cache",
    minLevel:  2,
    classOnly: 3,
    art: [
      "  [=] [=] [=]      ",
      " /___________\\    ",
      " | [#] [#] [#]|    ",
      " |___________|     ",
      "  ~~~~~~~~~~~      ",
      "     >             ",
    ],
    artColor: 'brown',
    intro: [
      'You stop. Your eyes trace the chalk mark on the flat stone.',
      'An arrowhead. Guild marks. You\'ve left a hundred like it yourself.',
      'This section of forest belongs to the Smuggler\'s Road.',
      'The cache is close -- you know exactly what to look for.',
    ],
    choices: [
      { key: 'C', label: 'Claim the cache',               param: 'claim'   },
      { key: 'M', label: 'Leave a message for allies',    param: 'message' },
      { key: 'T', label: 'Set a trap for the next one',   param: 'trap'    },
      { key: 'L', label: 'Walk away',                     param: 'leave'   },
    ],
    outcomes: {
      claim: {
        goldMult: 180,
        gem:       1,
        msg: [
          'You know exactly where to look -- old habits.',
          'Three loose stones. A false bottom. A locked box with a lock you recognize.',
          'Gold and a cut gem. Someone saved well.',
          'Their loss.',
        ],
      },
      message: {
        charm:   2,
        expMult: 40,
        msg: [
          'You scratch a warning into the stone: patrol activity, two leagues north.',
          'A small thing. The kind of thing that keeps people alive.',
          'Your reputation in the underground grows -- quietly, invisibly.',
          'As it should.',
        ],
      },
      trap: {
        expMult: 60,
        fight:   true,
        msg: [
          'You rig a hair-trigger snare across the approach.',
          'Clever. Neat. Professional.',
          'The mark comes sooner than expected.',
          'They\'re already in it before you can decide what to do next.',
        ],
      },
      leave: {
        msg: [
          'You walk past without touching it.',
          'Not your road today.',
        ],
      },
    },
  },

  // ── 17. THE MAGE TOWER RUINS (Mystic only) ─────────────────────────────────
  {
    id: 'mage_tower_ruins',
    title: 'The Mage Tower Ruins',
    minLevel:  3,
    classOnly: 2,
    art: [
      "  ___|___          ",
      " |  * *  |         ",
      " | *   * |         ",
      " |_______|         ",
      " /*~*~*~*~\\       ",
      "_____________      ",
    ],
    artColor: 'cyan',
    intro: [
      'Crumbled stone walls jut from the forest floor like broken teeth.',
      'Arcane energies still crackle between the stones -- pale blue, unstable.',
      'You feel it before you see it: raw magic, uncontained, very much alive.',
      'A lesser practitioner would run. You are not lesser.',
    ],
    choices: [
      { key: 'C', label: 'Channel the residual energy',   param: 'channel'   },
      { key: 'S', label: 'Search the ruins',              param: 'search'    },
      { key: 'T', label: 'Stabilize the magic',           param: 'stabilize' },
      { key: 'I', label: 'Study the inscriptions',        param: 'study'     },
      { key: 'L', label: 'Leave it alone',                param: 'leave'     },
    ],
    outcomes: {
      channel: {
        expMult: 200,
        hpPct:   -0.20,
        msg: [
          'You open yourself to it. All of it.',
          'Raw arcane power surges through you -- painful, clarifying, enormous.',
          'Your mind expands. Your body pays the price.',
          'Illuminating. And terrible. Worth it.',
        ],
      },
      search: {
        goldMult: 150,
        gem:       1,
        expMult:   50,
        msg: [
          'You pick through rubble with practiced care.',
          'A cracked wand. A sealed vial. A cache of old coin behind a false stone.',
          'The gem was hidden inside the wand\'s pommel. Clever.',
        ],
      },
      stabilize: {
        expMult: 100,
        charm:     2,
        hpPct:    0.15,
        msg: [
          'You work carefully, weaving containment threads through the loose energy.',
          'It resists. You are patient. It yields.',
          'The wild crackle fades to a steady hum.',
          'The forest around the ruins feels calmer. So do you.',
        ],
      },
      study: {
        expMult: 80,
        msg: [
          'You trace the inscriptions with two fingers, reading as you go.',
          'Ancient formulae -- some theoretical, some dangerously practical.',
          'Useful knowledge fills the spaces between your thoughts.',
          'Some of it, you realize, is genuinely dangerous. Good.',
        ],
      },
      leave: {
        msg: [
          'You step back from the crackling edge and walk away.',
          'The ruins hum behind you for a long time.',
        ],
      },
    },
  },

  // ── 18. THE DARK ALTAR (Death Knight only) ─────────────────────────────────
  {
    id: 'dark_altar',
    title: 'The Dark Altar',
    minLevel:  3,
    classOnly: 1,
    art: [
      "  .---------.      ",
      "  |  * * *  |      ",
      "  | =-+-=+= |      ",
      "  |_________|      ",
      " /~~~~~~~~~~~\\    ",
      "_______________    ",
    ],
    artColor: 'dred',
    intro: [
      'A black stone altar rises from the earth, slick with old blood.',
      'Dark runes pulse with a cold, slow fire.',
      'You recognize it. More than that -- you recognize it in yourself.',
      'It has been waiting. It knew you would come.',
    ],
    choices: [
      { key: 'O', label: 'Make a blood offering',         param: 'offer'   },
      { key: 'A', label: 'Absorb the dark power',         param: 'absorb'  },
      { key: 'D', label: 'Destroy the altar',             param: 'destroy' },
      { key: 'L', label: 'Ignore it',                     param: 'leave'   },
    ],
    outcomes: {
      offer: {
        hpPct:   -0.25,
        expMult:  300,
        msg: [
          'You draw the blade across your palm without hesitation.',
          'The altar drinks deep. The runes blaze white-cold.',
          'The power flows back tenfold. Pain is just weakness leaving the body.',
          'You feel very, very alive.',
        ],
      },
      absorb: {
        hpPct:    -0.15,
        charm:     -1,
        goldMult:  200,
        msg: [
          'You press both palms to the stone and pull.',
          'The darkness fills you like cold iron poured into a mould.',
          'Coins materialize from the altar\'s hollow base -- tribute from the dead.',
          'You feel terrible. And unstoppable.',
        ],
      },
      destroy: {
        fight:   true,
        expMult:  100,
        charm:     2,
        msg: [
          'You bring your weapon down on the stone with everything you have.',
          'The altar cracks. The runes scream.',
          'The trapped spirits rise to defend it.',
          'They are not happy. Neither are you. This is fine.',
        ],
      },
      leave: {
        msg: [
          'You walk past without touching it.',
          'The altar pulses once as you pass.',
          'It will be here when you return.',
        ],
      },
    },
  },

  // ── 19. THE STORM WARNING (weather event) ──────────────────────────────────
  {
    id: 'storm_warning',
    title: 'The Storm Warning',
    minLevel: 1,
    art: [
      " __   ___   __     ",
      "(  \\_/   \\_/  )  ",
      " \\____________/   ",
      "   / \\ / \\        ",
      "  *   *   *        ",
      " /|\\ /|\\ /|\\     ",
    ],
    artColor: 'dgray',
    intro: [
      'The sky turns the colour of a bruise.',
      'Lightning cracks at the forest edge. The wind picks up, sharp and cold.',
      'A storm is coming -- fast, low, and mean.',
      'You have maybe five minutes to decide.',
    ],
    choices: [
      { key: 'S', label: 'Find shelter quickly',          param: 'shelter' },
      { key: 'P', label: 'Press on through the storm',    param: 'press'   },
      { key: 'W', label: 'Wait it out in the open',       param: 'wait'    },
      { key: 'K', label: 'Look for another fighter',      param: 'seek'    },
    ],
    outcomes: {
      shelter: {
        hpPct:   0.20,
        expMult:  20,
        msg: [
          'You move fast, scanning the treeline.',
          'A hollow oak -- big enough, dry enough, just in time.',
          'The storm hammers the forest for an hour.',
          'You sit dry, warm, and oddly peaceful. You needed this.',
        ],
      },
      press: {
        fight:   true,
        expMult:  60,
        hp:       -10,
        msg: [
          'You put your head down and walk into it.',
          'The storm hammers you. You hammer back.',
          'You push through the worst of it -- and blunder straight into a fight.',
          'Of course you do.',
        ],
      },
      wait: {
        hp:      -20,
        expMult:  30,
        msg: [
          'You find a wide trunk and crouch behind it. Not enough.',
          'You are soaked. Then chilled. Then miserable.',
          'You also have a lot of time to think.',
          'Mixed results, overall.',
        ],
      },
      seek: {
        hpPct:  0.10,
        charm:   1,
        msg: [
          'You call out. Someone calls back.',
          'A grizzled ranger with a small fire and a dry overhang.',
          '"Room for one more," she says without looking up.',
          'She has stories. You have time. It\'s a good trade.',
        ],
      },
    },
  },

  // ── 20. THE WOUNDED KNIGHT (moral choice NPC) ──────────────────────────────
  {
    id: 'wounded_knight',
    title: 'The Wounded Knight',
    minLevel: 2,
    art: [
      "  .-[###]-.        ",
      " ( [#   #] )       ",
      "  '--[#]--'        ",
      "  |[#####]|        ",
      "  |_/ * \\_|       ",
      "   \\______/        ",
    ],
    artColor: 'dgray',
    intro: [
      'A knight in battered armour is propped against a fallen tree, breathing hard.',
      'A broken lance lies nearby. On his chest: the sigil of Harood.',
      '"Ambushed," he manages. "Didn\'t... see them coming."',
      'He is alive. For now.',
    ],
    choices: [
      { key: 'H', label: 'Give him your healing herbs',   param: 'heal'    },
      { key: 'G', label: 'Help him back to town',         param: 'guide'   },
      { key: 'A', label: 'Ask about the forest',          param: 'ask'     },
      { key: 'T', label: 'Take his sword and leave',      param: 'steal'   },
      { key: 'L', label: 'Leave him',                     param: 'leave'   },
    ],
    outcomes: {
      heal: {
        goldFlat: 0,
        hpPct:    -0.10,
        charm:     3,
        expMult:   60,
        msg: [
          'You tear strips from your own kit to bind his wounds.',
          'He grabs your arm before you can stand.',
          '"Come find me in town. I won\'t forget this."',
          'You believe him. Your reputation soars.',
        ],
      },
      guide: {
        expMult:  80,
        charm:     2,
        goldMult:  100,
        msg: [
          'You get under his arm and start walking.',
          'He is heavy. The road is long. He talks the whole way.',
          'At the town gate he presses a fistful of coin into your hand.',
          '"Tell no one how you found me," he says. You agree.',
        ],
      },
      ask: {
        expMult: 40,
        msg: [
          'Between gasps he lays it out: a patrol, ambushed half a league deeper in.',
          '"Six of them. Maybe eight. They\'re still there."',
          '"Don\'t go that way without a plan."',
          'Good advice from someone who didn\'t follow it.',
        ],
      },
      steal: {
        goldMult:  60,
        charm:     -3,
        fight:     true,
        msg: [
          'You relieve him of his sword and purse.',
          'He watches you go with something colder than anger.',
          'You\'re ten strides away when a shout rings from the treeline.',
          'His squire. Coming fast.',
        ],
      },
      leave: {
        msg: [
          'You step past him and keep walking.',
          'He calls after you. You keep walking.',
          'The forest closes behind you.',
        ],
      },
    },
  },

];

module.exports = { MONSTER_ART, FOREST_EVENTS };
