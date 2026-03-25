// One-time secrets — strange events, lore fragments, and absurd moments.
// Each fires at most once per player (tracked in player_secrets).
// Returns { lines, damage } or null.

const { getSeenSecrets, recordSecret } = require('../db');

// ── Trigger rates (probability per trigger point) ─────────────────────────────
const RATES = {
  forest:  0.07,
  inn:     0.12,
  bank:    0.10,
  tavern:  0.08,
  town:    0.04,
  dragon:  1.00, // always fires on first dragon kill
};

// ── Secret definitions ────────────────────────────────────────────────────────
const SECRETS = [

  // ── LORE: The Veilborn / Before Time ───────────────────────────────────────

  {
    id: 'lore_silence_page',
    category: 'lore',
    triggers: ['forest'],
    weight: 2,
    lines: [
      '`8Caught on a branch beside the body: a scrap of parchment.',
      '`8The ink is wrong — it absorbs light rather than reflects it.',
      '`8You squint to make it out:',
      '`7  "Before the First Word, there was the Silence.',
      '`7   The Silence has no edge — edges require two sides.',
      '`7   We gave it a boundary. We named it the Veil.',
      '`7   Names make things real.',
      '`7   We made It real."',
      '`8The page crumbles when you try to pocket it.',
    ],
  },

  {
    id: 'lore_no_face_coin',
    category: 'lore',
    triggers: ['forest'],
    weight: 1,
    lines: [
      '`8You come upon a small clearing. No birds call. No insects hum.',
      '`8At the centre: a perfect circle of dead grass.',
      '`8Within it, a single coin. Both faces blank — not worn smooth,',
      '`8but `7never stamped`8. As if minted before currency was invented.',
      '`8You pocket it. When you check your purse an hour later, it is gone.',
    ],
  },

  {
    id: 'lore_vanishing_kill',
    category: 'lore',
    triggers: ['forest'],
    weight: 1,
    lines: [
      '`8Your killing blow lands true.',
      '`8The creature does not fall.',
      '`8It `7dissolves`8 — no blood, no body, no sound.',
      '`8For half a heartbeat, in the shape where it stood, you see `7nothing`8.',
      '`8Not darkness. Not empty air.',
      '`8`7Nothing`8. The kind that existed before there was anything to be nothing.',
      '`8Then it is gone too, and the forest looks perfectly normal.',
      '`8You are not entirely sure what you just saw.',
    ],
  },

  {
    id: 'lore_reflection_wrong',
    category: 'lore',
    triggers: ['inn'],
    weight: 1,
    lines: [
      '`8You catch your reflection in the darkened window of your room.',
      '`8A moment passes before you realise: it did not move when you did.',
      '`8It is looking at something just past your left shoulder.',
      '`8You spin around. There is nothing there.',
      '`8When you look back at the window, your reflection is behaving correctly.',
      '`8It does not look relieved.',
    ],
  },

  {
    id: 'lore_map_edge',
    category: 'lore',
    triggers: ['dragon'],
    weight: 1,
    lines: [
      '`8As the dragon\'s fire dies, something behind your eyes `7opens`8.',
      '`8For three heartbeats you see the world from above.',
      '`8Every road. Every town. Every forest and ruin and mountain.',
      '`8And at the edges, where the known world ends:',
      '`8Not darkness. Not sea. Not sky.',
      '`7Nothing`8. An absolute, patient nothing pressing against everything.',
      '`8As if the world is a lit candle, and the nothing is the rest of the room.',
      '`8The vision ends. The dragon\'s body is still warm.',
      '`8You do not speak of this to anyone.',
    ],
  },

  {
    id: 'lore_merchant_colors',
    category: 'lore',
    triggers: ['town', 'bank'],
    weight: 1,
    lines: [
      '`8For just a moment — one blink — something is wrong with the colours.',
      '`8A merchant\'s red apple is a shade that has no name.',
      '`8The cobblestones are the colour of `7not-grey`8.',
      '`8Then it passes. Everything is normal. The merchant is watching you.',
      '`7"See something?"` he asks pleasantly.',
      '`8You say no.',
    ],
  },

  {
    id: 'lore_locked_door',
    category: 'lore',
    triggers: ['inn', 'town'],
    weight: 1,
    lines: [
      '`8At the end of a corridor you have walked before, there is a door.',
      '`8You are certain it was not there yesterday.',
      '`8It is locked. The wood is warm to the touch.',
      '`8You press your ear against it and hear nothing — not silence,',
      '`8but `7nothing`8, the way a room sounds when something large has just stopped moving.',
      '`8You walk away quickly.',
      '`8The door is gone the next time you look.',
    ],
  },

  {
    id: 'lore_childs_warning',
    category: 'lore',
    triggers: ['town', 'tavern'],
    weight: 1,
    lines: [
      '`8A child stops directly in front of you. She looks up.',
      '`7"It knows your name,"` she says.',
      '`8She does not elaborate.',
      '`8Her mother calls from across the square and she runs off.',
      '`8The mother glances at you as she takes the girl\'s hand.',
      '`8She mouths something. You are too far away to read it clearly.',
      '`8It looks like: `7"don\'t."',
    ],
  },

  // ── STRANGE: Dark / Atmospheric ────────────────────────────────────────────

  {
    id: 'strange_old_man',
    category: 'strange',
    triggers: ['tavern'],
    weight: 1,
    lines: [
      '`8In the far corner of the tavern sits a very old man.',
      '`8He has been there every time you have visited.',
      '`8You have somehow never noticed him before.',
      '`8When you look directly at him, he winks.',
      '`8When you glance away and look back, he is gone.',
      '`8His drink remains on the table, untouched.',
      '`8It is completely full.',
      '`8No one else seems to notice the drink.',
    ],
  },

  {
    id: 'strange_wound_text',
    category: 'strange',
    triggers: ['inn'],
    weight: 1,
    lines: [
      '`8You clean an old wound before sleeping.',
      '`8The scar tissue has healed in an unusual pattern.',
      '`8It takes a moment to recognise it as text.',
      '`8Written in the flesh of your own arm, in a language you somehow read:',
      '`7  S T O P',
      '`8The letters are upside down.',
      '`8As if written for someone looking from the inside out.',
    ],
  },

  {
    id: 'strange_compass',
    category: 'strange',
    triggers: ['forest'],
    weight: 1,
    lines: [
      '`8You find a compass half-buried in the dirt.',
      '`8The needle does not point north.',
      '`8It points at you.',
      '`8No matter which way you turn, it follows.',
      '`8You look up. The trees seem further away than they were a moment ago.',
      '`8You drop the compass and do not look back.',
    ],
  },

  // ── ABSURD / FUNNY ─────────────────────────────────────────────────────────

  {
    id: 'funny_counterfeit',
    category: 'absurd',
    triggers: ['bank'],
    weight: 2,
    lines: [
      '`8The banker holds one of your coins up to the light.',
      '`7"This one\'s counterfeit,"` he says.',
      '`8He slides it back across the counter.',
      '`7"Keep it. It\'s funnier that way."',
      '`8You inspect the coin carefully.',
      '`8It is, as far as you can determine, entirely real.',
      '`8The banker has already moved on and will not discuss it further.',
    ],
  },

  {
    id: 'funny_bird_judge',
    category: 'absurd',
    triggers: ['forest'],
    weight: 2,
    lines: [
      '`8You trip on a root.',
      '`8You fall face-first into a thornbush.',
      '`8When you lift your head, a small brown bird is perched two inches from your face.',
      '`8It stares at you.',
      '`8You stare back.',
      '`8After a long moment it flies away, because birds cannot speak.',
      '`8You feel profoundly judged.',
    ],
  },

  {
    id: 'funny_farmer_dream',
    category: 'absurd',
    triggers: ['inn'],
    weight: 2,
    lines: [
      '`8You dream of being a farmer.',
      '`8It is warm. The crops are good. Nobody is trying to kill you.',
      '`8In the dream you have a dog. His name is Barley.',
      '`8Barley is a very good dog.',
      '`8You wake up.',
      '`8You are inexplicably furious.',
    ],
  },

  {
    id: 'funny_wrong_drink',
    category: 'absurd',
    triggers: ['tavern'],
    weight: 2,
    lines: [
      '`8The barmaid sets down a drink you definitely did not order.',
      '`8You open your mouth to say something.',
      '`8She has already walked away.',
      '`8You try the drink.',
      '`8It is, somehow, exactly what you needed.',
      '`8You will never be able to describe what it tasted like.',
    ],
  },

  {
    id: 'funny_rock_child',
    category: 'absurd',
    triggers: ['town', 'tavern'],
    weight: 2,
    lines: [
      '`8A child you have never met throws a rock at you.',
      '`8Not in a playful way.',
      '`8It catches you square on the side of the head.',
      '`8You take `@1 damage`8.',
      '`8The child sprints away immediately.',
      '`8There is no explanation.',
      '`8There will never be an explanation.',
    ],
    damage: 1,
  },

  {
    id: 'funny_tuesday_fight',
    category: 'absurd',
    triggers: ['tavern'],
    weight: 1,
    lines: [
      '`8Two men are brawling viciously in the corner.',
      '`8The entire tavern ignores them.',
      '`8The barmaid steps over one to collect empty mugs.',
      '`8You ask the man beside you what they\'re fighting about.',
      '`7"Tuesday,"` he says, and takes a long drink.',
      '`8He does not elaborate.',
      '`8You decide not to ask.',
    ],
  },

  {
    id: 'funny_well_dressed_man',
    category: 'absurd',
    triggers: ['forest'],
    weight: 1,
    lines: [
      '`8You stop to catch your breath against a tree.',
      '`8A man steps out of the undergrowth.',
      '`8He is extremely well-dressed for someone in a forest.',
      '`7"Terrible place for a rest,"` he says, surveying your surroundings.',
      '`7"The moisture alone."` He shakes his head.',
      '`8He turns and walks back into the undergrowth.',
      '`8You never learn what he was doing there.',
      '`8The moisture is, in fact, quite high.',
    ],
  },

];

// ── Core function ─────────────────────────────────────────────────────────────

// Check whether a secret fires for this player at this trigger point.
// Returns { lines, damage } if a secret fires, or null if nothing happens.
async function checkSecrets(player, trigger) {
  const rate = RATES[trigger] || 0.05;
  if (Math.random() > rate) return null;

  const seen = await getSeenSecrets(player.id);
  const seenSet = new Set(seen);

  const eligible = SECRETS.filter(s =>
    s.triggers.includes(trigger) && !seenSet.has(s.id)
  );
  if (!eligible.length) return null;

  // Weighted random pick
  const pool = [];
  for (const s of eligible) {
    for (let i = 0; i < (s.weight || 1); i++) pool.push(s);
  }
  const picked = pool[Math.floor(Math.random() * pool.length)];

  await recordSecret(player.id, picked.id);

  return { lines: picked.lines, damage: picked.damage || 0 };
}

module.exports = { checkSecrets };
