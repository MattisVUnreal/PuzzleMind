import { generateRound, applyOp } from './numbers.js';
import { MAX_STARS, PUZZLES, RESULTS, resultFor, starString, puzzleStars, shareText, computeStats } from './round.js';
import { EPOCH, todayId, isDayId, puzzleNumber, formatDay, msUntilMidnight, formatDuration, addDays } from './date.js';

// ---------------------------------------------------------------------------
// Utilities

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(`dt:${key}`);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`dt:${key}`, JSON.stringify(value));
    } catch {
      /* no storage: the game still works, it just won't remember */
    }
  },
};

const settings = Object.assign({ theme: 'system', confirm: true, timer: true }, store.get('settings', {}));
const saveSettings = () => store.set('settings', settings);

let toastTimer;
function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function shake(node) {
  if (!node) return;
  node.classList.remove('shake');
  void node.offsetWidth;
  node.classList.add('shake');
}

const OP_CLASS = { '+': 'op-plus', '−': 'op-minus', '×': 'op-times', '÷': 'op-divide' };
const stars = (n) => `<b>${'★'.repeat(n)}</b>${'☆'.repeat(3 - n)}`;
const randomId = () => Math.random().toString(36).slice(2, 8);

// ---------------------------------------------------------------------------
// Route: today, an earlier day (#dag-YYYY-MM-DD) or practice (#traning-<id>)

const today = todayId();
const route = location.hash.slice(1);
let mode = 'daily';
let dayId = today;
let seed = today;

const practiceMatch = route.match(/^traning-([a-z0-9]+)$/i);
const dayMatch = route.match(/^dag-(\d{4}-\d{2}-\d{2})$/);
if (practiceMatch) {
  mode = 'practice';
  seed = `traning:${practiceMatch[1]}`;
} else if (dayMatch && isDayId(dayMatch[1]) && dayMatch[1] < today && dayMatch[1] >= EPOCH) {
  mode = 'archive';
  dayId = dayMatch[1];
  seed = dayId;
}
window.addEventListener('hashchange', () => location.reload());

const round = generateRound(seed);
const gameKey = mode === 'practice' ? `game:${seed}` : `game:${dayId}`;
const number = mode === 'practice' ? null : puzzleNumber(dayId);
const blank = () => ({
  current: 0,
  puzzles: round.map(() => ({ steps: [], hint: false, done: false, value: null, stars: null })),
  elapsed: 0,
  started: false,
  finished: false,
});
const game = Object.assign(blank(), store.get(gameKey, {}));
const save = () => store.set(gameKey, game);

let sel = null; // selected slot
let op = null; // chosen operator
let lastEq = null; // the calculation just made, shown in the calc row

// ---------------------------------------------------------------------------
// Board state, rebuilt by replaying the steps

function board(i) {
  const p = round[i];
  const slots = p.numbers.map((v) => ({ v, made: false }));
  const lines = [];
  let best = p.numbers.reduce((b, v) => (Math.abs(v - p.target) < Math.abs(b - p.target) ? v : b), p.numbers[0]);
  for (const s of game.puzzles[i].steps) {
    const r = applyOp(slots[s.a].v, slots[s.b].v, s.op);
    slots[s.b] = { v: r.value, made: true };
    slots[s.a] = null;
    lines.push(`${r.text} = <b>${r.value}</b>`);
    if (Math.abs(r.value - p.target) < Math.abs(best - p.target)) best = r.value;
  }
  return { slots, lines, best };
}

const cur = () => game.current;
const curState = () => game.puzzles[cur()];

function startClock() {
  if (!game.started) {
    game.started = true;
    lastTick = Date.now();
  }
}

// ---------------------------------------------------------------------------
// Rendering

function renderMeta() {
  $('#round-label').textContent =
    mode === 'practice' ? 'Träningsrunda' : `Dagens tal #${number} · ${formatDay(dayId)}`;
  document.title = mode === 'practice' ? 'Dagens tal · träning' : `Dagens tal #${number}`;
  const banner = $('#mode-banner');
  if (mode === 'practice') {
    banner.hidden = false;
    banner.innerHTML = `<span>Träning. Räknas inte i statistiken.</span><span><a href="#traning-${randomId()}">Ny träningsrunda</a> · <a href="#idag">Dagens tal</a></span>`;
  } else if (mode === 'archive') {
    banner.hidden = false;
    banner.innerHTML = `<span>Du spelar ${esc(formatDay(dayId))}. Räknas inte i statistiken.</span><a href="#idag">Till dagens tal</a>`;
  }
}

function renderProgress() {
  const nav = $('#progress');
  nav.innerHTML = round
    .map((p, i) => {
      const st = game.puzzles[i];
      const cls = ['prog', `lv-${i + 1}`, i === cur() ? 'current' : '', st.done ? 'done' : ''].join(' ');
      const label = st.done ? `Tal ${i + 1}: ${st.stars} av 3 stjärnor` : `Tal ${i + 1}`;
      return `<button class="${cls}" data-i="${i}" aria-label="${label}" ${i === cur() ? 'aria-current="step"' : ''}>
        <span class="n">${i + 1}</span><span class="st">${st.done ? stars(st.stars) : '☆☆☆'}</span></button>`;
    })
    .join('');
}

$('#progress').addEventListener('click', (ev) => {
  const b = ev.target.closest('.prog');
  if (!b) return;
  game.current = +b.dataset.i;
  sel = null;
  lastEq = null;
  op = null;
  save();
  render();
});

function renderPuzzle() {
  const i = cur();
  const p = round[i];
  const st = curState();
  const { slots, lines, best } = board(i);

  const sheet = document.querySelector('.sheet');
  sheet.className = `sheet lv-${i + 1}`;
  $('#puzzle-title').textContent = `Tal ${i + 1} av ${PUZZLES}`;
  $('#puzzle-bands').innerHTML = `Exakt ${stars(3)} · ±${p.near} ${stars(2)} · ±${p.ok} ${stars(1)}`;
  const target = $('#target');
  target.textContent = p.target;
  target.classList.toggle('hit', st.done && st.value === p.target);

  const dist = Math.abs(best - p.target);
  $('#closest').innerHTML = st.done
    ? ''
    : dist === 0
      ? ''
      : `Närmast hittills: <b>${best}</b> (${dist} ifrån)`;

  // tiles
  const tiles = $('#tiles');
  tiles.innerHTML = '';
  slots.forEach((s, k) => {
    const b = document.createElement('button');
    b.className = 'tile';
    b.dataset.k = k;
    if (!s) {
      b.classList.add('empty');
      b.disabled = true;
      b.setAttribute('aria-label', 'Använd');
    } else {
      b.textContent = s.v;
      if (s.made) b.classList.add('made');
      if (String(s.v).length >= 4) b.classList.add('long');
      if (k === sel) b.classList.add('sel');
      if (st.done && s.v === p.target) b.classList.add('target-hit');
      b.setAttribute('aria-label', `${s.v}${k === sel ? ', valt' : ''}`);
      b.disabled = st.done;
    }
    tiles.appendChild(b);
  });

  for (const b of document.querySelectorAll('.op')) {
    b.classList.toggle('on', b.dataset.op === op);
    b.disabled = st.done;
  }
  renderCalc(slots, st.done);
  $('#ops').hidden = st.done;
  $('#controls').hidden = st.done;
  $('#btn-undo').disabled = !st.steps.length;
  $('#btn-reset').disabled = !st.steps.length;
  $('#btn-hint').disabled = st.hint;

  const hintBox = $('#hint-box');
  hintBox.hidden = !st.hint || st.done;
  hintBox.innerHTML = `💡 Ett sätt att börja: <b>${esc(p.solution[0])}</b>`;

  const submit = $('#btn-submit');
  submit.hidden = st.done;
  const preview = puzzleStars(p, best, st.hint);
  submit.innerHTML = `Lämna in ${best} <span aria-hidden="true">·</span> ${starString(preview)}`;
  submit.setAttribute('aria-label', `Lämna in ${best}, ger ${preview} av 3 stjärnor`);

  $('#steps').innerHTML = lines.map((l) => `<li>${l}</li>`).join('');

  renderDone();
}

// The calc row spells out what you're building: [8] [+] [?] = ?
function renderCalc(slots, done) {
  const calc = $('#calc');
  calc.hidden = done;
  const tiles = $('#tiles'), ops = $('#ops');
  tiles.classList.toggle('await', !done && (sel === null || op !== null));
  ops.classList.toggle('await', !done && sel !== null && op === null);
  if (done) return;
  const box = (v, cls = '') => `<span class="cbox ${cls}">${v}</span>`;
  const sym = (v) => `<span class="csym">${v}</span>`;
  let step, row;
  if (lastEq && sel === null) {
    step = `<b>Bra!</b> Det nya talet ${lastEq.value} ligger bland dina tal. Tryck på ett tal för att räkna vidare.`;
    row = box(lastEq.a, 'filled') + box(lastEq.op, `filled op ${OP_CLASS[lastEq.op]}`) + box(lastEq.b, 'filled') + sym('=') + box(lastEq.value, 'result');
  } else if (sel === null) {
    step = '<b>Steg 1 av 3:</b> Tryck på ett tal.';
    row = box('?', 'next') + box('', 'op') + box('') + sym('=') + box('');
  } else if (op === null) {
    step = '<b>Steg 2 av 3:</b> Välj <b>+</b> plus, <b>−</b> minus, <b>×</b> gånger eller <b>÷</b> delat.';
    row = box(slots[sel].v, 'filled') + box('?', 'next op') + box('') + sym('=') + box('');
  } else {
    step = '<b>Steg 3 av 3:</b> Tryck på talet du vill räkna med.';
    row = box(slots[sel].v, 'filled') + box(op, `filled op ${OP_CLASS[op]}`) + box('?', 'next') + sym('=') + box('?');
  }
  $('#calc-step').innerHTML = step;
  $('#calc-row').innerHTML = row;
}

function renderDone() {
  const i = cur();
  const p = round[i];
  const st = curState();
  const box = $('#done-box');
  box.hidden = !st.done;
  if (!st.done) return;
  const res = resultFor(st.stars);
  const dist = Math.abs(st.value - p.target);
  const nextOpen = game.puzzles.findIndex((x, j) => !x.done && j !== i);
  box.innerHTML = `
    <div class="done-stars" aria-label="${st.stars} av 3 stjärnor">${stars(st.stars)}</div>
    <div class="done-title">${esc(res.name)}</div>
    <p class="done-sub">${dist === 0 ? `Du nådde ${p.target} exakt` : `Du lämnade in ${st.value}, ${dist} ifrån`}${st.hint ? ' (med ledtråd)' : ''}.</p>
    <details class="solution"><summary>Visa en lösning</summary><ol>${p.solution.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></details>
    ${
      nextOpen >= 0
        ? `<button class="btn primary wide" id="btn-next">Nästa tal →</button>`
        : `<button class="btn primary wide" id="btn-summary">Se dagens resultat</button>`
    }`;
  $('#btn-next')?.addEventListener('click', () => {
    game.current = nextOpen;
    sel = null;
    lastEq = null;
    op = null;
    save();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('#btn-summary')?.addEventListener('click', openResult);
}

function render() {
  renderProgress();
  renderPuzzle();
  renderTimer();
}

// ---------------------------------------------------------------------------
// Playing

$('#tiles').addEventListener('click', (ev) => {
  const b = ev.target.closest('.tile');
  if (!b || b.disabled || curState().done) return;
  startClock();
  lastEq = null;
  const k = +b.dataset.k;
  if (sel === null || op === null) {
    sel = sel === k ? null : k;
    op = null;
    renderPuzzle();
    return;
  }
  if (sel === k) {
    sel = null;
    op = null;
    renderPuzzle();
    return;
  }
  combine(sel, k, op, b);
});

function combine(a, b, operator, node) {
  const { slots } = board(cur());
  const r = applyOp(slots[a].v, slots[b].v, operator);
  if (r.error) {
    toast(r.error);
    shake(node);
    return;
  }
  curState().steps.push({ a, b, op: operator });
  const [x, y] = operator === '−' || operator === '÷' ? [Math.max(slots[a].v, slots[b].v), Math.min(slots[a].v, slots[b].v)] : [slots[a].v, slots[b].v];
  lastEq = { a: x, op: operator, b: y, value: r.value };
  sel = null;
  op = null;
  save();
  renderPuzzle();
  document.querySelector(`.tile[data-k="${b}"]`)?.classList.add('pop');
  if (r.value === round[cur()].target) setTimeout(() => finishPuzzle(r.value), 350);
}

$('#ops').addEventListener('click', (ev) => {
  const b = ev.target.closest('.op');
  if (!b) return;
  lastEq = null;
  if (sel === null) {
    toast('Tryck först på ett tal, sedan på räknesättet');
    shake($('#tiles'));
    return;
  }
  op = op === b.dataset.op ? null : b.dataset.op;
  renderPuzzle();
});

function undo() {
  const st = curState();
  if (st.done || !st.steps.length) return;
  st.steps.pop();
  sel = null;
  lastEq = null;
  op = null;
  save();
  renderPuzzle();
}
$('#btn-undo').addEventListener('click', undo);
$('#btn-reset').addEventListener('click', () => {
  const st = curState();
  if (st.done) return;
  st.steps = [];
  sel = null;
  lastEq = null;
  op = null;
  save();
  renderPuzzle();
});

$('#btn-hint').addEventListener('click', async () => {
  const st = curState();
  if (st.done || st.hint) return;
  const ok = await confirmBox('Visa en ledtråd?', 'Du får se första steget i en lösning. Det kostar en stjärna på det här talet.', 'Visa ledtråd', true);
  if (!ok) return;
  startClock();
  st.hint = true;
  save();
  renderPuzzle();
});

$('#btn-submit').addEventListener('click', async () => {
  const st = curState();
  if (st.done) return;
  const p = round[cur()];
  const { best } = board(cur());
  const dist = Math.abs(best - p.target);
  const n = puzzleStars(p, best, st.hint);
  const ok = await confirmBox(
    `Lämna in ${best}?`,
    `Det är ${dist} ifrån ${p.target} och ger ${n} av 3 stjärnor. Du kan inte ändra efteråt.`,
    'Lämna in',
  );
  if (!ok) return;
  startClock();
  finishPuzzle(best);
});

function finishPuzzle(value) {
  const i = cur();
  const st = game.puzzles[i];
  if (st.done) return;
  st.done = true;
  st.value = value;
  st.stars = puzzleStars(round[i], value, st.hint);
  sel = null;
  lastEq = null;
  op = null;
  if (game.puzzles.every((x) => x.done)) finishRound();
  save();
  render();
  if (st.stars === 3) burst(80);
}

function finishRound() {
  game.finished = true;
  const starsList = game.puzzles.map((x) => x.stars);
  if (mode === 'daily' && todayId() === dayId) {
    const results = store.get('results', {});
    results[dayId] = { stars: starsList };
    store.set('results', results);
  }
  save();
  const total = starsList.reduce((s, x) => s + x, 0);
  setTimeout(() => {
    if (total >= 12) burst(160);
    openResult();
  }, 900);
}

document.addEventListener('keydown', (ev) => {
  if (ev.target.closest('input, select, textarea') || document.querySelector('dialog[open]')) return;
  const map = { '+': '+', '-': '−', '*': '×', x: '×', '/': '÷' };
  if (map[ev.key] && sel !== null && !curState().done) {
    op = map[ev.key];
    renderPuzzle();
  } else if (ev.key === 'Backspace' || ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z')) {
    ev.preventDefault();
    undo();
  } else if (ev.key === 'Escape') {
    sel = null;
    lastEq = null;
    op = null;
    renderPuzzle();
  }
});

// ---------------------------------------------------------------------------
// Timer

let lastTick = Date.now();
function renderTimer() {
  const t = $('#timer');
  t.hidden = !settings.timer;
  t.textContent = `⏱ ${formatDuration(game.elapsed)}`;
}
setInterval(() => {
  const now = Date.now();
  if (!game.finished && game.started && document.visibilityState === 'visible') {
    game.elapsed += Math.min(now - lastTick, 2000);
    renderTimer();
    if (Math.random() < 0.2) save();
  }
  lastTick = now;
}, 1000);
document.addEventListener('visibilitychange', () => {
  lastTick = Date.now();
  if (document.visibilityState === 'hidden') save();
});
window.addEventListener('pagehide', save);

// ---------------------------------------------------------------------------
// Confirm dialog

function confirmBox(title, text, yes = 'OK', always = false) {
  if (!settings.confirm && !always) return Promise.resolve(true);
  return new Promise((resolve) => {
    const dlg = $('#dlg-confirm');
    $('#confirm-title').textContent = title;
    $('#confirm-text').textContent = text;
    $('#confirm-yes').textContent = yes;
    const onClick = (ev) => {
      const btn = ev.target.closest('[data-answer]');
      if (btn) dlg.close(btn.dataset.answer);
    };
    dlg.addEventListener('click', onClick);
    dlg.addEventListener(
      'close',
      () => {
        dlg.removeEventListener('click', onClick);
        resolve(dlg.returnValue === 'yes');
      },
      { once: true },
    );
    dlg.returnValue = '';
    dlg.showModal();
  });
}

// ---------------------------------------------------------------------------
// Result

function verdict(total) {
  if (total === MAX_STARS) return 'Perfekt runda!';
  if (total >= 12) return 'Riktigt starkt!';
  if (total >= 8) return 'Bra jobbat!';
  return 'Bra kämpat!';
}

let countdownTimer;
function openResult() {
  if (!game.finished) return;
  const list = game.puzzles.map((x) => x.stars);
  const total = list.reduce((s, x) => s + x, 0);
  const rows = round
    .map((p, i) => {
      const st = game.puzzles[i];
      return `<div><span>${i + 1}. Mål ${p.target} · du: ${st.value}${st.hint ? ' 💡' : ''}</span><span class="st">${starString(st.stars)}</span></div>`;
    })
    .join('');
  $('#result-body').innerHTML = `
    <div class="result-total">${total}<small> / ${MAX_STARS} ★</small></div>
    <div class="result-title">${verdict(total)}</div>
    <div class="muted">⏱ ${formatDuration(game.elapsed)}</div>
    <div class="result-squares" aria-hidden="true">${list.map((s) => resultFor(s).square).join('')}</div>
    <div class="actions">
      <button class="btn primary" id="btn-share"><svg viewBox="0 0 24 24"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4M12 2v13"/></svg>Dela resultat</button>
      <button class="btn" data-open="dlg-stats">Statistik</button>
    </div>
    <div class="result-rows">${rows}</div>
    ${
      mode === 'daily'
        ? '<div class="countdown">Nya tal om<b id="countdown"></b></div>'
        : `<div class="countdown"><a class="btn" href="${mode === 'practice' ? `#traning-${randomId()}` : '#idag'}">${mode === 'practice' ? 'Ny träningsrunda' : 'Till dagens tal'}</a></div>`
    }`;
  $('#btn-share').addEventListener('click', share);
  clearInterval(countdownTimer);
  const tick = () => {
    const c = $('#countdown');
    if (!c) return;
    const ms = msUntilMidnight();
    c.textContent = formatDuration(ms);
    if (ms < 1000) c.innerHTML = '<a href="#idag">Nya tal finns!</a>';
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
  openDialog('dlg-result');
}

async function share() {
  // Leave the link out inside sandboxed embeds whose address isn't shareable.
  const url = /claude/i.test(location.hostname) ? '' : location.origin + location.pathname;
  const text = shareText({
    number,
    label: formatDay(dayId, { day: 'numeric', month: 'short' }),
    stars: game.puzzles.map((x) => x.stars),
    elapsed: game.elapsed,
    streak: mode === 'daily' ? computeStats(store.get('results', {}), todayId()).current : 0,
    url: mode === 'practice' ? '' : url,
  });
  if (matchMedia('(pointer: coarse)').matches && navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch {
      /* fall back to the clipboard */
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Resultatet är kopierat');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast('Resultatet är kopierat');
  }
}

// ---------------------------------------------------------------------------
// Stats

function renderStats() {
  const results = store.get('results', {});
  const s = computeStats(results, todayId());
  const max = Math.max(1, ...Object.values(s.dist));
  let html = `<div class="stat-row">
      <div><b>${s.played}</b><span>Spelade</span></div>
      <div><b>${s.avg === null ? '–' : s.avg.toFixed(1)}</b><span>Snitt ★</span></div>
      <div><b>${s.current}</b><span>Dagar i rad</span></div>
      <div><b>${s.best}</b><span>Bästa svit</span></div>
    </div>
    <h3>Alla tal</h3><div class="dist">`;
  for (const r of RESULTS) {
    const v = s.dist[r.stars];
    html += `<div class="dist-row"><span><span class="stars">${starString(r.stars)}</span></span><div class="dist-bar s${r.stars}" style="width:${Math.max(8, (v / max) * 100)}%">${v}</div></div>`;
  }
  html += '</div>';
  if (s.played) {
    html += `<p class="muted small">Bästa runda: ${s.bestRound} av ${MAX_STARS} stjärnor${s.perfect ? ` · ${s.perfect} perfekt${s.perfect === 1 ? '' : 'a'} runda${s.perfect === 1 ? '' : 'r'}` : ''}</p>`;
  } else {
    html += '<p class="muted small">Spela klart dagens fem tal så dyker din statistik upp här.</p>';
  }
  $('#stats-body').innerHTML = html;
}

// ---------------------------------------------------------------------------
// Archive

function renderArchive() {
  $('#practice-link').href = `#traning-${randomId()}`;
  let html = '';
  for (let d = todayId(), i = 0; d >= EPOCH && i < 120; d = addDays(d, -1), i++) {
    const g = store.get(`game:${d}`, null);
    let st = '<span class="st none">Inte spelad</span>';
    if (g?.finished) {
      const t = g.puzzles.reduce((s, x) => s + x.stars, 0);
      st = `<span class="st">${t} / ${MAX_STARS} ★</span>`;
    } else if (g?.started) st = '<span class="st none">Påbörjad</span>';
    const href = d === todayId() ? '#idag' : `#dag-${d}`;
    html += `<li><a href="${href}"><span class="no">#${puzzleNumber(d)}</span><span>${esc(formatDay(d))}</span>${st}</a></li>`;
  }
  $('#archive-list').innerHTML = html;
}

// ---------------------------------------------------------------------------
// Settings

function applyTheme() {
  if (settings.theme === 'light' || settings.theme === 'dark') document.documentElement.dataset.theme = settings.theme;
  else delete document.documentElement.dataset.theme;
  for (const b of document.querySelectorAll('#set-theme button')) b.classList.toggle('on', b.dataset.v === settings.theme);
}

$('#set-theme').addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;
  settings.theme = b.dataset.v;
  saveSettings();
  applyTheme();
});
for (const [id, prop, after] of [['#set-confirm', 'confirm'], ['#set-timer', 'timer', renderTimer]]) {
  const input = $(id);
  input.checked = !!settings[prop];
  input.addEventListener('change', () => {
    settings[prop] = input.checked;
    saveSettings();
    after?.();
  });
}

// ---------------------------------------------------------------------------
// Dialogs

function openDialog(id) {
  if (id === 'dlg-stats') renderStats();
  if (id === 'dlg-archive') renderArchive();
  const dlg = document.getElementById(id);
  for (const d of document.querySelectorAll('dialog[open]')) if (d !== dlg) d.close();
  if (!dlg.open) dlg.showModal();
}

document.addEventListener('click', (ev) => {
  const opener = ev.target.closest('[data-open]');
  if (opener) {
    ev.preventDefault();
    openDialog(opener.dataset.open);
    return;
  }
  const closer = ev.target.closest('[data-close]');
  if (closer) closer.closest('dialog')?.close();
});
for (const dlg of document.querySelectorAll('dialog')) {
  dlg.addEventListener('click', (ev) => {
    if (ev.target !== dlg || dlg.id === 'dlg-confirm') return;
    const r = dlg.getBoundingClientRect();
    if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) dlg.close();
  });
}
$('#dlg-help').addEventListener('close', () => store.set('seenHelp', true));

// ---------------------------------------------------------------------------
// Confetti

function burst(count) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = $('#confetti');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const css = getComputedStyle(document.documentElement);
  const colors = ['--accent', '--sun', '--good', '--ok'].map((v) => css.getPropertyValue(v).trim());
  const parts = Array.from({ length: count }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120,
    y: innerHeight * 0.4,
    vx: (Math.random() - 0.5) * 13,
    vy: -Math.random() * 13 - 4,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    w: 6 + Math.random() * 6,
    h: 4 + Math.random() * 4,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  const frame = (t) => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.35;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (t - start < 2400) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  };
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// Boot

renderMeta();
applyTheme();
render();
if (!store.get('seenHelp', false)) openDialog('dlg-help');
else if (game.finished && mode === 'daily') setTimeout(openResult, 300);
