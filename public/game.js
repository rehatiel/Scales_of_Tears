// SoT — Client

// ── Color parser ──────────────────────────────────────────────────────────────
const COLOR_MAP = {
  '1':'c1','2':'c2','3':'c3','4':'c4','5':'c5','6':'c6',
  '7':'c7','8':'c8','9':'c9','0':'c0','!':'ce','@':'ca',
  '#':'ch','$':'cd','%':'cp',
  'a':'b0','b':'b1','c':'b2','d':'b3','e':'b4','f':'b5','g':'b6','h':'b7',
};

function parseLine(text) {
  if (!text) return '<span class="c7"> </span>';
  const segs = [];
  let fg = 'c7', bg = '', buf = '', i = 0;
  while (i < text.length) {
    if (text[i] === '`' && COLOR_MAP[text[i+1]] !== undefined) {
      if (buf) segs.push({ fg, bg, buf });
      const mapped = COLOR_MAP[text[i+1]];
      if (mapped[0] === 'b') bg = mapped; else fg = mapped;
      buf = ''; i += 2;
    } else { buf += text[i++]; }
  }
  if (buf) segs.push({ fg, bg, buf });
  if (!segs.length) return '<span class="c7"> </span>';
  return segs.map(s => {
    const cls = s.bg ? `${s.fg} ${s.bg}` : s.fg;
    return `<span class="${cls}">${escHtml(s.buf)}</span>`;
  }).join('');
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const authScreen   = document.getElementById('auth-screen');
const setupScreen  = document.getElementById('setup-screen');
const gameScreen   = document.getElementById('game-screen');
const terminal     = document.getElementById('terminal');
const termOutput   = document.getElementById('terminal-output');
const inputArea    = document.getElementById('input-area');
const inputLabel   = document.getElementById('input-label');
const gameInput    = document.getElementById('game-input');
const inputSubmit  = document.getElementById('input-submit');
const inputCancel  = document.getElementById('input-cancel');
const statusBar    = document.getElementById('status-bar');
const msgOverlay   = document.getElementById('msg-overlay');
const msgContent   = document.getElementById('msg-content');
const authNotice   = document.getElementById('auth-notice');

// ── Screen switchers ──────────────────────────────────────────────────────────
function showAuth() {
  authScreen.classList.remove('hidden');
  setupScreen.classList.add('hidden');
  gameScreen.classList.add('hidden');
  statusBar.classList.add('hidden');
}
function showSetup() {
  authScreen.classList.add('hidden');
  setupScreen.classList.remove('hidden');
  gameScreen.classList.add('hidden');
  statusBar.classList.add('hidden');
  // Reset wizard state so a second character starts clean
  wizard.name = '';
  wizard.sex = null;
  wizard.classNum = null;
  charNameInput.value = '';
  nameNext.disabled = true;
  document.getElementById('confirm-submit').disabled = false;
  document.getElementById('confirm-submit').textContent = '⚔ Enter the Realm!';
  document.getElementById('setup-error').textContent = '';
  wizardGoTo(1);
}
function showGame() {
  authScreen.classList.add('hidden');
  setupScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  openSse();
}

// ── Status bar ────────────────────────────────────────────────────────────────
function updateStatusBar(status) {
  if (!status) return;
  const hpPct = status.hpMax > 0 ? status.hp / status.hpMax : 1;
  const hpClass = hpPct > 0.5 ? 'c0' : hpPct > 0.25 ? 'cd' : 'ca';
  document.getElementById('sb-name').innerHTML     = `<span class="cd">${escHtml(status.name)}</span>`;
  document.getElementById('sb-hp').innerHTML       = `<span class="c8">HP </span><span class="${hpClass}">${status.hp}/${status.hpMax}</span>`;
  document.getElementById('sb-stamina').innerHTML  = `<span class="c8">STM </span><span class="c3">${status.stamina}/${status.staminaMax}</span>`;
  document.getElementById('sb-gold').innerHTML     = `<span class="c8">GOLD </span><span class="cd">${status.gold.toLocaleString()}</span>`;
  document.getElementById('sb-level').innerHTML    = `<span class="c8">LV </span><span class="cp">${status.level}</span>`;
  const expNext = status.expNext;
  document.getElementById('sb-exp').innerHTML = expNext
    ? `<span class="c8">EXP </span><span class="c3">${status.exp.toLocaleString()}</span><span class="c8">/${expNext.toLocaleString()}</span>`
    : `<span class="c8">EXP </span><span class="cd">${status.exp.toLocaleString()}</span><span class="c8"> MAX</span>`;
  document.getElementById('sb-location').innerHTML = `<span class="c8">@ </span><span class="ce">${escHtml(status.location)}</span>`;
  document.getElementById('sb-time').innerHTML     = `<span class="c6">${escHtml(status.timeOfDay)}</span>`;
  document.getElementById('sb-day').innerHTML      = `<span class="c8">Day </span><span class="c6">${status.lordDay}</span>`;
  const poisonEl = document.getElementById('sb-poison');
  if (status.poisoned) {
    poisonEl.innerHTML = `<span class="sb-sep">│</span><span class="ca">☠ POISONED</span>`;
    poisonEl.classList.remove('hidden');
  } else {
    poisonEl.classList.add('hidden');
  }
  statusBar.classList.remove('hidden');
}

// ── Game render ───────────────────────────────────────────────────────────────
let currentChoices = [];
let pendingInputAction = null, pendingInputParam = null;
let loadingEl = null;

function renderScreen(data) {
  if (!data) return;
  if (data.screen === 'setup') {
    showSetup();
    return;
  }

  if (data.screen === 'login') {
    closeSse();
    if (data.campLogout) {
      authNotice.textContent = data.sleepMessage || 'You have settled in for the night. Log back in when a new day comes.';
      authNotice.classList.remove('hidden');
    } else {
      authNotice.classList.add('hidden');
    }
    showAuth();
    return;
  }

  if (data.title) document.title = `${data.title} — SoT`;
  if (data.status) updateStatusBar(data.status);
  hideInput();

  // Replace terminal content
  termOutput.innerHTML = '';

  // Screen lines (ANSI art etc. always first)
  // Strip lines that are just choice indicators — they're already rendered as buttons below.
  // A "choice line" is one whose content (after stripping color codes) begins with [KEY].
  const choiceKeys = new Set((data.choices || []).map(c => c.key.toUpperCase()));
  const visibleLines = (data.lines || []).filter(line => {
    if (!choiceKeys.size) return true;
    const stripped = line.replace(/`[0-9!@#$%a-h]/g, '').trim();
    const m = stripped.match(/^\[(.)\]/);
    return !(m && choiceKeys.has(m[1].toUpperCase()));
  });

  if (visibleLines.length) {
    const linesDiv = document.createElement('div');
    linesDiv.innerHTML = visibleLines.map(l =>
      `<span class="tline">${parseLine(l)}</span>`
    ).join('');
    termOutput.appendChild(linesDiv);
  }

  // Pending messages: overlay for town screen, inline just above choices otherwise
  const msgs = data.pendingMessages || [];
  if (msgs.length && data.screen === 'town') {
    msgContent.innerHTML = msgs.map(m => `<span class="pmsg">${parseLine(m)}</span>`).join('');
    msgOverlay.classList.remove('hidden');
  } else if (msgs.length) {
    const pm = document.createElement('div');
    pm.className = 'pending-block';
    pm.innerHTML = msgs.map(m => `<span class="pmsg">${parseLine(m)}</span>`).join('');
    termOutput.appendChild(pm);
  }

  // Inline choices
  currentChoices = data.choices || [];
  if (currentChoices.length) {
    const choiceDiv = document.createElement('div');
    choiceDiv.className = 'choice-block';
    currentChoices.forEach(c => {
      const item = document.createElement('span');
      item.className = 'choice-item' + (c.disabled ? ' disabled' : '');
      item.innerHTML = `<span class="ck">[${escHtml(c.key)}]</span> ${escHtml(c.label)}`;
      if (!c.disabled) {
        item.addEventListener('click', () => {
          if (item.classList.contains('dead')) return;
          if (c.needsInput) {
            showInput(c.inputLabel || 'Enter:', c.action, c.param || '', c.inputType || 'text', c.inputParam || '');
          } else {
            sendAction(c.action, c.param || '');
          }
        });
      }
      choiceDiv.appendChild(item);
    });
    termOutput.appendChild(choiceDiv);
  }

  terminal.scrollTop = 0;

  if (data.needsInput) {
    showInput(data.inputLabel || 'Enter:', data.inputAction, '', data.inputType || 'text', data.inputParam || '');
  }

}

// ── SSE connection ─────────────────────────────────────────────────────────────
let _sse = null;

function openSse() {
  if (_sse) return;
  _sse = new EventSource('/api/game/stream');
  _sse.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data && data.toast !== undefined) showToast(data.toast);
      else if (data && data.lines !== undefined) renderScreen(data);
    } catch {}
  };
  // EventSource auto-reconnects on error; nothing extra needed
}

function closeSse() {
  if (_sse) { _sse.close(); _sse = null; }
}

// ── Toast notifications ───────────────────────────────────────────────────────
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = parseLine(message);
  container.appendChild(el);
  // Trigger CSS transition
  requestAnimationFrame(() => el.classList.add('toast-visible'));
  setTimeout(() => {
    el.classList.remove('toast-visible');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, 5000);
}

function showInput(label, action, param, type = 'text', inputParam = '') {
  pendingInputAction = action;
  pendingInputParam = inputParam;
  inputLabel.textContent = label;
  gameInput.type = type === 'number' ? 'number' : 'text';
  gameInput.value = '';
  inputArea.classList.remove('hidden');
  gameInput.focus();
}

function hideInput() {
  inputArea.classList.add('hidden');
  pendingInputAction = null;
  pendingInputParam = null;
  gameInput.value = '';
}

// ── API ───────────────────────────────────────────────────────────────────────
async function sendAction(action, param = '') {
  // Freeze choices and show loading indicator
  termOutput.querySelectorAll('.choice-item').forEach(el => el.classList.add('dead'));
  loadingEl = document.createElement('div');
  loadingEl.className = 'term-loading';
  loadingEl.innerHTML = '<span class="c8">· · ·</span>';
  termOutput.appendChild(loadingEl);

  try {
    const body = { action };
    if (param !== '') body.param = param;
    const res = await fetch('/api/game/action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (loadingEl) { loadingEl.remove(); loadingEl = null; }
    if (res.status === 401) { closeSse(); showAuth(); return; }
    renderScreen(await res.json());
  } catch {
    if (loadingEl) { loadingEl.remove(); loadingEl = null; }
    // Re-enable choices on error so the player can retry
    termOutput.querySelectorAll('.choice-item.dead').forEach(el => el.classList.remove('dead'));
    const errEl = document.createElement('div');
    errEl.className = 'pending-block';
    errEl.innerHTML = `<span class="pmsg"><span class="ca">Connection error — please try again.</span></span>`;
    termOutput.appendChild(errEl);
  }
}

async function sendMasterTrain(stat, points) {
  termOutput.querySelectorAll('.choice-item').forEach(el => el.classList.add('dead'));
  loadingEl = document.createElement('div');
  loadingEl.className = 'term-loading';
  loadingEl.innerHTML = '<span class="c8">· · ·</span>';
  termOutput.appendChild(loadingEl);

  try {
    const res = await fetch('/api/game/action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'master_train', inputParam: stat, inputValue: points }),
    });
    if (loadingEl) { loadingEl.remove(); loadingEl = null; }
    if (res.status === 401) { showAuth(); return; }
    renderScreen(await res.json());
  } catch {
    if (loadingEl) { loadingEl.remove(); loadingEl = null; }
    termOutput.querySelectorAll('.choice-item.dead').forEach(el => el.classList.remove('dead'));
  }
}

async function loadGameState() {
  try {
    const res = await fetch('/api/game/state');
    if (res.status === 401) { showAuth(); return; }
    const data = await res.json();
    const ndMsgs = sessionStorage.getItem('newDayMessages');
    if (ndMsgs) {
      try { data.pendingMessages = [...JSON.parse(ndMsgs), ...(data.pendingMessages || [])]; } catch {}
      sessionStorage.removeItem('newDayMessages');
    }
    showGame();
    renderScreen(data);
  } catch { showAuth(); }
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (gameScreen.classList.contains('hidden')) return;
  if (!currentChoices.length) return;
  const match = currentChoices.find(c => c.key.toUpperCase() === e.key.toUpperCase() && !c.disabled);
  if (!match) return;
  e.preventDefault();
  if (match.needsInput) {
    showInput(match.inputLabel || 'Enter:', match.action, match.param || '', match.inputType || 'text', match.inputParam || '');
  } else {
    sendAction(match.action, match.param || '');
  }
});

// Input bar submit
function submitInput() {
  const value = gameInput.value.trim();
  if (!value) return;
  const action = pendingInputAction, iParam = pendingInputParam;
  hideInput();
  if (!action) return;
  if (action === 'master_train') { sendMasterTrain(iParam, value); return; }
  sendAction(action, value);
}
inputSubmit.addEventListener('click', submitInput);
gameInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitInput(); });
inputCancel.addEventListener('click', () => { hideInput(); sendAction('town'); });

// ── Auth forms ────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));
    document.getElementById(`${btn.dataset.tab}-form`).classList.remove('hidden');
  });
});

document.getElementById('login-btn').addEventListener('click', async () => {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  if (!username || !password) { errEl.textContent = 'Please enter username and password.'; return; }
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Login failed.'; return; }
    const loginMsgs = [...(data.newDayMessages || [])];
    if (data.unreadMail > 0) loginMsgs.push(`\`!Hrok waves at you: "Oi — got ${data.unreadMail} letter${data.unreadMail > 1 ? 's' : ''} waiting for ya. Ask me about it at the tavern."`);
    if (loginMsgs.length) sessionStorage.setItem('newDayMessages', JSON.stringify(loginMsgs));
    if (!data.setup_complete) { showSetup(); } else { loadGameState(); }
  } catch { errEl.textContent = 'Connection error.'; }
});

document.getElementById('login-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('login-btn').click();
});

document.getElementById('register-btn').addEventListener('click', async () => {
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl = document.getElementById('register-error');
  errEl.textContent = '';
  if (!username || !password) { errEl.textContent = 'Please fill in all fields.'; return; }
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Registration failed.'; return; }
    const btn = document.getElementById('register-btn');
    btn.textContent = 'Account created!';
    btn.disabled = true;
    await new Promise(r => setTimeout(r, 600));
    showSetup();
  } catch { errEl.textContent = 'Connection error.'; }
});

document.getElementById('reg-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('register-btn').click();
});

// ── Character creation wizard ─────────────────────────────────────────────────
const CLASS_DATA = {
  1:  { name: 'Dread Knight',  hp: 28, str: 20, power: 'Soul Rend — 3× damage' },
  2:  { name: 'Warrior',       hp: 35, str: 16, power: 'Shield Slam — 2× damage' },
  3:  { name: 'Rogue',         hp: 22, str: 17, power: 'Backstab — 2.5× damage' },
  4:  { name: 'Mage',          hp: 20, str: 17, power: 'Arcane Surge — 2.5× damage' },
  5:  { name: 'Ranger',        hp: 25, str: 17, power: 'Aimed Shot — 2.5× damage' },
  6:  { name: 'Paladin',       hp: 32, str: 17, power: 'Divine Smite — 2× damage + self-heal' },
  7:  { name: 'Druid',         hp: 25, str: 18, power: 'Thornlash — 2× damage' },
  8:  { name: 'Necromancer',   hp: 22, str: 19, power: 'Death Coil — 2.5× damage + poison' },
  9:  { name: 'Elementalist',  hp: 18, str: 23, power: 'Elemental Fury — 3.5× damage (costs HP)' },
  10: { name: 'Monk',          hp: 26, str: 18, power: 'Ki Strike — 2.5× damage' },
};

const wizard = { name: '', sex: null, classNum: null };

function wizardGoTo(step) {
  [1,2,3,4].forEach(i => {
    const pip = document.getElementById(`pip-${i}`);
    pip.classList.toggle('active', i === step);
    pip.classList.toggle('done', i < step);
  });
  const stepIds = ['name','sex','class','confirm'];
  stepIds.forEach((id, i) => {
    document.getElementById(`step-${id}`).classList.toggle('hidden', i + 1 !== step);
  });
  if (step === 1) document.getElementById('char-name').focus();
  if (step === 2) {
    document.querySelectorAll('.sex-btn').forEach(b => {
      b.classList.toggle('selected', parseInt(b.dataset.value) === wizard.sex);
    });
    document.getElementById('sex-next').disabled = wizard.sex === null;
  }
  if (step === 3) {
    document.querySelectorAll('.class-card').forEach(c => {
      c.classList.toggle('selected', parseInt(c.dataset.class) === wizard.classNum);
    });
    document.getElementById('class-next').disabled = wizard.classNum === null;
  }
  if (step === 4) {
    const cls = CLASS_DATA[wizard.classNum];
    document.getElementById('confirm-name').textContent  = wizard.name;
    document.getElementById('confirm-sex').textContent   = wizard.sex === 5 ? 'Female' : 'Male';
    document.getElementById('confirm-class').textContent = cls.name;
    document.getElementById('confirm-hp').textContent    = cls.hp;
    document.getElementById('confirm-str').textContent   = cls.str;
    document.getElementById('confirm-power').textContent = cls.power;
  }
}

// Step 1: Name
const charNameInput = document.getElementById('char-name');
const nameNext = document.getElementById('name-next');

charNameInput.addEventListener('input', () => {
  const v = charNameInput.value.trim();
  nameNext.disabled = v.length < 2;
  const hint = document.getElementById('name-hint');
  hint.textContent = `${v.length}/20 characters`;
  hint.style.color = v.length >= 2 ? '#55FF55' : '#555';
});
charNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !nameNext.disabled) nameNext.click();
});
nameNext.addEventListener('click', () => {
  wizard.name = charNameInput.value.trim();
  wizardGoTo(2);
});

// Step 2: Sex
document.getElementById('sex-back').addEventListener('click', () => wizardGoTo(1));
document.querySelectorAll('.sex-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sex-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    wizard.sex = parseInt(btn.dataset.value);
    document.getElementById('sex-next').disabled = false;
  });
});
document.getElementById('sex-next').addEventListener('click', () => wizardGoTo(3));

// Step 3: Class
document.getElementById('class-back').addEventListener('click', () => wizardGoTo(2));
document.querySelectorAll('.class-card').forEach(card => {
  const select = () => {
    document.querySelectorAll('.class-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    wizard.classNum = parseInt(card.dataset.class);
    document.getElementById('class-next').disabled = false;
  };
  card.addEventListener('click', select);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });
});
document.getElementById('class-next').addEventListener('click', () => wizardGoTo(4));

// Step 4: Confirm
document.getElementById('confirm-back').addEventListener('click', () => wizardGoTo(3));
document.getElementById('confirm-submit').addEventListener('click', async () => {
  const btn = document.getElementById('confirm-submit');
  const errEl = document.getElementById('setup-error');
  btn.disabled = true;
  btn.textContent = 'Entering the realm...';
  errEl.textContent = '';
  try {
    const res = await fetch('/api/game/setup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setup_all', name: wizard.name, sex: wizard.sex, classNum: wizard.classNum }),
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.error || 'Setup failed. Please try again.';
      btn.disabled = false; btn.textContent = '⚔ Enter the Realm!';
      return;
    }
    showGame();
    renderScreen(data);
  } catch {
    errEl.textContent = 'Connection error.';
    btn.disabled = false; btn.textContent = '⚔ Enter the Realm!';
  }
});

// ── Message overlay ───────────────────────────────────────────────────────────
msgOverlay.addEventListener('click', () => msgOverlay.classList.add('hidden'));
// Prevent clicks inside the box from closing it (only the backdrop dismisses)
document.getElementById('msg-box').addEventListener('click', e => e.stopPropagation());

// ── Init ──────────────────────────────────────────────────────────────────────
(async function init() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      if (data.setup_complete) { loadGameState(); } else { showSetup(); }
    } else { showAuth(); }
  } catch { showAuth(); }
})();
