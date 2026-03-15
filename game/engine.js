// Screen generation engine for LORD web port
const { WEAPONS, ARMORS, expForNextLevel, CLASS_NAMES, CLASS_POWER_MOVES, MONSTER_TEMPLATES, getWeaponByNum, getArmorByNum } = require('./data');
const { MONSTER_ART } = require('./forest_events');

const c = {
  yellow:  '`$',
  white:   '`%',
  cyan:    '`!',
  green:   '`0',
  red:     '`@',
  magenta: '`#',
  blue:    '`9',
  gray:    '`7',
  dgray:   '`8',
  dblue:   '`1',
  dgreen:  '`2',
  dcyan:   '`3',
  dred:    '`4',
  brown:   '`6',
};

function fmt(n) { return Number(n).toLocaleString(); }
function pad(s, w) { return String(s).padEnd(w); }
function rpad(s, w) { return String(s).padStart(w); }

function hpColor(hp, max) {
  const pct = hp / max;
  if (pct > 0.6) return c.green;
  if (pct > 0.3) return c.yellow;
  return c.red;
}

function hpBar(current, max, width = 18) {
  const pct = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(pct * width);
  const empty = width - filled;
  const col = pct > 0.6 ? c.green : pct > 0.3 ? c.yellow : c.red;
  return col + '█'.repeat(filled) + c.dgray + '░'.repeat(empty) + c.gray;
}

// ── Location banners ──────────────────────────────────────────────────────────
// 7 lines × 62 chars, BBS/ANSI era style
const LOCATION_BANNERS = {
  title: {
    lines: [
      "+============================================================+",
      "|   ** L E G E N D   O F   T H E   R E D   D R A G O N **    |",
      "+============================================================+",
      "|                                                            |",
      "|         ~~ Seth Able's Classic BBS Door Game ~~            |",
      "|          Seek glory. Gain power. Face the Dragon.          |",
      "+============================================================+",
    ],
    colors: ['yellow','red','yellow','gray','white','gray','yellow'],
  },
  town: {
    lines: [
      "  ,--,  ,--,  ,--,  /=[HAROOD]=\\  ,--,  ,--,  ,--,            ",
      "  |##|  |##|  |##| |  _______  |  |##|  |##|  |##|            ",
      "  |  |  |  |  |  | |=[= GATE=]|  |  |  |  |  |  |             ",
      "  |[]|  |[]|  |[]| |  [=====] |  |[]|  |[]|  |[]|             ",
      "  +--+  +--+  +--+ |  [MARKET]|  +--+  +--+  +--+             ",
      "===================+===========+============================  ",
      "~-~-~-~-~-~-~-~ T O W N   O F   H A R O O D ~-~-~-~-~-~-~     ",
    ],
    colors: ['cyan','cyan','white','white','brown','brown','yellow'],
  },
  forest: {
    lines: [
      "* . * ) ( . * ) ( . * . ) ( * . ) ( . * . ) ( * . ) ( . *     ",
      " /|\\ /|\\ /|\\ /|\\ /|\\ /|\\ /|\\ /|\\ /|\\ /|\\ /|\\ /|\\ /|\\          ",
      "/|X|\\|X|\\|X|\\|X|\\  *  /|X|\\|X|\\|X|\\  *  /|X|\\|X|\\|X|\\         ",
      "||||||||||||||||||)(||||||||||||||||||)(|||||||||||||||||     ",
      "  Shadows crawl between the gnarled, ancient oaks...          ",
      "  Something watches from the dark.  It is not alone.          ",
      "~-~-~-~-~-~-~-~-~ T H E   D A R K   F O R E S T ~-~-~-~-~     ",
    ],
    colors: ['dgreen','dgreen','green','dgreen','gray','gray','yellow'],
  },
  weapon_shop: {
    lines: [
      "+================= IGNACIUS' WEAPON FORGE ===================+",
      "|  +====+    /\\    )  (   [ANVIL]   )  (    /\\   +====+      |",
      "|  | /\\ |   /  \\  /    \\ [#####]  /    \\  /  \\  | /\\ |       |",
      "|  |/  \\|  / ## \\/  /\\  \\[#####] /  /\\  \\/ ## \\ |/  \\|       |",
      "|  |\\  /|  \\ ## /\\ /  \\ /[=====]\\ /  \\ /\\ ## / |\\  /|        |",
      "|  | \\/ |   \\__/ \\/    \\/ [---]  \\/    \\/  \\__/  | \\/ |      |",
      "+=========[ SWORDS == AXES == MACES == BOWS ]================+",
    ],
    colors: ['yellow','white','white','white','white','white','brown'],
  },
  armor_shop: {
    lines: [
      "+============= ALDRIC'S FINE ARMOUR SHOPPE ==================+",
      "|  +-------+    _____      ( O )     _____   +-------+       |",
      "|  | (O)   |   / ___ \\    /|=|=\\    / ___ \\  | (O)   |       |",
      "|  |=======|  | | # | |   | |=| |  | | # | | |=======|       |",
      "|  |       |  | |___| |   | |=| |  | |___| | |       |       |",
      "|  |=======|   \\_____/    \\|=|=/    \\_____/  |=======|       |",
      "+========[ HELM ]==[ SHIELD ]==[ MAIL ]==[ PLATE ]===========+",
    ],
    colors: ['yellow','white','white','white','white','white','brown'],
  },
  inn: {
    lines: [
      "/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\      ",
      "/    [= THE  TRAVELLER'S  INN =]   ~warm and dry~            \\",
      "/  .~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\\",
      "| (*)(*) |   Welcome, weary traveller!   | (*)(*) |           ",
      "| [___]  |   Rest your bones. Eat well.  |  [___] |           ",
      "|________|   Drink. Be merry this night. |________|           ",
      "[== DOOR ==]~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[=== INN ===]",
    ],
    colors: ['brown','yellow','brown','white','white','white','brown'],
  },
  bank: {
    lines: [
      "+============= FIRST BANK OF HAROOD === Est. Year 247 =======+",
      "|  +----------+----------+----------+---------------------+  |",
      "|  | DEPOSIT  |  VAULT   |  COINS   |  SAFE DEPOSIT BOX   |  |",
      "|  +==========+==========+==========+=====================+  |",
      "|  | |  |  |  |  |  |   |  |  |    |  |  |  |  |  |  |  |    |",
      "|__|__|__|__|__|__|__|___|__|__|____|__|__|__|__|__|__|__|___|",
      "[===========[ GRAND  ENTRANCE ]==============================]",
    ],
    colors: ['yellow','white','white','white','white','white','brown'],
  },
  master: {
    lines: [
      "+============== SETH ABLE'S TRAINING GROUND =================+",
      "|  (  )   MASTER SETH     /\\    |    [TARGET]  [TARGET]      |",
      "|   -|-   *=========*    /  \\  _|    | [X]  |  | [X]  |      |",
      "|   |    |=========|    / ++ \\ \\  |  |------|  |------|      |",
      "|  / \\   |_________|   /______\\ \\ |  | |||  |  | |||  |      |",
      "| /   \\  |         |  /________\\ \\|  |------|  |------|      |",
      "+~[DOJO]~~[YARD]~~~~[OBSTACLES]~~~~[===== ARCHERY RANGE ===]~+",
    ],
    colors: ['yellow','white','white','white','white','white','brown'],
  },
  training: {
    lines: [
      "+============== SERGEANT GRIMWALD'S TRAINING YARD ===========+",
      "|  [STRAW DUMMY]      [SPARRING RING]      [WEAPON RACK]     |",
      "|     (o)           +---------------+    | | | | | |         |",
      "|    \\+/            | Recruits spar |    | | | | | |         |",
      "|    /|\\            |  every  dawn  |    | | | | | |         |",
      "|   / | \\           +---------------+   swords    spears     |",
      "+~[DUMMY]~~[POST]~~~[SPARRING RING]~~~[WEAPON RACK]~~~~~~~~~~+",
    ],
    colors: ['yellow','white','white','white','white','white','brown'],
  },
  tavern: {
    lines: [
      "+============ THE DARK CLOAK TAVERN === Ales 2gp ============+",
      "|____________________________________________________________|",
      "| @  @  @  @    [mug] [mug] [mug]    [# BARREL #]            |",
      "|  \\/\\/\\/      -----------------------------------------     |",
      "| /\\  /\\ /\\    | Patrons avoid your eyes in here.   |        |",
      "|/  \\/  \\/  \\  | Smoke hangs heavy. Watch your back.|        |",
      "|[=== TABLE ===]~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[= BAR =]   |",
    ],
    colors: ['yellow','brown','brown','dgray','dgray','dgray','brown'],
  },
  garden: {
    lines: [
      "+~*~*~*~*~*~*~  VIOLET'S SECRET GARDEN  ~*~*~*~*~*~*~*~*~*~*~+",
      "  ,---.  ,---.  ,---.   ,-----,   ,---.  ,---.  ,---.         ",
      " / * * \\/ @ @ \\/ ~ ~ \\ / roses \\ / * * \\/ @ @ \\/ ~ ~ \\        ",
      "| *   || @   ||  ~ ~  |         | *   || @   ||  ~ ~  |       ",
      " \\ * /  \\ @ /  \\ ~ /  \\       /  \\ * /  \\ @ /  \\ ~ /          ",
      "  `---'  `---'  `---'  `-------'  `---'  `---'  `---'         ",
      "+~~~~  A hidden paradise, blooming just for you.  ~~~~~+      ",
    ],
    colors: ['magenta','green','green','magenta','green','green','yellow'],
  },
  bard: {
    lines: [
      "+~*~.~*~.~*~.~  THE BARD'S CORNER  ~*~.~*~.~*~.~*~.~*~.~*~.~.+",
      "|  _________    ~ * ~ ~ * ~ ~ * ~ ~ * ~    _________         |",
      "| |  STAGE  |  ( note ) ( note ) ( note ) |  STAGE  |        |",
      "| |  ( O )  | (  ___  )(  ___  )(  ___  ) |  ( O )  |        |",
      "| |  --|--  | / /   \\ \\/ /   \\ \\/ /   \\ \\ |  --|--  |        |",
      "| |___|_|___| \\_\\___/ /\\_\\___/ /\\_\\___/ / |___|_|___|        |",
      "| [= LUTE =]  ~~ Tales of glory, love, and dragonfire ~~     |",
    ],
    colors: ['yellow','cyan','white','white','white','white','yellow'],
  },
  dragon: {
    lines: [
      "*-*-*-*-*-*  THE RED DRAGON'S LAIR  *-*-*   BEWARE!  *-*-*-*-*",
      "   (  )       ,----.  ,----.  ,----.      )  (     (  )       ",
      " (  )  )   ,-'       `--------'       `-.  )  (   )  )        ",
      "(=====( )-( ENTER   HERE   IF   YOU   DARE )-( )======( )=    ",
      " (  )  )   `-.__________________________.-'  )  (   )  )      ",
      "   (  )       `~~~~~` )( `~~~~~` )( `~~~~~`   (  )            ",
      "*-* ~~ FIRE.   CLAWS.   DEATH.   THE RED DRAGON AWAITS. ~~*-*-",
    ],
    colors: ['red','dred','dred','red','dred','dred','yellow'],
  },
  news: {
    lines: [
      "+============================================================+",
      "|  +------------------------------------------------------+  |",
      "|  |   HAROOD HERALD  --  Official Town Chronicle         |  |",
      "|  |   'All the news that's fit to cry in the streets'    |  |",
      "|  |                                                      |  |",
      "|  +------------------------------------------------------+  |",
      "|  Town Crier: 'HEAR YE, HEAR YE!  Read all about it!'       |",
    ],
    colors: ['yellow','white','cyan','gray','gray','white','brown'],
  },
  character: {
    lines: [
      "+============================================================+",
      "|  +------------------------------------------------------+  |",
      "|  |         *  CHARACTER  RECORD  SHEET  *               |  |",
      "|  |      Legend of the Red Dragon  --  Official Roll     |  |",
      "|  |                                                      |  |",
      "|  +------------------------------------------------------+  |",
      "+====================[ YOUR  LEGEND ]========================+",
    ],
    colors: ['cyan','cyan','yellow','gray','gray','cyan','yellow'],
  },
};

function renderBanner(key) {
  const banner = LOCATION_BANNERS[key] || LOCATION_BANNERS.title;
  return banner.lines.map((line, i) => (c[banner.colors[i]] || c.white) + line);
}

// Map a monster name to its ASCII art entry
function getMonsterArt(name) {
  const n = name.toLowerCase();
  if (/goblin|kobold|gnome|gremlin|sprite/.test(n))          return MONSTER_ART.goblin;
  if (/orc|ogre|troll|brute/.test(n))                        return MONSTER_ART.orc;
  if (/bandit|brigand|outlaw|highwayman|rogue/.test(n))       return MONSTER_ART.bandit;
  if (/skeleton|skull|bone/.test(n))                         return MONSTER_ART.skeleton;
  if (/zombie|ghoul|ghast|revenant/.test(n))                 return MONSTER_ART.zombie;
  if (/wraith|specter|shade|ghost|phantom|wight|lich|undead/.test(n)) return MONSTER_ART.wraith;
  if (/vampire|nosferatu/.test(n))                           return MONSTER_ART.wraith;
  if (/wolf|hound|dog|fenris|werewolf/.test(n))              return MONSTER_ART.wolf;
  if (/bear|lion|tiger|panther|leopard/.test(n))             return MONSTER_ART.bear;
  if (/spider|scorpion|centipede|beetle/.test(n))            return MONSTER_ART.spider;
  if (/dragon|wyrm|wyvern|drake|serpent|hydra/.test(n))      return MONSTER_ART.dragon;
  if (/demon|devil|fiend|incubus|succubus/.test(n))          return MONSTER_ART.demon;
  if (/golem|elemental|gargoyle|construct/.test(n))          return MONSTER_ART.golem;
  if (/giant|titan|cyclops|ettin/.test(n))                   return MONSTER_ART.giant;
  if (/knight|paladin|templar|crusader|soldier|guard/.test(n)) return MONSTER_ART.knight;
  if (/wizard|mage|sorcerer|witch|warlock|necromancer/.test(n)) return MONSTER_ART.wizard;
  return MONSTER_ART.bandit; // default humanoid
}

function divider(char = '─', width = 62) {
  return c.dcyan + char.repeat(width) + c.white;
}

function buildScreen(title, lines, choices = [], opts = {}) {
  return { title, lines, choices, ...opts };
}

function getStatusBar(player) {
  const hpC = hpColor(player.hit_points, player.hit_max);
  const cls = CLASS_NAMES[player.class] || 'Unknown';
  const nextExp = expForNextLevel(player.level);
  const expStr = nextExp ? `${fmt(player.exp)}/${fmt(nextExp)}` : `${fmt(player.exp)} (CHAMPION)`;
  const stam = player.stamina ?? player.fights_left ?? 10;
  const stamC = stam > 6 ? c.green : stam > 3 ? c.yellow : c.red;
  return [
    divider(),
    `${c.yellow}  ${pad(player.handle, 24)}${c.gray}Class: ${c.cyan}${cls}`,
    `${c.gray}  HP: ${hpC}${fmt(player.hit_points)}${c.gray}/${c.white}${fmt(player.hit_max)}   ${c.gray}Gold: ${c.yellow}${fmt(player.gold)}   ${c.gray}Gems: ${c.cyan}${player.gems}`,
    `${c.gray}  Level: ${c.yellow}${player.level}   ${c.gray}Exp: ${c.green}${expStr}`,
    `${c.gray}  Weapon: ${c.white}${player.weapon_name}   ${c.gray}Armour: ${c.white}${player.arm_name}`,
    `${c.gray}  Stamina: ${hpBar(stam, 10, 10)} ${stamC}${stam}${c.gray}/10${stam === 0 ? c.red + '  ☆ EXHAUSTED' : ''}`,
    (player.poisoned || 0) > 0 ? `${c.dgreen}  ☠ POISONED (${player.poisoned} round${player.poisoned !== 1 ? 's' : ''} remaining)` : undefined,
    divider(),
  ].filter(l => l !== undefined);
}

function getTownScreen(player) {
  const stam = player.stamina ?? player.fights_left ?? 10;
  const trainLeft = 5 - (player.training_today || 0);
  const lines = [
    ...renderBanner('town'),
    ...getStatusBar(player),
    '',
    `${c.yellow}  What would you like to do?`,
    '',
    `${c.yellow}  [F]${c.white} Enter the Forest${stam === 0 ? c.dgray + '  (exhausted — rest at the tavern)' : c.green + '  (' + stam + ' stamina remaining)'}`,
    `${c.yellow}  [X]${c.white} Training Grounds${trainLeft > 0 ? c.dgreen + '  (' + trainLeft + ' session' + (trainLeft !== 1 ? 's' : '') + ' left)' : c.dgray + '  (fully trained today)'}`,
    `${c.yellow}  [W]${c.white} Visit the Weapon Shop`,
    `${c.yellow}  [A]${c.white} Visit the Armour Shop`,
    `${c.yellow}  [I]${c.white} Go to the Inn`,
    `${c.yellow}  [B]${c.white} Visit the Bank`,
    `${c.yellow}  [M]${c.white} Seek the Master (Seth Able)`,
    `${c.yellow}  [T]${c.white} Go to the Dark Cloak Tavern`,
    `${c.yellow}  [G]${c.white} Stroll in Violet's Garden`,
    `${c.yellow}  [R]${c.white} Speak to the Bard`,
    `${c.yellow}  [N]${c.white} View the Daily News`,
    `${c.yellow}  [P]${c.white} View Other Players`,
    `${c.yellow}  [C]${c.white} View Your Character`,
    player.level >= 12 ? `${c.red}  [D]${c.white} Challenge the Red Dragon` : '',
    `${c.yellow}  [Y]${c.white} Town Crier${c.dgray} (post an announcement)`,
    `${c.dgray}  [L]${c.gray} Logout`,
    '',
  ].filter(l => l !== undefined);

  const choices = [
    { key: 'F', label: 'Enter the Forest', action: 'forest', disabled: stam === 0 },
    { key: 'X', label: 'Training Grounds', action: 'training' },
    { key: 'W', label: 'Weapon Shop', action: 'weapon_shop' },
    { key: 'A', label: 'Armour Shop', action: 'armor_shop' },
    { key: 'I', label: 'Inn', action: 'inn' },
    { key: 'B', label: 'Bank', action: 'bank' },
    { key: 'M', label: 'Master', action: 'master' },
    { key: 'T', label: 'Tavern', action: 'tavern' },
    { key: 'G', label: "Violet's Garden", action: 'garden' },
    { key: 'R', label: 'The Bard', action: 'bard' },
    { key: 'N', label: 'Daily News', action: 'news' },
    { key: 'P', label: 'Other Players', action: 'players' },
    { key: 'C', label: 'Character', action: 'character' },
    { key: 'Y', label: 'Town Crier', action: 'crier' },
    { key: 'L', label: 'Logout', action: 'logout' },
  ];
  if (player.level >= 12) choices.splice(choices.findIndex(ch => ch.key === 'Y'), 0, { key: 'D', label: 'Challenge Dragon', action: 'dragon' });

  return buildScreen('Town of Harood', lines, choices);
}

function getForestEncounterScreen(player, monster, depth = 0) {
  const hasSkills = player.skill_uses_left > 0;
  const move = CLASS_POWER_MOVES[player.class];
  const mBar = hpBar(monster.currentHp, monster.maxHp);
  const pBar = hpBar(player.hit_points, player.hit_max);

  const meetText = monster.meet
    ? monster.meet
    : `A ${monster.name} emerges from the darkness!`;

  const art = getMonsterArt(monster.name);
  const artColor = c[art.color] || c.red;

  const lines = [
    ...renderBanner('forest'),
    depth > 0 ? `${c.red}  ⚠ Forest Depth: ${depth}  — monsters grow stronger here` : undefined,
    player.rage_active ? `${c.red}  ⚡ RAGE ACTIVE — next strike will be devastating!` : undefined,
    '',
    `${c.red}  ${meetText}`,
    `${c.white}  It wields a ${c.yellow}${monster.weapon}${c.white}!`,
    '',
  ].filter(l => l !== undefined);

  // Monster ASCII art
  art.lines.forEach(l => lines.push(`${artColor}          ${l}`));
  lines.push('');

  lines.push(
    divider('─', 50),
    `${c.red}  ☠  ${monster.name}`,
    `${c.gray}  HP  ${mBar}  ${hpColor(monster.currentHp, monster.maxHp)}${fmt(monster.currentHp)}${c.gray}/${c.white}${fmt(monster.maxHp)}`,
    `${c.gray}  STR ${c.red}${fmt(monster.strength)}`,
    divider('─', 50),
    `${c.cyan}  ⚔  ${player.handle}`,
    `${c.gray}  HP  ${pBar}  ${hpColor(player.hit_points, player.hit_max)}${fmt(player.hit_points)}${c.gray}/${c.white}${fmt(player.hit_max)}`,
    divider('─', 50),
    '',
    `${c.yellow}  What will you do?`,
    '',
    `${c.yellow}  [A]${c.white} Attack with ${player.weapon_name}`,
    `${c.yellow}  [R]${c.white} Run Away!`,
    hasSkills
      ? `${c.yellow}  [P]${c.white} ${move.name}! ${c.dgray}(${player.skill_uses_left} use${player.skill_uses_left !== 1 ? 's' : ''} left)`
      : `${c.dgray}  [P] ${move.name} ${c.dgray}(no uses left)`,
    '',
    `${c.dgray}  Stamina remaining today: ${player.stamina ?? player.fights_left ?? 10}`,
  );
  if (player.class === 1) lines.push(`${c.red}  [D]${c.white} RAGE! ${c.dgray}(spend 15% HP, next strike x2 damage)`);

  const choices = [
    { key: 'A', label: 'Attack!', action: 'forest_attack' },
    { key: 'R', label: 'Run Away!', action: 'forest_run' },
    { key: 'P', label: `${move.name}!`, action: 'forest_power', disabled: !hasSkills },
  ];
  if (player.class === 1) choices.push({ key: 'D', label: 'Rage!', action: 'forest_rage' });

  return buildScreen('The Dark Forest', lines, choices);
}

function getForestCombatScreen(player, monster, roundLog, won, dead, round = 1, history = [], depth = 0) {
  const lines = [
    ...renderBanner('forest'),
    '',
  ];

  // Previous rounds shown dimmed
  if (history.length > 0) {
    history.slice(-6).forEach(entry => lines.push(`${c.dgray}  ${entry.text}`));
    lines.push('');
  }

  // Current round log
  roundLog.forEach(entry => lines.push(`  ${entry.text}`));
  lines.push('');

  if (dead) {
    lines.push(`${c.red}  ╔══════════════════════════════════╗`);
    lines.push(`${c.red}  ║      *** YOU HAVE DIED! ***      ║`);
    lines.push(`${c.red}  ╚══════════════════════════════════╝`);
    lines.push(`${c.white}  ${player.handle} has fallen in the dark forest!`);
    lines.push(`${c.gray}  You will be reincarnated tomorrow...`);
    lines.push('');
    lines.push(`${c.yellow}  [T]${c.white} Return to Town`);
    return buildScreen('You Have Died', lines, [{ key: 'T', label: 'Return to Town', action: 'town' }]);
  }

  if (won) {
    lines.push(`${c.yellow}  ╔══════════════════════════════════╗`);
    lines.push(`${c.yellow}  ║        *** VICTORY! ***          ║`);
    lines.push(`${c.yellow}  ╚══════════════════════════════════╝`);
    lines.push(`${c.white}  The ${monster.name} is defeated!`);
    if (monster.death) lines.push(`${c.green}  ${monster.death}`);
    lines.push('');
    lines.push(`${c.gray}  You gain ${c.yellow}${fmt(monster.gold)}${c.gray} gold and ${c.cyan}${fmt(monster.exp)}${c.gray} experience!`);
    lines.push('');
    if (depth > 0) lines.push(`${c.red}  [D]${c.white} Go Deeper into the Forest${c.dgray} (tougher monsters, better loot)`);
    lines.push(`${c.yellow}  [T]${c.white} Return to Town`);
    lines.push(`${c.yellow}  [F]${c.white} Enter the Forest Again`);
    const victoryChoices = [
      { key: 'T', label: 'Return to Town', action: 'town' },
      { key: 'F', label: 'Fight Again', action: 'forest', disabled: player.fights_left === 0 },
      { key: 'D', label: 'Go Deeper', action: 'forest_deeper' },
    ];
    return buildScreen('Victory!', lines, victoryChoices);
  }

  // Combat continues — HP bars + choices
  const hasSkills = player.skill_uses_left > 0;
  const move = CLASS_POWER_MOVES[player.class];
  const mBar = hpBar(monster.currentHp, monster.maxHp);
  const pBar = hpBar(player.hit_points, player.hit_max);

  lines.push(divider('─', 50));
  if (depth > 0) lines.push(`${c.red}  ⚠ Depth ${depth}`);
  lines.push(`${c.gray}  Round ${c.yellow}${round}`);
  lines.push(`${c.red}  ☠  ${monster.name}`);
  lines.push(`${c.gray}  HP  ${mBar}  ${hpColor(monster.currentHp, monster.maxHp)}${fmt(monster.currentHp)}${c.gray}/${c.white}${fmt(monster.maxHp)}`);
  lines.push(`${c.cyan}  ⚔  ${player.handle}`);
  lines.push(`${c.gray}  HP  ${pBar}  ${hpColor(player.hit_points, player.hit_max)}${fmt(player.hit_points)}${c.gray}/${c.white}${fmt(player.hit_max)}`);
  lines.push(divider('─', 50));
  lines.push('');
  lines.push(`${c.yellow}  [A]${c.white} Attack!`);
  lines.push(`${c.yellow}  [R]${c.white} Run Away!`);
  lines.push(hasSkills
    ? `${c.yellow}  [P]${c.white} ${move.name}! ${c.dgray}(${player.skill_uses_left} use${player.skill_uses_left !== 1 ? 's' : ''} left)`
    : `${c.dgray}  [P] ${move.name} ${c.dgray}(no uses left)`);

  return buildScreen('Combat', lines, [
    { key: 'A', label: 'Attack!', action: 'forest_attack' },
    { key: 'R', label: 'Run Away!', action: 'forest_run' },
    { key: 'P', label: `${move.name}!`, action: 'forest_power', disabled: !hasSkills },
  ]);
}

function getWeaponShopScreen(player) {
  // Determine which tiers have multiple weapons (for star marking)
  const tierCounts = {};
  for (let i = 1; i < WEAPONS.length; i++) {
    const w = WEAPONS[i];
    if (!w) continue;
    if (w.tier !== undefined) tierCounts[w.tier] = (tierCounts[w.tier] || 0) + 1;
  }

  const lines = [
    ...renderBanner('weapon_shop'),
    `${c.gray}  Your gold: ${c.yellow}${fmt(player.gold)}`,
    `${c.gray}  Current weapon: ${c.white}${player.weapon_name} ${c.gray}(STR +${player.weapon_num > 0 ? WEAPONS[player.weapon_num].strength : 0})`,
    divider(),
    `${c.dgray}  Weapons marked * are alternatives at the same tier`,
    `${c.yellow}  #   Weapon            Price          STR Bonus`,
    divider('─', 55),
  ];

  for (let i = 1; i < WEAPONS.length; i++) {
    const w = WEAPONS[i];
    if (!w) continue;
    const canAfford = player.gold >= w.price;
    const owned = player.weapon_num === i;
    const col = owned ? c.cyan : (canAfford ? c.white : c.dgray);
    const tierStar = (w.tier !== undefined && tierCounts[w.tier] > 1) ? c.green + '★' + col : '';
    lines.push(`${c.yellow}  ${rpad(w.num !== undefined ? w.num : i, 2)}${col}  ${pad(w.name, 18)}${tierStar} ${rpad(fmt(w.price), 14)} +${w.strength}${owned ? c.cyan + '  [EQUIPPED]' : ''}${w.bonus ? c.dgreen + '  (' + w.bonusDesc + ')' : ''}`);
  }

  lines.push('');
  if (player.class === 3) {
    lines.push(`${c.yellow}  [S]${c.green} Acquire an item (Thief only)${c.dgray} — 20% chance, dangerous if caught`);
  }
  lines.push(`${c.yellow}  Enter weapon number to buy (or ${c.white}0${c.yellow} to leave):`);

  const choices = [{ key: '0', label: 'Leave Shop', action: 'town' }];
  if (player.class === 3) choices.push({ key: 'S', label: 'Thief Acquire', action: 'shop_steal_weapon' });

  return buildScreen('Weapon Shop', lines, choices, { needsInput: true, inputLabel: 'Weapon # (0 to leave):', inputAction: 'buy_weapon' });
}

function getArmorShopScreen(player) {
  // Determine which tiers have multiple armors (for star marking)
  const tierCounts = {};
  for (let i = 1; i < ARMORS.length; i++) {
    const a = ARMORS[i];
    if (!a) continue;
    if (a.tier !== undefined) tierCounts[a.tier] = (tierCounts[a.tier] || 0) + 1;
  }

  const lines = [
    ...renderBanner('armor_shop'),
    `${c.gray}  Your gold: ${c.yellow}${fmt(player.gold)}`,
    `${c.gray}  Current armour: ${c.white}${player.arm_name} ${c.gray}(DEF +${player.arm_num > 0 ? ARMORS[player.arm_num].defense : 0})`,
    divider(),
    `${c.dgray}  Armours marked * are alternatives at the same tier`,
    `${c.yellow}  #   Armour            Price          DEF Bonus`,
    divider('─', 55),
  ];

  for (let i = 1; i < ARMORS.length; i++) {
    const a = ARMORS[i];
    if (!a) continue;
    const canAfford = player.gold >= a.price;
    const owned = player.arm_num === i;
    const col = owned ? c.cyan : (canAfford ? c.white : c.dgray);
    const tierStar = (a.tier !== undefined && tierCounts[a.tier] > 1) ? c.green + '★' + col : '';
    lines.push(`${c.yellow}  ${rpad(a.num !== undefined ? a.num : i, 2)}${col}  ${pad(a.name, 18)}${tierStar} ${rpad(fmt(a.price), 14)} +${a.defense}${owned ? c.cyan + '  [EQUIPPED]' : ''}${a.bonus ? c.dgreen + '  (' + a.bonusDesc + ')' : ''}`);
  }

  lines.push('');
  if (player.class === 3) {
    lines.push(`${c.yellow}  [S]${c.green} Acquire an item (Thief only)${c.dgray} — 20% chance, dangerous if caught`);
  }
  lines.push(`${c.yellow}  Enter armour number to buy (or ${c.white}0${c.yellow} to leave):`);

  const choices = [{ key: '0', label: 'Leave Shop', action: 'town' }];
  if (player.class === 3) choices.push({ key: 'S', label: 'Thief Acquire', action: 'shop_steal_armor' });

  return buildScreen('Armour Shop', lines, choices, { needsInput: true, inputLabel: 'Armour # (0 to leave):', inputAction: 'buy_armor' });
}

function getInnScreen(player) {
  const restCost = Math.max(50, Math.floor(player.level * 50 * (player.class === 2 ? 0.9 : 1.0)));
  const fullHp = player.hit_points >= player.hit_max;
  const lines = [
    ...renderBanner('inn'),
    `${c.white}  The innkeeper smiles warmly. "Welcome, traveller!"`,
    '',
    `${c.gray}  Your HP: ${hpColor(player.hit_points, player.hit_max)}${fmt(player.hit_points)}${c.gray}/${c.white}${fmt(player.hit_max)}`,
    `${c.gray}  Gold:    ${c.yellow}${fmt(player.gold)}`,
    `${c.gray}  Gems:    ${c.cyan}${player.gems}`,
    '',
    `${c.yellow}  [R]${c.white} Rest and recover all HP${c.dgray} (costs ${fmt(restCost)} gold)`,
    player.class === 2 ? `${c.cyan}  (Mystic discount applied: 10% off)` : undefined,
    player.gems > 0
      ? `${c.yellow}  [G]${c.white} Use a gem to recover all HP${c.dgray} (free, uses 1 gem)`
      : `${c.dgray}  [G] Use a gem${c.dgray} (you have no gems)`,
    `${c.yellow}  [L]${c.white} Leave the Inn`,
    '',
    fullHp ? `${c.green}  You are already at full health!` : '',
  ].filter(l => l !== undefined);

  return buildScreen('The Inn', lines, [
    { key: 'R', label: 'Rest (gold)', action: 'inn_rest', disabled: fullHp || player.gold < restCost },
    { key: 'G', label: 'Use gem', action: 'inn_gem', disabled: player.gems === 0 || fullHp },
    { key: 'L', label: 'Leave', action: 'town' },
  ]);
}

function getBankScreen(player) {
  const lines = [
    ...renderBanner('bank'),
    `${c.white}  The banker adjusts his spectacles. "How may I serve you?"`,
    '',
    `${c.gray}  Gold in hand: ${c.yellow}${fmt(player.gold)}`,
    `${c.gray}  Gold in bank: ${c.green}${fmt(player.bank)}`,
    `${c.dgray}  (5% daily interest on bank balance)`,
    '',
    `${c.yellow}  [D]${c.white} Deposit gold`,
    `${c.yellow}  [W]${c.white} Withdraw gold`,
    `${c.yellow}  [L]${c.white} Leave the Bank`,
  ];

  return buildScreen('The Bank', lines, [
    { key: 'D', label: 'Deposit', action: 'bank_deposit', needsInput: true, inputLabel: 'Amount to deposit:', inputType: 'number' },
    { key: 'W', label: 'Withdraw', action: 'bank_withdraw', needsInput: true, inputLabel: 'Amount to withdraw:', inputType: 'number' },
    { key: 'L', label: 'Leave', action: 'town' },
  ]);
}

function getMasterScreen(player) {
  const nextExp = expForNextLevel(player.level);
  const cls = CLASS_NAMES[player.class];
  const canLevelUp = nextExp !== null && player.exp >= nextExp;
  const trainCost = player.level * 75;

  const greeting = [
    `"Ah, ${player.handle}. A ${cls}, I see. You have potential."`,
    `"Greetings, ${player.handle}. The ${cls} path is a noble one."`,
    `"${player.handle}! Come to test your mettle? Good."`,
    `"Welcome, ${cls}. I am Seth Able. Let me see what you\'re made of."`,
  ][player.id % 4];

  const lines = [
    ...renderBanner('master'),
    `${c.white}  ${greeting}`,
    '',
    `${c.gray}  Level:      ${c.yellow}${player.level}${player.level >= 12 ? c.red + ' (CHAMPION!)' : ''}`,
    `${c.gray}  Experience: ${c.green}${fmt(player.exp)}`,
    nextExp
      ? `${c.gray}  Next level: ${c.cyan}${fmt(nextExp)} exp${canLevelUp ? c.yellow + '  *** LEVEL UP READY! ***' : ''}`
      : `${c.yellow}  You are at the maximum level!`,
    `${c.gray}  Strength:   ${c.white}${player.strength}`,
    `${c.gray}  Defence:    ${c.white}${player.defense}`,
    `${c.gray}  Skill pts:  ${c.cyan}${player.skill_points}${c.gray} (${player.skill_uses_left} uses today)`,
    '',
    canLevelUp
      ? `${c.yellow}  *** You have enough experience to advance! ***`
      : '',
    '',
    `${c.yellow}  [S]${c.white} Train Strength ${c.dgray}(${fmt(trainCost)} gold per point)`,
    `${c.yellow}  [D]${c.white} Train Defence  ${c.dgray}(${fmt(trainCost)} gold per point)`,
    `${c.yellow}  [L]${c.white} Leave`,
  ].filter(l => l !== undefined);

  return buildScreen("Seth Able's Training", lines, [
    { key: 'S', label: 'Train Strength', action: 'master_train', needsInput: true, inputLabel: 'Points to train (each costs ' + fmt(trainCost) + ' gold):', inputType: 'number', inputParam: 'strength' },
    { key: 'D', label: 'Train Defence', action: 'master_train', needsInput: true, inputLabel: 'Points to train (each costs ' + fmt(trainCost) + ' gold):', inputType: 'number', inputParam: 'defense' },
    { key: 'L', label: 'Leave', action: 'town' },
  ]);
}

function getTrainingScreen(player) {
  const stam = player.stamina ?? player.fights_left ?? 10;
  const trainLeft = 5 - (player.training_today || 0);
  const expPerDummy = player.level * 12;
  const expPerSpar = player.level * 20;
  const canTrain = stam > 0 && trainLeft > 0;

  const lines = [
    ...renderBanner('training'),
    `${c.white}  Sergeant Grimwald eyes you up and down.`,
    `${c.gray}  "Weaklings die in the forest. Warriors are MADE here."`,
    '',
    divider('─', 55),
    `${c.gray}  Stamina: ${hpBar(stam, 10, 10)} ${stam > 6 ? c.green : stam > 3 ? c.yellow : c.red}${stam}${c.gray}/10`,
    `${c.gray}  Training sessions left today: ${c.cyan}${trainLeft}${c.gray}/5`,
    divider('─', 55),
    '',
    canTrain
      ? `${c.yellow}  [F]${c.white} Fight the Training Dummy  ${c.dgray}(−1 stamina → +${expPerDummy} exp, safe)`
      : `${c.dgray}  [F] Fight the Training Dummy  (unavailable)`,
    canTrain
      ? `${c.yellow}  [S]${c.white} Spar with a Recruit       ${c.dgray}(−1 stamina → +${expPerSpar} exp, minor injury risk)`
      : `${c.dgray}  [S] Spar with a Recruit  (unavailable)`,
    `${c.yellow}  [L]${c.white} Leave the Training Yard`,
    '',
    stam === 0 ? `${c.red}  You are too exhausted to train. Visit the tavern for a drink!` : '',
    trainLeft === 0 ? `${c.dgray}  You have trained enough for one day. Come back tomorrow.` : '',
  ].filter(l => l !== undefined && l !== '');

  return buildScreen("Grimwald's Training Yard", lines, [
    { key: 'F', label: 'Fight Dummy', action: 'training_fight', disabled: !canTrain },
    { key: 'S', label: 'Spar', action: 'training_spar', disabled: !canTrain },
    { key: 'L', label: 'Leave', action: 'town' },
  ]);
}

function getTavernScreen(player, otherPlayers) {
  const lines = [
    ...renderBanner('tavern'),
    `${c.white}  The tavern is dimly lit, filled with the smell of ale`,
    `${c.white}  and the sound of quiet conversation...`,
    '',
    `${c.yellow}  Players in the Realm:`,
    divider('─', 55),
    `${c.yellow}  ${pad('#', 4)}${pad('Name', 22)}${pad('Level', 8)}${pad('Class', 16)}Status`,
    divider('─', 55),
  ];

  const others = otherPlayers.filter(p => p.id !== player.id && p.setup_complete);
  if (others.length === 0) {
    lines.push(`${c.dgray}  No other warriors are in the realm yet.`);
  } else {
    others.slice(0, 15).forEach((p, i) => {
      const col = p.dead ? c.dgray : (p.times_won > 0 ? c.yellow : c.white);
      const status = p.dead ? `${c.red}(dead)` : (p.times_won > 0 ? `${c.yellow}(King x${p.times_won})` : '');
      lines.push(`${c.yellow}  ${rpad(i + 1, 4)}${col}${pad(p.handle, 22)}${pad(p.level, 8)}${pad(CLASS_NAMES[p.class], 16)}${status}`);
    });
  }

  lines.push('');
  lines.push(`${c.gray}  Your human fights today: ${c.yellow}${player.human_fights_left}`);
  const stam = player.stamina ?? player.fights_left ?? 10;
  const drinksLeft = 3 - (player.drinks_today || 0);
  lines.push(`${c.gray}  Your stamina: ${stam > 6 ? c.green : stam > 3 ? c.yellow : c.red}${stam}${c.gray}/10`);
  lines.push('');
  lines.push(`${c.yellow}  [D]${c.white} Order a Drink           ${drinksLeft > 0 ? c.dgreen + '(restores stamina, ' + drinksLeft + ' left today)' : c.dgray + '(no more drinks today)'}`);
  lines.push(`${c.yellow}  [G]${c.white} Try Your Luck           ${c.dgray}(dice gamble)`);
  lines.push(`${c.yellow}  [R]${c.white} Hear Rumours            ${c.dgray}(free — learn what lurks outside)`);
  lines.push(`${c.yellow}  [B]${c.white} Buy the House a Round   ${c.dgray}(50 gold — +1 charm)`);
  lines.push(`${c.yellow}  [A]${c.white} Challenge a Player      ${c.dgray}(enter their number)`);
  if (player.class === 1) {
    lines.push(`${c.red}  [I]${c.white} Intimidate a player     ${c.dgray}(Death Knight only)`);
  }
  lines.push(`${c.yellow}  [L]${c.white} Leave the Tavern`);

  const drinksRemain = 3 - (player.drinks_today || 0);
  const tavernChoices = [
    { key: 'D', label: 'Order a Drink', action: 'tavern_drink', disabled: drinksRemain === 0 },
    { key: 'G', label: 'Try Your Luck', action: 'tavern_gamble', needsInput: true, inputLabel: 'How much gold do you bet? (min 10)', inputType: 'number' },
    { key: 'R', label: 'Hear Rumours', action: 'tavern_rumours' },
    { key: 'B', label: 'Buy a Round', action: 'tavern_buyround' },
    { key: 'A', label: 'Attack Player', action: 'tavern_attack', needsInput: true, inputLabel: 'Player number to attack:', inputType: 'number', disabled: player.human_fights_left === 0 },
    { key: 'L', label: 'Leave', action: 'town' },
  ];
  if (player.class === 1) {
    tavernChoices.splice(tavernChoices.findIndex(c => c.key === 'A'), 0, { key: 'I', label: 'Intimidate', action: 'tavern_intimidate', needsInput: true, inputLabel: 'Player number to intimidate:', inputType: 'number', disabled: player.human_fights_left === 0 });
  }

  return buildScreen('Dark Cloak Tavern', lines, tavernChoices);
}

function getTavernDrinkScreen(player) {
  const stam = player.stamina ?? player.fights_left ?? 10;
  const drinksLeft = 3 - (player.drinks_today || 0);

  const lines = [
    ...renderBanner('tavern'),
    `${c.brown}  The barkeep, a grizzled dwarf named Hrok, looks up at you.`,
    `${c.brown}  "What'll it be, then? We've got fine spirits tonight."`,
    '',
    divider('─', 55),
    `${c.gray}  Current stamina: ${stam > 6 ? c.green : stam > 3 ? c.yellow : c.red}${stam}${c.gray}/10`,
    `${c.gray}  Drinks remaining today: ${c.cyan}${drinksLeft}${c.gray}/3`,
    divider('─', 55),
    '',
    drinksLeft > 0
      ? `${c.yellow}  [A]${c.white} Pint of Ale     ${c.dgray}(10 gold — +2 stamina)`
      : `${c.dgray}  [A] Pint of Ale     (already had enough today)`,
    drinksLeft > 0
      ? `${c.yellow}  [W]${c.white} Cup of Wine     ${c.dgray}(25 gold — +3 stamina)`
      : `${c.dgray}  [W] Cup of Wine     (already had enough today)`,
    drinksLeft > 0
      ? `${c.yellow}  [S]${c.white} Fine Spirits    ${c.dgray}(50 gold — +4 stamina)`
      : `${c.dgray}  [S] Fine Spirits    (already had enough today)`,
    `${c.yellow}  [L]${c.white} Never mind`,
    '',
    stam >= 10 ? `${c.dgray}  Your stamina is already full.` : '',
  ].filter(l => l !== undefined && l !== '');

  return buildScreen('The Bar', lines, [
    { key: 'A', label: 'Pint of Ale (10g)', action: 'tavern_drink_order', param: 'ale', disabled: drinksLeft === 0 || stam >= 10 },
    { key: 'W', label: 'Cup of Wine (25g)', action: 'tavern_drink_order', param: 'wine', disabled: drinksLeft === 0 || stam >= 10 },
    { key: 'S', label: 'Fine Spirits (50g)', action: 'tavern_drink_order', param: 'spirits', disabled: drinksLeft === 0 || stam >= 10 },
    { key: 'L', label: 'Never mind', action: 'tavern' },
  ]);
}

function getGardenScreen(player) {
  const isFemale = player.sex === 5;
  const lines = [
    ...renderBanner('garden'),
    `${c.green}  You push open a hidden gate and enter a beautiful garden.`,
    `${c.green}  The scent of roses fills the air.`,
    '',
    `${c.magenta}  A stunning woman with violet eyes looks up from her flowers.`,
    `${c.white}  "Oh! A visitor. How... unexpected."`,
    '',
  ];

  if (player.flirted_today) {
    lines.push(`${c.magenta}  Violet smiles. "You again. I must say, you are persistent."`);
    lines.push(`${c.dgray}  (You have already visited Violet today.)`);
    lines.push('');
    lines.push(`${c.yellow}  [L]${c.white} Leave the Garden`);
    return buildScreen("Violet's Garden", lines, [{ key: 'L', label: 'Leave', action: 'town' }]);
  }

  if (isFemale) {
    lines.push(`${c.magenta}  "Another lady in the realm! How delightful." She hands you`);
    lines.push(`${c.magenta}  a beautiful rose. Your charm increases by 1!`);
  } else {
    lines.push(`${c.yellow}  [F]${c.white} Pick her a flower`);
    lines.push(`${c.yellow}  [C]${c.white} Compliment her eyes`);
    lines.push(`${c.yellow}  [K]${c.white} Try to steal a kiss`);
  }
  lines.push(`${c.yellow}  [L]${c.white} Leave the Garden`);

  const choices = [
    { key: 'L', label: 'Leave', action: 'town' },
  ];
  if (!isFemale) {
    choices.unshift(
      { key: 'F', label: 'Pick a flower', action: 'garden_flower' },
      { key: 'C', label: 'Compliment', action: 'garden_compliment' },
      { key: 'K', label: 'Steal a kiss', action: 'garden_kiss' },
    );
  } else {
    choices.unshift({ key: 'X', label: 'Accept rose', action: 'garden_female' });
  }

  return buildScreen("Violet's Garden", lines, choices);
}

function getBardScreen(hallOfKings) {
  const songs = [
    'The dragon sleeps beneath the mountain, dreaming of old gold...',
    'A warrior came from the east, they say, with fire in their eyes...',
    'When the Red Dragon wakes, the world shall tremble anew...',
    'Many have tried; few have returned. The forest keeps its secrets...',
    'The inn was full that night when the stranger walked in...',
  ];
  const song = songs[Math.floor(Math.random() * songs.length)];

  const lines = [
    ...renderBanner('bard'),
    `${c.brown}  An old bard strums a lute and sings softly:`,
    '',
    `${c.yellow}  "${song}"`,
    '',
    divider(),
    `${c.cyan}  ═══ Hall of Kings ═══`,
    '',
  ];

  if (hallOfKings.length === 0) {
    lines.push(`${c.dgray}  The Hall of Kings is empty. No one has slain the dragon yet.`);
    lines.push(`${c.dgray}  Will you be the first?`);
  } else {
    lines.push(`${c.yellow}  ${pad('Name', 22)}${pad('Class', 16)}Times Won`);
    hallOfKings.forEach(k => {
      const legendTag = (k.times_won || 0) >= 3 ? `${c.red} ★ LEGEND` : '';
      lines.push(`${c.white}  ${pad(k.handle, 22)}${pad(CLASS_NAMES[k.class], 16)}${k.times_won || 1}${legendTag}`);
    });
  }

  lines.push('');
  lines.push(`${c.yellow}  [L]${c.white} Leave`);

  return buildScreen("The Bard's Corner", lines, [{ key: 'L', label: 'Leave', action: 'town' }]);
}

function getNewsScreen(newsList) {
  const lines = [
    ...renderBanner('news'),
    `${c.white}  Hear ye, hear ye! The crier reads the day's events:`,
    '',
  ];

  if (newsList.length === 0) {
    lines.push(`${c.dgray}  Nothing of note has happened recently.`);
  } else {
    newsList.slice(0, 20).forEach(n => {
      lines.push(`  ${c.gray}· ${n.message}`);
    });
  }

  lines.push('');
  lines.push(`${c.yellow}  [L]${c.white} Return to Town`);

  return buildScreen('Daily News', lines, [{ key: 'L', label: 'Return', action: 'town' }]);
}

function getCharacterScreen(player) {
  const cls = CLASS_NAMES[player.class];
  const move = CLASS_POWER_MOVES[player.class];
  const nextExp = expForNextLevel(player.level);

  const lines = [
    ...renderBanner('character'),
    `${c.gray}  Name:       ${c.white}${player.handle}`,
    `${c.gray}  Class:      ${c.cyan}${cls}`,
    `${c.gray}  Sex:        ${c.white}${player.sex === 5 ? 'Female' : 'Male'}`,
    `${c.gray}  Level:      ${c.yellow}${player.level}${player.level >= 12 ? c.red + '  (DRAGON SLAYER!)' : ''}`,
    `${c.gray}  Experience: ${c.green}${fmt(player.exp)}${nextExp ? c.gray + ' / ' + c.cyan + fmt(nextExp) : ''}`,
    '',
    divider('─', 45),
    `${c.yellow}  ── Combat Statistics ────────────────`,
    `${c.gray}  Hit Points: ${hpColor(player.hit_points, player.hit_max)}${fmt(player.hit_points)}${c.gray}/${c.white}${fmt(player.hit_max)}`,
    `${c.gray}  Strength:   ${c.white}${player.strength}`,
    `${c.gray}  Defence:    ${c.white}${player.defense}`,
    `${c.gray}  Charm:      ${c.magenta}${player.charm}`,
    '',
    `${c.yellow}  ── Equipment ────────────────────────`,
    `${c.gray}  Weapon:  ${c.white}${player.weapon_name}`,
    `${c.gray}  Armour:  ${c.white}${player.arm_name}`,
    '',
    `${c.yellow}  ── Resources ────────────────────────`,
    `${c.gray}  Gold:   ${c.yellow}${fmt(player.gold)}`,
    `${c.gray}  Bank:   ${c.green}${fmt(player.bank)}`,
    `${c.gray}  Gems:   ${c.cyan}${player.gems}`,
    player.has_horse ? `${c.gray}  Horse:  ${c.yellow}Yes!` : '',
    '',
    `${c.yellow}  ── Class Skills ─────────────────────`,
    `${c.gray}  Power Move:  ${c.cyan}${move.name}`,
    `${c.gray}  Skill Pts:   ${c.white}${player.skill_points}`,
    `${c.gray}  Uses Today:  ${c.white}${player.skill_uses_left}`,
    '',
    `${c.yellow}  ── Records ──────────────────────────`,
    `${c.gray}  PvP Kills:   ${c.red}${player.kills}`,
    `${c.gray}  Times Won:   ${c.yellow}${player.times_won}`,
    player.is_legend ? `${c.yellow}  Legend Status: ${c.red}★ LEGENDARY WARRIOR ★` : '',
    (player.poisoned || 0) > 0 ? `${c.dgreen}  ☠ Status: POISONED (${player.poisoned} rounds remaining)` : '',
    player.quest_id ? `${c.cyan}  Quest Active: ${player.quest_id.replace(/_/g, ' ')}` : '',
    '',
    `${c.yellow}  [L]${c.white} Return to Town`,
  ].filter(l => l !== undefined);

  return buildScreen('Character', lines, [{ key: 'L', label: 'Return', action: 'town' }]);
}

function getSetupScreen(step) {
  if (step === 'name') {
    return buildScreen('Character Creation', [
      `${c.yellow}         *** Legend of the Red Dragon ***`,
      `${c.cyan}              Character Creation`,
      divider(),
      `${c.white}  Welcome, new warrior!`,
      '',
      `${c.white}  Before you enter the realm, you must create your character.`,
      '',
      `${c.yellow}  What is your warrior's name?`,
      `${c.dgray}  (2-20 characters)`,
    ], [], { needsInput: true, inputLabel: 'Your warrior name:', inputAction: 'setup_name' });
  }

  if (step === 'sex') {
    return buildScreen('Character Creation', [
      `${c.yellow}         *** Legend of the Red Dragon ***`,
      `${c.cyan}              Character Creation`,
      divider(),
      `${c.white}  Are you male or female?`,
      '',
      `${c.yellow}  [M]${c.white} Male`,
      `${c.yellow}  [F]${c.white} Female`,
    ], [
      { key: 'M', label: 'Male', action: 'setup_sex', param: '0' },
      { key: 'F', label: 'Female', action: 'setup_sex', param: '5' },
    ]);
  }

  if (step === 'class') {
    return buildScreen('Character Creation', [
      `${c.yellow}         *** Legend of the Red Dragon ***`,
      `${c.cyan}              Character Creation`,
      divider(),
      `${c.white}  Choose your class:`,
      '',
      `${c.yellow}  [1]${c.white} Death Knight`,
      `${c.gray}      Powerful warrior, masters of strength and brute force.`,
      `${c.gray}      Power Move: ${c.cyan}Fatal Strike${c.gray} (3x damage)`,
      '',
      `${c.yellow}  [2]${c.white} Mystic`,
      `${c.gray}      Wielder of arcane forces. Balanced and versatile.`,
      `${c.gray}      Power Move: ${c.cyan}Lightning Bolt${c.gray} (2.5x damage)`,
      '',
      `${c.yellow}  [3]${c.white} Thief`,
      `${c.gray}      Quick and cunning. High agility and charm.`,
      `${c.gray}      Power Move: ${c.cyan}Backstab${c.gray} (2x damage, guaranteed)`,
    ], [
      { key: '1', label: 'Death Knight', action: 'setup_class', param: '1' },
      { key: '2', label: 'Mystic', action: 'setup_class', param: '2' },
      { key: '3', label: 'Thief', action: 'setup_class', param: '3' },
    ]);
  }
}

function getDragonScreen(player) {
  const lines = [
    ...renderBanner('dragon'),
    `${c.white}  You stand at the mouth of a vast cavern.`,
    `${c.white}  The heat is oppressive. The smell of brimstone fills the air.`,
    '',
    `${c.red}  Deep within, two enormous eyes open. They glow like coals.`,
    `${c.red}  A voice like grinding boulders fills the cave:`,
    '',
    `${c.yellow}  "SO. ANOTHER WORM DARES TO FACE ME."`,
    `${c.yellow}  "COME THEN, ${player.handle.toUpperCase()}. LET US SEE WHAT YOU ARE MADE OF."`,
    '',
    `${c.red}  The Red Dragon spreads its wings and ROARS!`,
    '',
    `${c.cyan}  ── The Red Dragon ──────────────────────`,
    `${c.gray}  Hit Points: ${c.red}2000`,
    `${c.gray}  Strength:   ${c.red}500`,
    '',
    `${c.gray}  Your HP: ${hpColor(player.hit_points, player.hit_max)}${fmt(player.hit_points)}${c.gray}/${c.white}${fmt(player.hit_max)}`,
    '',
    `${c.yellow}  [F]${c.white} FIGHT THE DRAGON!`,
    `${c.red}  [R]${c.white} Run Away (coward!)`,
  ];

  return buildScreen('The Red Dragon!', lines, [
    { key: 'F', label: 'FIGHT!', action: 'dragon_fight' },
    { key: 'R', label: 'Run Away', action: 'town' },
  ]);
}

function getLevelUpScreen(player, newLevel, hpGain, strGain) {
  const cls = CLASS_NAMES[player.class];
  const lines = [
    ...renderBanner('master'),
    `${c.white}  Congratulations, ${player.handle}!`,
    '',
    `${c.yellow}  You have advanced to level ${c.cyan}${newLevel}${c.yellow}!`,
    `${c.gray}  As a ${cls}, you feel your power growing...`,
    '',
    `${c.green}  +${hpGain} Maximum Hit Points`,
    `${c.green}  +${strGain} Strength`,
    `${c.cyan}  +1 Skill Point (${player.skill_points + 1} total)`,
    '',
    newLevel === 12 ? `${c.red}  You are now powerful enough to challenge the Red Dragon!` : '',
    '',
    `${c.yellow}  [T]${c.white} Return to Town`,
  ].filter(l => l !== undefined);

  return buildScreen('Level Up!', lines, [{ key: 'T', label: 'Return to Town', action: 'town' }]);
}

// ── Forest Event Screen ───────────────────────────────────────────────────────
function getForestEventScreen(player, event) {
  const artColor = c[event.artColor] || c.white;
  const lines = [
    ...renderBanner('forest'),
    '',
  ];

  if (event.art) {
    event.art.forEach(l => lines.push(`${artColor}          ${l}`));
    lines.push('');
  }

  lines.push(`${c.yellow}  ── ${event.title} ──`);
  lines.push('');
  event.intro.forEach(l => lines.push(`${c.white}  ${l}`));

  if (event.riddleText) {
    lines.push('');
    event.riddleText.forEach(l => lines.push(`${c.yellow}  ${l}`));
  }

  lines.push('');
  lines.push(divider('─', 50));
  lines.push(`${c.yellow}  What will you do?`);
  lines.push('');
  event.choices.forEach(ch => lines.push(`${c.yellow}  [${ch.key}]${c.white} ${ch.label}`));
  lines.push('');
  lines.push(`${c.dgray}  Forest trips remaining today: ${player.fights_left}`);

  const choices = event.choices.map(ch => ({
    key: ch.key, label: ch.label, action: 'forest_event', param: ch.param,
  }));
  return buildScreen(event.title, lines, choices);
}

// ── Rescue Opportunity Screen ─────────────────────────────────────────────────
function getRescueOpportunityScreen(player, victim) {
  const sexStr = victim.sex === 5 ? 'She' : 'He';
  const cls = CLASS_NAMES[victim.class] || 'Warrior';
  const lines = [
    ...renderBanner('forest'),
    '',
    `${c.red}  You come upon a fallen warrior lying in the path!`,
    '',
    `${c.white}  ${victim.handle}${c.gray} — Level ${victim.level} ${cls}`,
    `${c.gray}  ${sexStr} was mauled by a ${c.red}${victim.near_death_by}${c.gray}.`,
    `${c.gray}  Still breathing, just barely. ${sexStr} can't fight back.`,
    '',
    `${c.yellow}  You could save this warrior's life right now.`,
    `${c.green}  Reward: experience + charm for your heroism.`,
    '',
    divider('─', 50),
    `${c.green}  [R]${c.white} Rescue ${victim.handle}!`,
    `${c.dgray}  [S] Leave them and continue hunting`,
    '',
  ];
  return buildScreen('A Warrior in Need!', lines, [
    { key: 'R', label: `Rescue ${victim.handle}!`, action: 'rescue' },
    { key: 'S', label: 'Leave them', action: 'rescue_skip' },
  ]);
}

// ── Near Death Waiting Screen ─────────────────────────────────────────────────
function getNearDeathWaitingScreen(player) {
  const lines = [
    ...renderBanner('forest'),
    '',
    `${c.red}  You lie gravely wounded in the dark forest.`,
    `${c.gray}  A ${c.red}${player.near_death_by}${c.gray} has left you for dead.`,
    '',
    `${c.yellow}  Another warrior may find you and save your life.`,
    `${c.gray}  If no one comes before dawn, you will perish.`,
    '',
    `${c.dgray}  ── You cannot act while near death ──`,
    '',
    `${c.yellow}  [W]${c.white} Wait for rescue...`,
    `${c.red}  [G]${c.white} Give up${c.gray} — accept death penalty now and return to town`,
  ];
  return buildScreen('Near Death...', lines, [
    { key: 'W', label: 'Wait for rescue...', action: 'near_death_wait' },
    { key: 'G', label: 'Give up (accept death)', action: 'near_death_accept' },
  ]);
}

// ── NPC Rescue Screen ─────────────────────────────────────────────────────────
function getNpcRescueScreen(player, npcName, monster, log, round, history) {
  const lines = [
    ...renderBanner('forest'),
    '',
  ];

  if (history.length > 0) {
    history.slice(-4).forEach(e => lines.push(`${c.dgray}  ${e.text}`));
    lines.push('');
  }
  log.forEach(e => lines.push(`  ${e.text}`));
  lines.push('');

  lines.push(`${c.red}  ╔═══════════════════════════════════╗`);
  lines.push(`${c.red}  ║    *** AT DEATH'S DOOR! ***       ║`);
  lines.push(`${c.red}  ╚═══════════════════════════════════╝`);
  lines.push('');
  lines.push(`${c.yellow}  ${npcName} appears just in time!`);
  lines.push(`${c.green}  They drive off the ${monster.name} and tend to your wounds.`);
  lines.push('');
  lines.push(`${c.gray}  You are alive, but barely.`);
  lines.push(`${c.gray}  HP restored to ${c.green}${fmt(player.hit_points)}${c.gray}/${c.white}${fmt(player.hit_max)}${c.gray}.`);
  lines.push('');
  lines.push(`${c.yellow}  [T]${c.white} Limp back to Town`);

  return buildScreen('Saved!', lines, [{ key: 'T', label: 'Return to Town', action: 'town' }]);
}

// ── Near Death Screen (when dealt killing blow) ───────────────────────────────
function getNearDeathScreen(player, monster, log, round, history) {
  const lines = [
    ...renderBanner('forest'),
    '',
  ];

  if (history.length > 0) {
    history.slice(-4).forEach(e => lines.push(`${c.dgray}  ${e.text}`));
    lines.push('');
  }
  log.forEach(e => lines.push(`  ${e.text}`));
  lines.push('');

  lines.push(`${c.red}  ╔═══════════════════════════════════╗`);
  lines.push(`${c.red}  ║    *** YOU LIE NEAR DEATH! ***    ║`);
  lines.push(`${c.red}  ╚═══════════════════════════════════╝`);
  lines.push('');
  lines.push(`${c.gray}  The ${monster.name} leaves you for dead and disappears.`);
  lines.push(`${c.gray}  You cannot move. You cannot fight.`);
  lines.push('');
  lines.push(`${c.yellow}  Perhaps another warrior will find you before dawn.`);
  lines.push(`${c.dgray}  If not... this is the end.`);
  lines.push('');
  lines.push(`${c.yellow}  [W]${c.white} Wait and hope...`);
  lines.push(`${c.red}  [G]${c.white} Give up${c.gray} — accept death penalty now and return to town`);

  return buildScreen('Near Death!', lines, [
    { key: 'W', label: 'Wait and hope...', action: 'near_death_wait' },
    { key: 'G', label: 'Give up (accept death)', action: 'near_death_accept' },
  ]);
}

function getCrierScreen(player) {
  const lines = [
    ...renderBanner('news'),
    `${c.yellow}  Post a message to the Town Crier!`,
    '',
    `${c.white}  Your announcement will be read aloud in the Town of Harood`,
    `${c.white}  for the rest of the day. Costs ${c.yellow}50 gold${c.white}.`,
    '',
    `${c.gray}  Your gold: ${c.yellow}${fmt(player.gold)}`,
    '',
    `${c.yellow}  Enter your announcement (max 60 characters):`,
    `${c.dgray}  (Keep it clean. The crier has standards.)`,
    '',
    `${c.yellow}  [L]${c.white} Cancel`,
  ];
  return buildScreen('Town Crier', lines, [
    { key: 'L', label: 'Cancel', action: 'town' },
  ], { needsInput: true, inputLabel: 'Your announcement:', inputAction: 'post_crier' });
}

module.exports = {
  getTownScreen, getForestEncounterScreen, getForestCombatScreen,
  getWeaponShopScreen, getArmorShopScreen, getInnScreen, getBankScreen,
  getMasterScreen, getTrainingScreen, getTavernScreen, getTavernDrinkScreen,
  getGardenScreen, getBardScreen,
  getNewsScreen, getCharacterScreen, getSetupScreen, getDragonScreen,
  getLevelUpScreen, getForestEventScreen, getRescueOpportunityScreen,
  getNearDeathWaitingScreen, getNpcRescueScreen, getNearDeathScreen,
  getCrierScreen,
  renderBanner,
};
