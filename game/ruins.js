// Ruins — fixed locations, one-time per player per day, choice-based encounters
// Accessible from the town screen via [U] Explore Ruins
// ruins_visited (JSON array on player) tracks which were visited today (reset in newday)

const RUINS = {

  // ── Dawnmark ─────────────────────────────────────────────────────────────────
  dawnmark: {
    id: 'dawnmark_ruin',
    name: 'The Old Watchtower',
    tagline: 'A collapsed guard tower on the edge of town. Older than the town itself.',
    intro: [
      'The old watchtower leans at an angle that defies its own weight.',
      'Iron sconces still hold the ghosts of torches. Someone carved dates into the stone.',
      'The oldest date is before any living record of this town.',
    ],
    choices: [
      { key: 'C', label: 'Climb to the top',          param: 'climb' },
      { key: 'S', label: 'Search the base',            param: 'search' },
      { key: 'R', label: 'Read the carved inscriptions', param: 'read' },
      { key: 'L', label: 'Leave',                      param: 'leave' },
    ],
    outcomes: {
      climb: {
        expMult: 80, charm: 1,
        msg: [
          'The climb is treacherous — the stairs end halfway up.',
          'You haul yourself through the gap by a rope of braided vines.',
          'The view from the top is extraordinary. The entire frontier is visible.',
          'You feel something shift in your understanding of this land.',
        ],
      },
      search: {
        goldMult: 200, gem: 1,
        msg: [
          'The base stones have shifted over centuries. Gaps beneath.',
          'You wedge yourself in and find a tin box sealed with wax.',
          'Inside: coin so old the markings are worn smooth, and one perfect gem.',
        ],
      },
      read: {
        expMult: 60,
        msg: [
          'The inscriptions are a watch log. Names and patrol routes.',
          'The last entry: "Something in the forest tonight. Do not go alone."',
          'It is not dated.',
          'You absorb the knowledge and feel sharper for it.',
        ],
      },
      leave: {
        msg: [
          'You study the tower from the outside for a moment.',
          'It watches you back.',
        ],
      },
    },
  },

  // ── Silverkeep ───────────────────────────────────────────────────────────────
  silverkeep: {
    id: 'silverkeep_ruin',
    name: 'The Shattered Keep',
    tagline: 'A fortress that fell in a siege no history book records.',
    intro: [
      'The keep\'s walls are split as if by something from within.',
      'The stones are scorched from the inside. Whatever happened, it started there.',
      'A single intact room remains — a solar with a stone table and a sword embedded in the floor.',
    ],
    choices: [
      { key: 'P', label: 'Pull the sword from the floor', param: 'pull' },
      { key: 'E', label: 'Examine the scorching',         param: 'examine' },
      { key: 'O', label: 'Offer a prayer at the table',   param: 'pray' },
      { key: 'L', label: 'Leave',                         param: 'leave' },
    ],
    outcomes: {
      // pull: handled by handleSwordPull() in ruins handler (randomised outcomes)
      examine: {
        expMult: 100,
        msg: [
          'The scorch marks are not fire. The pattern is wrong for fire.',
          'They radiate from a single point at the table\'s centre.',
          'Something was here. Something left in a hurry. Outward.',
          'The knowledge of what you\'re looking at unsettles you — and makes you wiser.',
        ],
      },
      pray: {
        charm: 2, hpPct: 0.30, alignDelta: 10,
        msg: [
          'You bow your head at the stone table.',
          'Silence. Then: warmth. As if something approves.',
          'You rise healed, and somehow more yourself.',
        ],
      },
      leave: {
        msg: [
          'The keep watches you leave.',
          'The sword stands in the floor.',
          'It waits.',
        ],
      },
    },
  },

  // ── Thornreach ───────────────────────────────────────────────────────────────
  thornreach: {
    id: 'thornreach_ruin',
    name: 'The Druid Circle',
    tagline: 'Standing stones older than language. Still active.',
    intro: [
      'Thirteen standing stones in a perfect circle. No tools could have placed them.',
      'The ground between the stones is springy and green even in winter.',
      'A low hum fills the air — not wind. Something else.',
    ],
    choices: [
      { key: 'E', label: 'Enter the circle',               param: 'enter' },
      { key: 'T', label: 'Touch the central stone',        param: 'touch' },
      { key: 'O', label: 'Leave an offering in the grass', param: 'offer' },
      { key: 'L', label: 'Leave it undisturbed',           param: 'leave' },
    ],
    outcomes: {
      enter: {
        hpPct: 0.50, expMult: 100,
        msg: [
          'You step between the stones.',
          'The hum intensifies — and then resolves into a sound almost like words.',
          'You cannot translate them. But your body seems to understand.',
          'Your wounds close. Your weariness lifts. The circle breathes.',
        ],
      },
      touch: {
        expMult: 150, charm: 1,
        msg: [
          'Your hand meets the stone — and the stone pushes back.',
          'Not violently. More like a heartbeat.',
          'You feel the age of it through your palm. Thousands of years. Still awake.',
          'Something of that patience enters you.',
        ],
      },
      offer: {
        goldFlat: -20, expMult: 80, charm: 2, alignDelta: 10,
        msg: [
          'You lay a coin in the grass between two stones.',
          'The grass closes over it.',
          'You hear nothing. But you feel watched — not in malice. In recognition.',
        ],
      },
      leave: {
        msg: [
          'You circle the stones at a respectful distance.',
          'The hum neither rises nor falls.',
          'The stones do not care if you stay or go. They\'ll be here either way.',
        ],
      },
    },
  },

  // ── Frostmere ─────────────────────────────────────────────────────────────────
  frostmere: {
    id: 'frostmere_ruin',
    name: 'The Frozen Shrine',
    tagline: 'A temple sealed under ice for an age. Still lit from within.',
    intro: [
      'A temple the size of a house is encased in a solid block of ancient ice.',
      'Through the ice you can see interior lanterns — still burning after all this time.',
      'A crack in the ice, just wide enough to enter sideways.',
    ],
    choices: [
      { key: 'E', label: 'Enter through the crack',     param: 'enter' },
      { key: 'I', label: 'Study from outside the ice',  param: 'study' },
      { key: 'M', label: 'Melt a section to look in',   param: 'melt' },
      { key: 'L', label: 'Leave it sealed',             param: 'leave' },
    ],
    outcomes: {
      enter: {
        hpPct: -0.15, expMult: 120, gem: 1,
        msg: [
          'The cold inside the ice is absolute — not like winter, like something older.',
          'The lanterns burn with pale blue fire that gives no heat.',
          'On the altar: a gem perfectly preserved for centuries.',
          'You take it. Your extremities thank you as you exit.',
        ],
      },
      study: {
        expMult: 80,
        msg: [
          'You press your forehead to the ice and look.',
          'The temple is intact. The altar is set for a ceremony never completed.',
          'The god it was built for does not appear to have arrived.',
          'The knowledge of this place settles into you like cold water.',
        ],
      },
      melt: {
        goldMult: 300, expMult: 60, hpPct: -0.10,
        msg: [
          'You chip and pry and melt and sweat until a larger gap opens.',
          'It takes hours. The cold takes a toll.',
          'Inside, you find offerings the worshippers never retrieved.',
          'Old and cold and, after so long, quite valuable.',
        ],
      },
      leave: {
        msg: [
          'You leave it sealed.',
          'Some things deserve their rest.',
          'The lanterns continue to burn behind you.',
        ],
      },
    },
  },

  // ── Velmora ────────────────────────────────────────────────────────────────
  velmora: {
    id: 'velmora_ruin',
    name: "The Merchant's Tomb",
    tagline: 'A wealthy merchant buried his fortune with him. He was wrong to think that would keep it safe.',
    intro: [
      "The tomb of the Grand Merchant Veth, who died insisting he'd take it all with him.",
      'He could not, in fact, take it all with him. But he could hide it very well.',
      'Three false doors face you in the entrance hall. One is real.',
    ],
    choices: [
      { key: 'A', label: 'Try the left door',   param: 'left'   },
      { key: 'B', label: 'Try the middle door', param: 'middle' },
      { key: 'C', label: 'Try the right door',  param: 'right'  },
    ],
    outcomes: {
      left: {
        goldMult: 400, expMult: 80,
        msg: [
          'The left door grinds open.',
          'Beyond: a vault. It has been partially looted, but only partially.',
          'You take what\'s left. It\'s quite a lot.',
        ],
      },
      middle: {
        hp: -20, expMult: 60,
        msg: [
          'The middle door swings open.',
          'The trap behind it does not miss.',
          'You survive. The bolt misses your vitals. Barely.',
          'You retreat to the entrance, poorer and wiser.',
        ],
      },
      right: {
        hp: -10, goldMult: 500, expMult: 100,
        msg: [
          'The right door has a trap — but a well-prepared one you disarm first.',
          'Beyond: the main vault. Veth was wealthier than the records showed.',
          'You take your fill and leave, carrying more than you came with.',
        ],
      },
    },
  },

  // ── Ashenfall ─────────────────────────────────────────────────────────────────
  ashenfall: {
    id: 'ashenfall_ruin',
    name: 'The Ashen Temple',
    tagline: 'A temple that burned from within. The god it housed did not survive.',
    intro: [
      'The temple\'s walls still radiate warmth even now.',
      'The murals inside show a god of fire receiving worship — then giving nothing back.',
      'The altar is scorched black. Something was burned on it. Something large.',
    ],
    choices: [
      { key: 'E', label: 'Leave an offering on the altar', param: 'offer'  },
      { key: 'S', label: 'Search the scorched debris',     param: 'search' },
      { key: 'R', label: 'Read the murals carefully',      param: 'read'   },
      { key: 'L', label: 'Leave',                         param: 'leave'  },
    ],
    outcomes: {
      offer: {
        goldFlat: -30, strDelta: 8, alignDelta: -10,
        msg: [
          'You place coin on the altar.',
          'The gold melts immediately. The flame that consumes it is not natural.',
          '`@Something stirs. Something accepts.',
          '`$+8 Strength. `@−10 Alignment. The old fire is not a kind one.',
        ],
      },
      search: {
        goldMult: 350, expMult: 60,
        msg: [
          'The debris yields what fire couldn\'t destroy — mostly metal.',
          'Votive offerings, intact. Gold settings without their stones.',
          'You gather what you can and leave the rest to the ash.',
        ],
      },
      read: {
        expMult: 120, charm: 1,
        msg: [
          'The murals tell a story you haven\'t read in any history.',
          'The god of this temple traded power for worship.',
          'It fell when the worshippers asked for more than they gave.',
          'The lesson is there if you want it.',
        ],
      },
      leave: {
        msg: [
          'You walk out of the temple.',
          'The warmth follows you, faintly, for a while.',
        ],
      },
    },
  },

  // ── Old Karth ─────────────────────────────────────────────────────────────────
  old_karth: {
    id: 'old_karth_ruin',
    name: 'The Buried Tomb',
    tagline: 'Separate from the mines. Older. Someone sealed it from the outside.',
    intro: [
      'A low stone door half-buried in a hillside, sealed with three separate locks.',
      'Two locks are rusted open. The third is new.',
      'Someone was here recently. The footprints lead away — not toward the mines.',
    ],
    choices: [
      { key: 'P', label: 'Pick the lock and enter',    param: 'enter'  },
      { key: 'F', label: 'Force it open',              param: 'force'  },
      { key: 'S', label: 'Study the door\'s markings', param: 'study'  },
      { key: 'L', label: 'Leave it sealed',            param: 'leave'  },
    ],
    outcomes: {
      enter: {
        goldMult: 300, gem: 1, expMult: 100,
        msg: [
          'The lock is old-design. You work it open in minutes.',
          'Inside: a burial chamber with intact offerings.',
          'The body is gone. The grave goods remain.',
          'You take what you came for.',
        ],
      },
      force: {
        goldMult: 200, expMult: 60, hp: -10, alignDelta: -10,
        msg: [
          'You break the lock. The door grinds open.',
          'Inside, something protective triggers — you take a hit.',
          'The chamber is plundered but not empty.',
          'Worth it. Mostly.',
        ],
      },
      study: {
        expMult: 120, charm: 1,
        msg: [
          'The markings are a warning — or an invitation, depending on your tradition.',
          'The new lock was placed by someone who knew what they were doing.',
          'They left a maker\'s mark. You file it away. Useful, someday.',
        ],
      },
      leave: {
        msg: [
          'You leave the sealed door to its secrets.',
          'The new lock catches the light.',
          'Someone will be back for it.',
        ],
      },
    },
  },

  // ── Graveport ─────────────────────────────────────────────────────────────────
  graveport: {
    id: 'graveport_ruin',
    name: 'The Sunken Chapel',
    tagline: 'A chapel to a sea god that the sea eventually reclaimed.',
    intro: [
      'Half the chapel is above the waterline. The other half is not.',
      'The pews still face the altar. The altar still faces the sea.',
      'Tide marks on the walls show the water was higher, once.',
    ],
    choices: [
      { key: 'D', label: 'Dive into the submerged section', param: 'dive'  },
      { key: 'P', label: 'Pray at the above-water altar',   param: 'pray'  },
      { key: 'S', label: 'Search the dry pews',             param: 'search' },
      { key: 'L', label: 'Leave',                           param: 'leave' },
    ],
    outcomes: {
      dive: {
        goldMult: 400, gem: 1, hp: -15, expMult: 80,
        msg: [
          'You take a breath and plunge into the black water.',
          'The submerged altar has offerings that never decomposed.',
          'You come up with a gem and more coin than you expected.',
          'The cold cost you.',
        ],
      },
      pray: {
        hpPct: 0.30, charm: 2, alignDelta: 10,
        msg: [
          'You kneel at the tilted altar.',
          'The sea god is not dead — just disinterested.',
          'But something stirs. Briefly. Enough to heal.',
          'You leave feeling the sea\'s neutrality, which is more than nothing.',
        ],
      },
      search: {
        goldMult: 150, expMult: 50,
        msg: [
          'The pews yield what the water didn\'t reach — mostly offerings.',
          'A few coins. A carved fishing charm. A wedding ring.',
          'You take the coin and leave the ring.',
        ],
      },
      leave: {
        msg: [
          'You stand in the doorway a moment.',
          'The tide comes in, as it always has.',
          'The chapel absorbs it without complaint.',
        ],
      },
    },
  },
};

function getRuin(townId) {
  return RUINS[townId] || null;
}

module.exports = { RUINS, getRuin };
