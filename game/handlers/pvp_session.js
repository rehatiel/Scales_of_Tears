// Real-time two-player PvP session handlers
const {
  getPlayer, updatePlayer, addNews, collectBounties,
  getPvpSession, getActivePvpSessionForPlayer, updatePvpSession, completePvpSession,
} = require('../../db');

// ── Challenge flavor text ─────────────────────────────────────────────────────
const CHALLENGE_OPENERS = [
  (a, d) => `\`@${a} spits at ${d}'s boots.\`% "Draw your weapon, you miserable wretch."`,
  (a, d) => `\`@${a} slaps ${d} across the face with an open hand.\`% "I've killed better fighters than you for sport."`,
  (a, d) => `\`@${a} shoves ${d} into the wall.\`% "Your mother raised a coward. Time to prove her wrong."`,
  (a, d) => `\`@${a} hurls a mug of ale directly at ${d}'s head.\`% "That's for existing. Now let's settle this properly."`,
  (a, d) => `\`@${a} draws a blade and plants it in the table in front of ${d}.\`% "Pick it up or crawl out of here — your choice."`,
  (a, d) => `\`@${a} grabs ${d} by the collar.\`% "Your reputation precedes you. It's mostly embarrassing."`,
  (a, d) => `\`@${a} loudly announces to the tavern:\`% "I've seen farmers with more fighting spirit than ${d} here."`,
  (a, d) => `\`@${a} drops a coin purse at ${d}'s feet.\`% "For your funeral arrangements. You'll need it."`,
  (a, d) => `\`@${a} whispers in ${d}'s ear:\`% "I knew your father. He'd be disappointed in what you've become."`,
  (a, d) => `\`@${a} knocks ${d}'s drink from their hand.\`% "Apologies. My fist slipped. Fight me and I'll buy you another."`,
  (a, d) => `\`@${a} leaves a dead rat on ${d}'s table.\`% "A gift, from one rat to another. Except you're worse."`,
  (a, d) => `\`@${a} stands on a chair and points at ${d}.\`% "This one's been avoiding me for weeks. Scared to die, are we?"`,
  (a, d) => `\`@${a} taps ${d} on the shoulder and steps back.\`% "Your mother sends her regards. She says she's seen better swordwork from a tavern mop."`,
  (a, d) => `\`@${a} draws a crude portrait of ${d} and shows it around the tavern.\`% It is very unflattering. "Accurate, no?"`,
  (a, d) => `\`@${a} 'accidentally' elbows ${d} in the face.\`% "Oh — didn't see you there. You're hard to notice, being so thoroughly unremarkable."`,
];

function pickChallengeMsg(attackerHandle, defenderHandle) {
  const fn = CHALLENGE_OPENERS[Math.floor(Math.random() * CHALLENGE_OPENERS.length)];
  return fn(attackerHandle, defenderHandle);
}

// ── Cowardice news ────────────────────────────────────────────────────────────
const COWARDICE_NEWS = [
  (c, d) => `\`8The realm whispers: \`7${d}\`8 turned tail and ran when \`7${c}\`8 challenged them to a duel. The whole tavern saw it.`,
  (c, d) => `\`8Word spreads fast: \`7${d}\`8 soiled their boots and refused to face \`7${c}\`8 in combat. Children are laughing.`,
  (c, d) => `\`8A bard has composed a short ditty about \`7${d}\`8\`8, who fled \`7${c}\`8's challenge like a startled hen.`,
  (c, d) => `\`8Criers announce: \`7${d}\`8 was challenged by \`7${c}\`8 and chose survival over dignity. A wise coward, some say.`,
  (c, d) => `\`8${d}\`8 refused \`7${c}\`8's duel today. The tavern has started a new tradition: leaving an empty chair in their honour.`,
  (c, d) => `\`8Rumour has it \`7${d}\`8 developed a sudden illness the moment \`7${c}\`8 drew a weapon. A miraculous recovery followed.`,
  (c, d) => `\`8${d}\`8 declined \`7${c}\`8's challenge. Their mother's reputation, already questionable, has taken a further blow.`,
  (c, d) => `\`8The gods note with disappointment that \`7${d}\`8 refused to fight \`7${c}\`8 today. Even the pigeons outside seemed ashamed.`,
  (c, d) => `\`8\`7${d}\`8 was seen sprinting away from \`7${c}\`8's challenge. Witnesses describe it as "impressively fast for someone so yellow."`,
  (c, d) => `\`8Historians will record that \`7${d}\`8 had every opportunity to duel \`7${c}\`8, and chose, instead, to do absolutely nothing.`,
];

const TIMEOUT_NEWS = [
  (c, d) => `\`8${d}\`8 was challenged to a duel by \`7${c}\`8 and simply... ignored it. Some battles are lost before they begin.`,
  (c, d) => `\`8\`7${c}\`8 waited, weapon drawn, while \`7${d}\`8 stared into the middle distance. The challenge expired. So did their reputation.`,
  (c, d) => `\`8Witnesses say \`7${d}\`8 went very still when \`7${c}\`8 challenged them, and remained that way until the moment passed.`,
  (c, d) => `\`8\`7${c}\`8's challenge to \`7${d}\`8 went unanswered. \`7${d}\`8 claims they didn't hear it. Nobody believes them.`,
  (c, d) => `\`8The challenge between \`7${c}\`8 and \`7${d}\`8 ended before it began. \`7${d}\`8 will not be making eye contact at the tavern for some time.`,
];

function pickCowardiceNews(challengerHandle, defenderHandle, timedOut = false) {
  const pool = timedOut ? TIMEOUT_NEWS : COWARDICE_NEWS;
  const fn = pool[Math.floor(Math.random() * pool.length)];
  return fn(challengerHandle, defenderHandle);
}
const { resolvePvPRound } = require('../combat');
const { checkLevelUp } = require('../newday');
const {
  getPvPSessionScreen, getPvPSessionWaitingScreen, getPvPChallengeScreen,
} = require('../engine');
const { buildTitleAward } = require('../titles');
const { push: ssePush } = require('../sse');

// ── Helpers ───────────────────────────────────────────────────────────────────

function nextTurn(session, player) {
  const isChallenger = session.challenger_id === player.id;
  return isChallenger ? 'defender' : 'challenger';
}

function deadline() {
  return new Date(Date.now() + 60000).toISOString();
}

// Build a pvpState object (like the session-only one) from a pvp_sessions row
// for use with resolvePvPRound — represents the OPPONENT of `player`
function buildPvpState(session, player, opponentFull) {
  const isChallenger = session.challenger_id === player.id;
  const oppHp     = isChallenger ? session.defender_hp  : session.challenger_hp;
  const oppSkill  = isChallenger ? session.defender_skill_uses : session.challenger_skill_uses;
  return {
    targetId:        opponentFull.id,
    handle:          opponentFull.handle,
    weapon_name:     opponentFull.weapon_name || 'steel',
    class:           opponentFull.class,
    currentHp:       oppHp,
    maxHp:           isChallenger ? session.defender_max_hp : session.challenger_max_hp,
    strength:        opponentFull.strength,
    defense:         opponentFull.defense,
    level:           opponentFull.level,
    perks:           opponentFull.perks,
    specialization:  opponentFull.specialization,
    skill_uses_left: oppSkill,
    is_vampire:      opponentFull.is_vampire || false,
    charm:           opponentFull.charm || 0,
  };
}

// Append lines to session log (keep last 40 entries)
function appendLog(session, lines) {
  const log = (session.log || []).concat(lines);
  return log.slice(-40);
}

// ── Timeout handling ───────────────────────────────────────────────────────────
// Returns the (possibly-updated) session after applying any timeout, or null if
// the session was already finished before we got here.
async function _applyTimeout(session) {
  if (!session.turn_deadline) return session;
  if (session.status !== 'pending' && session.status !== 'active') return session;
  if (new Date(session.turn_deadline) > new Date()) return session; // not expired yet

  if (session.status === 'pending') {
    // Nobody accepted in time — auto-cancel, refund challenger's fight
    await updatePvpSession(session.id, { status: 'declined' });
    const challenger = await getPlayer(session.challenger_id);
    const defender   = await getPlayer(session.defender_id);
    if (challenger) {
      await updatePlayer(challenger.id, { human_fights_left: challenger.human_fights_left + 1 });
    }
    if (challenger && defender) {
      await addNews(pickCowardiceNews(challenger.handle, defender.handle, true));
    }
    const timedSession = { ...session, status: 'declined', _timedOut: true, _timeoutType: 'pending' };
    // Push to both: challenger gets "expired" message, defender gets unblocked
    try {
      if (challenger) {
        const { getTownScreen } = require('../engine');
        ssePush(challenger.id, {
          ...getTownScreen(challenger),
          pendingMessages: [`\`7${defender ? defender.handle : 'Your opponent'} never responded. Challenge expired. Your fight has been refunded.`],
        });
      }
      if (defender) {
        const { getTownScreen } = require('../engine');
        ssePush(defender.id, {
          ...getTownScreen(defender),
          pendingMessages: [`\`8The challenge from ${challenger ? challenger.handle : 'someone'} has expired.`],
        });
      }
    } catch {}
    return timedSession;
  }

  // Active turn timed out — current_turn player forfeits (treated as a flee)
  const forfeitRole  = session.current_turn; // 'challenger' | 'defender'
  const forfeitId    = forfeitRole === 'challenger' ? session.challenger_id : session.defender_id;
  const winnerId     = forfeitRole === 'challenger' ? session.defender_id   : session.challenger_id;

  await updatePvpSession(session.id, {
    status:    'complete',
    winner_id: winnerId,
    log:       appendLog(session, [`\`7Time ran out — ${forfeitRole} forfeits the duel!`]),
  });
  await completePvpSession(session.id, winnerId); // belt-and-suspenders

  // Award the winner a consolation exp bonus
  const winner = await getPlayer(winnerId);
  if (winner) await updatePlayer(winnerId, { exp: Number(winner.exp) + 50 });

  const timedActiveSession = { ...session, status: 'complete', winner_id: winnerId, _timedOut: true, _timeoutType: 'active', _forfeitId: forfeitId };
  // Push final result to both players
  try {
    const forfeitPlayer = await getPlayer(forfeitId);
    const winnerPlayer  = winner || await getPlayer(winnerId);
    const { getTownScreen } = require('../engine');
    if (forfeitPlayer) {
      ssePush(forfeitId, {
        ...getTownScreen(forfeitPlayer),
        pendingMessages: [`\`@You ran out of time and forfeited the duel to ${winnerPlayer ? winnerPlayer.handle : 'your opponent'}.`],
      });
    }
    if (winnerPlayer) {
      ssePush(winnerId, {
        ...getTownScreen(winnerPlayer),
        pendingMessages: [`\`$${forfeitPlayer ? forfeitPlayer.handle : 'Your opponent'} ran out of time. You win the duel!`],
      });
    }
  } catch {}
  return timedActiveSession;
}

// ── pvp_sess_check ─────────────────────────────────────────────────────────────
// Polling endpoint — called periodically by the waiting player.
// Returns the current screen for this player based on session state.
async function pvp_sess_check({ player, req, res, pendingMessages }) {
  const sessionId = req.session.livePvpId;
  if (!sessionId) {
    const found = await getActivePvpSessionForPlayer(player.id);
    if (!found) {
      const { getTownScreen } = require('../engine');
      return res.json({ ...getTownScreen(player), pendingMessages });
    }
    req.session.livePvpId = found.id;
    const resolved = await _applyTimeout(found);
    return _renderSessionScreen(player, resolved, req, res, pendingMessages);
  }
  let session = await getPvpSession(sessionId);
  if (!session) {
    req.session.livePvpId = null;
    const { getTownScreen } = require('../engine');
    return res.json({ ...getTownScreen(player), pendingMessages });
  }
  session = await _applyTimeout(session);
  return _renderSessionScreen(player, session, req, res, pendingMessages);
}

// ── pvp_sess_withdraw ──────────────────────────────────────────────────────────
// Challenger withdraws a pending challenge before it's accepted.
async function pvp_sess_withdraw({ player, req, res, pendingMessages }) {
  const sessionId = req.session.livePvpId;
  const session = sessionId ? await getPvpSession(sessionId) : await getActivePvpSessionForPlayer(player.id);

  if (session && session.challenger_id === player.id && session.status === 'pending') {
    await updatePvpSession(session.id, { status: 'declined' });
    await updatePlayer(player.id, { human_fights_left: player.human_fights_left + 1 });
    // Push town screen to defender so they're unblocked immediately
    try {
      const defender = await getPlayer(session.defender_id);
      if (defender) {
        const { getTownScreen } = require('../engine');
        ssePush(session.defender_id, {
          ...getTownScreen(defender),
          pendingMessages: [`\`7${player.handle} withdrew their challenge.`],
        });
      }
    } catch {}
  }

  req.session.livePvpId = null;
  const { getTownScreen } = require('../engine');
  return res.json({
    ...getTownScreen(player),
    pendingMessages: [`\`7You withdraw your challenge. Probably for the best.`],
  });
}

// ── pvp_sess_accept ────────────────────────────────────────────────────────────
// Defender accepts the challenge. A coin flip determines first turn.
async function pvp_sess_accept({ player, req, res, pendingMessages }) {
  const session = await getActivePvpSessionForPlayer(player.id);
  if (!session || session.defender_id !== player.id || session.status !== 'pending') {
    const { getTownScreen } = require('../engine');
    return res.json({ ...getTownScreen(player), pendingMessages: ['`@No pending challenge found.'] });
  }

  // Random roll for first turn
  const firstTurn = Math.random() < 0.5 ? 'challenger' : 'defender';
  await updatePvpSession(session.id, {
    status:       'active',
    current_turn: firstTurn,
    turn_deadline: deadline(),
    log: [firstTurn === 'challenger'
      ? `\`7A coin flip gives first strike to the challenger!`
      : `\`7A coin flip gives first strike to the defender!`
    ],
  });

  req.session.livePvpId = session.id;
  const updatedSession = await getPvpSession(session.id);
  // Push to challenger so they see their turn (or waiting) immediately
  pushPvpUpdate(updatedSession, player.id).catch(() => {});
  return _renderSessionScreen(player, updatedSession, req, res, pendingMessages);
}

// ── pvp_sess_decline ───────────────────────────────────────────────────────────
// Defender declines. Session is cancelled; challenger gets their fight back.
async function pvp_sess_decline({ player, req, res, pendingMessages }) {
  const session = await getActivePvpSessionForPlayer(player.id);
  if (session && session.defender_id === player.id && session.status === 'pending') {
    await updatePvpSession(session.id, { status: 'declined' });
    const challenger = await getPlayer(session.challenger_id);
    if (challenger) {
      await updatePlayer(challenger.id, { human_fights_left: challenger.human_fights_left + 1 });
      await addNews(pickCowardiceNews(challenger.handle, player.handle, false));
      // Push "declined" screen to challenger immediately
      const freshSession = await getPvpSession(session.id);
      pushPvpUpdate(freshSession || session, player.id).catch(() => {});
    }
  }
  req.session.livePvpId = null;
  const { getTownScreen } = require('../engine');
  return res.json({
    ...getTownScreen(player),
    pendingMessages: ['`7You declined the challenge. The whole tavern noticed.'],
  });
}

// ── pvp_sess_attack / pvp_sess_power / pvp_sess_run ────────────────────────────

async function pvp_sess_combat({ player, action, req, res, pendingMessages }) {
  const sessionId = req.session.livePvpId;
  if (!sessionId) {
    const { getTownScreen } = require('../engine');
    return res.json({ ...getTownScreen(player), pendingMessages });
  }

  const session = await getPvpSession(sessionId);
  if (!session || session.status !== 'active') {
    req.session.livePvpId = null;
    const { getTownScreen } = require('../engine');
    return res.json({ ...getTownScreen(player), pendingMessages });
  }

  // Verify it's this player's turn
  const isChallenger = session.challenger_id === player.id;
  const myRole = isChallenger ? 'challenger' : 'defender';
  if (session.current_turn !== myRole) {
    // Not your turn — return waiting screen
    const opponentFull = await getPlayer(isChallenger ? session.defender_id : session.challenger_id);
    return res.json({
      ...getPvPSessionWaitingScreen(player, session, opponentFull.handle, [], session.log || []),
      pendingMessages,
    });
  }

  const oppId = isChallenger ? session.defender_id : session.challenger_id;
  const opponentFull = await getPlayer(oppId);
  if (!opponentFull) {
    // Opponent gone — award victory
    await completePvpSession(session.id, player.id);
    req.session.livePvpId = null;
    const { getTownScreen } = require('../engine');
    return res.json({ ...getTownScreen(player), pendingMessages: ['`7Your opponent has disappeared. Victory by default.'] });
  }

  const act = { pvp_sess_attack: 'attack', pvp_sess_run: 'run', pvp_sess_power: 'power' }[action] || 'attack';

  // Build a pvpState from the live session so resolvePvPRound can calculate damage
  const pvpState = buildPvpState(session, player, opponentFull);

  // Sync player's HP from the session (may differ from DB if they've taken hits)
  const myHpCurrent = isChallenger ? session.challenger_hp : session.defender_hp;
  const playerSnapshot = { ...player, hit_points: myHpCurrent, skill_uses_left: isChallenger ? session.challenger_skill_uses : session.defender_skill_uses };

  const result = resolvePvPRound(playerSnapshot, pvpState, act);
  const roundLines = result.log.map(e => e.text);

  // ── Fled ────────────────────────────────────────────────────────────────────
  if (result.fled) {
    const newLog = appendLog(session, [`\`7${player.handle} fled the duel!`]);
    await completePvpSession(session.id, opponentFull.id);
    req.session.livePvpId = null;
    // Refund opp's fight counter since they didn't finish it
    return res.json({
      ...getPvPSessionScreen(player, { ...session, log: newLog }, opponentFull.handle, roundLines, [], false, false, true, false),
      pendingMessages,
    });
  }

  // ── Compute new HP values ────────────────────────────────────────────────────
  const newMyHp  = Math.max(0, myHpCurrent - result.defenderDamage);
  const newOppHp = Math.max(0, pvpState.currentHp - result.playerDamage);

  const newMySkill  = act === 'power' ? Math.max(0, (isChallenger ? session.challenger_skill_uses : session.defender_skill_uses) - 1) : (isChallenger ? session.challenger_skill_uses : session.defender_skill_uses);
  const newOppSkill = isChallenger ? session.defender_skill_uses : session.challenger_skill_uses;

  const updatedFields = {
    round:        session.round + 1,
    current_turn: nextTurn(session, player),
    turn_deadline: deadline(),
    log:          appendLog(session, roundLines),
  };

  if (isChallenger) {
    updatedFields.challenger_hp           = newMyHp;
    updatedFields.defender_hp             = newOppHp;
    updatedFields.challenger_skill_uses   = newMySkill;
  } else {
    updatedFields.defender_hp             = newMyHp;
    updatedFields.challenger_hp           = newOppHp;
    updatedFields.defender_skill_uses     = newMySkill;
  }

  // ── Check for deaths ─────────────────────────────────────────────────────────
  const iDied  = newMyHp  <= 0;
  const oppDied = newOppHp <= 0;

  if (iDied || oppDied) {
    const winnerId = oppDied ? player.id : opponentFull.id;
    const loserId  = oppDied ? opponentFull.id : player.id;
    updatedFields.status    = 'complete';
    updatedFields.winner_id = winnerId;
    await updatePvpSession(session.id, updatedFields);
    req.session.livePvpId = null;

    const winner = await getPlayer(winnerId);
    const loser  = await getPlayer(loserId);

    // ── Loser: mark dead, lose gold ─────────────────────────────────────────
    const goldStolen = Math.floor(Number(loser.gold) * 0.1);
    const expGain    = loser.level * 120;
    await updatePlayer(loserId, { dead: 1, hit_points: 0, gold: Math.max(0, Number(loser.gold) - goldStolen) });
    await updatePlayer(winnerId, { kills: winner.kills + 1, gold: Number(winner.gold) + goldStolen, exp: Number(winner.exp) + expGain });

    const bountyGold = await collectBounties(winnerId, loserId);

    await addNews(`\`!${winner.handle}\`% slew \`@${loser.handle}\`% in a live duel!`);

    // Level up check
    let levelMsg = null;
    let freshWinner = await getPlayer(winnerId);
    const lu = checkLevelUp(freshWinner);
    if (lu) {
      await updatePlayer(winnerId, lu.updates);
      freshWinner = await getPlayer(winnerId);
      await addNews(`\`$${freshWinner.handle}\`% has reached level \`$${lu.newLevel}\`%!`);
      levelMsg = `\`$LEVEL UP! You are now level ${lu.newLevel}!`;
    }

    let titleMsg = null;
    const titleAward = buildTitleAward(freshWinner, 'duelist');
    if (titleAward && oppDied) {
      await updatePlayer(winnerId, titleAward);
      freshWinner = await getPlayer(winnerId);
      titleMsg = '`$You have earned the title: `$the Duelist`$!';
      await addNews(`\`$${freshWinner.handle}\`% has earned the title \`$the Duelist\`%!`);
    }

    const endLines = [
      ...roundLines,
      oppDied ? `\`$You have slain ${opponentFull.handle}! +${expGain.toLocaleString()} exp, +${goldStolen.toLocaleString()} gold` : `\`@${opponentFull.handle} has slain you!`,
      bountyGold > 0 ? `\`$You collect a bounty of ${bountyGold.toLocaleString()} gold!` : null,
      levelMsg,
      titleMsg,
    ].filter(Boolean);

    const refreshedPlayer = await getPlayer(player.id);
    const freshSession = { ...session, ...updatedFields };

    // Push result screen to the other player via SSE
    try {
      const otherPlayer = oppDied ? opponentFull : await getPlayer(winner.id);
      const otherScreen = await _buildScreenForPlayer(otherPlayer, freshSession);
      ssePush(otherPlayer.id, otherScreen);
    } catch {}

    if (oppDied) {
      return res.json({
        ...getPvPSessionScreen(refreshedPlayer, freshSession, opponentFull.handle, endLines, [], true, false, false, false),
        pendingMessages,
      });
    } else {
      return res.json({
        ...getPvPSessionScreen(refreshedPlayer, freshSession, opponentFull.handle, endLines, [], false, true, false, false),
        pendingMessages,
      });
    }
  }

  // ── Combat continues ─────────────────────────────────────────────────────────
  await updatePvpSession(session.id, updatedFields);
  const freshSession = await getPvpSession(session.id);
  const refreshedPlayer = await getPlayer(player.id);

  // Push opponent's turn screen to them via SSE
  pushPvpUpdate(freshSession, player.id).catch(() => {});

  // This player just acted — show them the waiting screen until opponent moves
  return res.json({
    ...getPvPSessionWaitingScreen(refreshedPlayer, freshSession, opponentFull.handle, roundLines, freshSession.log || []),
    pendingMessages,
  });
}

const pvp_sess_attack = pvp_sess_combat;
const pvp_sess_power  = pvp_sess_combat;
const pvp_sess_run    = pvp_sess_combat;

// ── _buildScreenForPlayer ──────────────────────────────────────────────────────
// Pure screen builder — no session mutation, safe for SSE push.
async function _buildScreenForPlayer(player, session, pendingMessages = []) {
  const isChallenger = session.challenger_id === player.id;
  const oppId = isChallenger ? session.defender_id : session.challenger_id;
  const opponentFull = await getPlayer(oppId);
  const opponentHandle = opponentFull ? opponentFull.handle : 'Unknown';
  const log = session.log || [];
  const { getTownScreen } = require('../engine');

  if (session.status === 'pending') {
    if (session.defender_id === player.id) {
      return { ...getPvPChallengeScreen(player, session, opponentHandle), pendingMessages };
    }
    return { ...getPvPSessionWaitingScreen(player, session, opponentHandle, [], log), pendingMessages };
  }

  if (session.status === 'declined') {
    const wasChallenged = session.defender_id === player.id;
    const msg = wasChallenged
      ? '`7You declined the challenge. Wise choice... or cowardly. Hard to say.'
      : `\`7${opponentHandle} declined your challenge. Your fight has been refunded.`;
    return { ...getTownScreen(player), pendingMessages: [msg] };
  }

  if (session.status === 'complete') {
    const iWon = session.winner_id === player.id;
    const msg = iWon
      ? `\`$You won the duel against ${opponentHandle}!`
      : `\`@You were defeated by ${opponentHandle}.`;
    return { ...getTownScreen(player), pendingMessages: [msg] };
  }

  // Active
  const myRole = isChallenger ? 'challenger' : 'defender';
  if (session.current_turn === myRole) {
    return { ...getPvPSessionScreen(player, session, opponentHandle, [], log, false, false, false, false), pendingMessages };
  }
  return { ...getPvPSessionWaitingScreen(player, session, opponentHandle, [], log), pendingMessages };
}

// Push the current session screen to the OTHER player via SSE.
// actingPlayerId is whoever just caused the state change.
async function pushPvpUpdate(session, actingPlayerId) {
  const otherId = String(session.challenger_id) === String(actingPlayerId)
    ? session.defender_id
    : session.challenger_id;
  try {
    const otherPlayer = await getPlayer(otherId);
    if (!otherPlayer) return;
    // Fetch freshest session state
    const fresh = await getPvpSession(session.id);
    const screen = await _buildScreenForPlayer(otherPlayer, fresh || session);
    ssePush(otherId, screen);
  } catch { /* best-effort */ }
}

// ── Internal: render the right screen for the current session state ────────────
async function _renderSessionScreen(player, session, req, res, pendingMessages) {
  const isChallenger = session.challenger_id === player.id;
  const oppId = isChallenger ? session.defender_id : session.challenger_id;
  const opponentFull = await getPlayer(oppId);
  const opponentHandle = opponentFull ? opponentFull.handle : 'Unknown';
  const log = session.log || [];

  if (session.status === 'pending') {
    if (session.defender_id === player.id) {
      // Defender sees the challenge screen
      req.session.livePvpId = session.id;
      return res.json({ ...getPvPChallengeScreen(player, session, opponentHandle), pendingMessages });
    } else {
      // Challenger is waiting
      return res.json({
        ...getPvPSessionWaitingScreen(player, session, opponentHandle, [], log),
        pendingMessages,
      });
    }
  }

  if (session.status === 'declined') {
    req.session.livePvpId = null;
    const { getTownScreen } = require('../engine');
    const isChallenger2 = session.challenger_id === player.id;
    let msg;
    if (!isChallenger2) {
      msg = '`7You declined the challenge. Wise choice... or cowardly. Hard to say.';
    } else if (session._timedOut) {
      msg = `\`7${opponentHandle} never showed up. Challenge expired. Your fight has been refunded.`;
    } else {
      msg = `\`7${opponentHandle} takes one look at you and quietly backs toward the door. They declined.`;
    }
    return res.json({ ...getTownScreen(player), pendingMessages: [msg] });
  }

  if (session.status === 'complete') {
    const iWon = session.winner_id === player.id;
    req.session.livePvpId = null;
    const { getTownScreen } = require('../engine');
    const msg = iWon ? `\`$You won the duel against ${opponentHandle}!` : `\`@You were defeated by ${opponentHandle}.`;
    return res.json({ ...getTownScreen(player), pendingMessages: [msg] });
  }

  // Active session
  const myRole = isChallenger ? 'challenger' : 'defender';
  if (session.current_turn === myRole) {
    return res.json({
      ...getPvPSessionScreen(player, session, opponentHandle, [], log, false, false, false, false),
      pendingMessages,
    });
  } else {
    return res.json({
      ...getPvPSessionWaitingScreen(player, session, opponentHandle, [], log),
      pendingMessages,
    });
  }
}

module.exports = {
  pvp_sess_check,
  pvp_sess_accept,
  pvp_sess_decline,
  pvp_sess_withdraw,
  pvp_sess_attack,
  pvp_sess_power,
  pvp_sess_run,
  pickChallengeMsg,
};
