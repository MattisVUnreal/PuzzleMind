import { generatePuzzle } from './engine.js';
import { PROFILES, profileForWeekday } from './profiles.js';
import {
  EPOCH, todayId, isDayId, puzzleNumber, weekday, formatDay, msUntilMidnight, formatDuration, addDays,
} from './date.js';
import {
  MAX_STROKES, LOST_STROKES, PAR, TERMS, evaluateGuess, newGame, strokesUsed, finalStrokes, termFor, relToPar,
  shareText, computeStats, squaresFor,
} from './game.js';

// ---------------------------------------------------------------------------
// Utilities

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(`pm:${key}`);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`pm:${key}`, JSON.stringify(value));
    } catch {
      /* storage unavailable: play continues without persistence */
    }
  },
};

const settings = Object.assign({ theme: 'system', autoX: true, confirm: true, timer: true }, store.get('settings', {}));
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
  node.classList.remove('shake');
  void node.offsetWidth;
  node.classList.add('shake');
}

// ---------------------------------------------------------------------------
// Route: today's daily, an archived daily (?day=YYYY-MM-DD) or practice.

const today = todayId();
const params = new URLSearchParams(location.search);
let mode = 'daily';
let dayId = today;
let seed = today;
let profile = profileForWeekday(weekday(today));

if (params.has('practice')) {
  mode = 'practice';
  const lvl = Number.parseInt(params.get('level'), 10);
  profile = PROFILES[Number.isInteger(lvl) && lvl >= 0 && lvl < 7 ? lvl : weekday(today)];
  seed = `practice:${params.get('practice')}`;
} else if (isDayId(params.get('day')) && params.get('day') < today && params.get('day') >= EPOCH) {
  mode = 'archive';
  dayId = params.get('day');
  seed = dayId;
  profile = profileForWeekday(weekday(dayId));
}

const puzzle = generatePuzzle(seed, profile);
const gameKey = mode === 'practice' ? `game:${seed}:${profile.day}` : `game:${dayId}`;
const game = Object.assign(newGame(gameKey), store.get(gameKey, {}));
const { k, n, cats, solution } = puzzle;
const number = mode === 'practice' ? null : puzzleNumber(dayId);

// inverse solution: inv[c][x] = person
const inv = cats.map((_, c) => {
  const row = [];
  solution.forEach((r, e) => (row[r[c]] = e));
  return row;
});

const save = () => store.set(gameKey, game);
const playing = () => game.status === 'playing';

// ---------------------------------------------------------------------------
// Marks model

const key = (c1, x1, c2, x2) => (c1 < c2 ? `${c1}.${x1}.${c2}.${x2}` : `${c2}.${x2}.${c1}.${x1}`);
const parseKey = (kk) => kk.split('.').map(Number);
const markOf = (kk) => game.marks[kk] || 0;
const isLocked = (kk) => game.locked.includes(kk);
const isTrueLink = (c1, x1, c2, x2) => inv[c1][x1] === inv[c2][x2];

function setMark(kk, v) {
  if (isLocked(kk)) return false;
  if (v) game.marks[kk] = v;
  else delete game.marks[kk];
  return true;
}

// Is there a ● elsewhere in this cell's row or column (within its subgrid)?
function lineTick(c1, x1, c2, x2) {
  for (let y = 0; y < n; y++) if (y !== x2 && markOf(key(c1, x1, c2, y)) === 2) return true;
  for (let z = 0; z < n; z++) if (z !== x1 && markOf(key(c1, z, c2, x2)) === 2) return true;
  return false;
}

const undoStack = [];
function snapshot() {
  undoStack.push(JSON.stringify(game.marks));
  if (undoStack.length > 300) undoStack.shift();
}
function undo() {
  if (!playing() || !undoStack.length) return;
  game.marks = JSON.parse(undoStack.pop());
  for (const kk of game.locked) game.marks[kk] = 2;
  changed();
}

function startClock() {
  if (!game.started) {
    game.started = true;
    lastTick = Date.now();
  }
}

// What the scorecard currently says for person e in category c.
function pickFor(e, c) {
  const ticks = [];
  for (let x = 0; x < n; x++) if (markOf(key(0, e, c, x)) === 2) ticks.push(x);
  if (ticks.length === 1) return { x: ticks[0], implied: false };
  if (ticks.length > 1) return { x: null, conflict: true };
  const open = [];
  for (let x = 0; x < n; x++) {
    const kk = key(0, e, c, x);
    if (markOf(kk) === 0 && !lineTick(0, e, c, x)) open.push(x);
  }
  return open.length === 1 ? { x: open[0], implied: true } : { x: null };
}

function currentGuess() {
  const guess = [];
  let complete = true;
  for (let e = 0; e < n; e++) {
    guess[e] = [e];
    for (let c = 1; c < k; c++) {
      const p = pickFor(e, c);
      guess[e][c] = p.x;
      if (p.x === null) complete = false;
    }
  }
  const dupCats = new Set();
  for (let c = 1; c < k; c++) {
    const seen = new Set();
    for (let e = 0; e < n; e++) {
      const x = guess[e][c];
      if (x === null) continue;
      if (seen.has(x)) dupCats.add(c);
      seen.add(x);
    }
  }
  return { guess, complete, dupCats };
}

// ---------------------------------------------------------------------------
// Header

function renderHeader() {
  const diffIdx = [1, 2, 3, 4, 5, 6, 0].indexOf(PROFILES.indexOf(profile)) + 1;
  const pips = '●'.repeat(diffIdx) + '○'.repeat(7 - diffIdx);
  $('#day-pill').innerHTML = `${esc(profile.day)} · ${esc(profile.name)} <span class="pips" aria-hidden="true">${pips}</span>`;
  $('#day-label').textContent =
    mode === 'practice' ? 'Practice range' : `Hole #${number} · ${formatDay(dayId)}`;
  $('#theme-title').innerHTML = `<span class="ic" aria-hidden="true">${puzzle.theme.icon}</span>${esc(puzzle.theme.title)}`;
  $('#theme-intro').textContent = puzzle.theme.intro;
  document.title = `PuzzleMind ${number ? `#${number}` : 'practice'} · ${puzzle.theme.title}`;

  const banner = $('#mode-banner');
  if (mode !== 'daily') {
    banner.hidden = false;
    banner.innerHTML =
      mode === 'practice'
        ? `<span>🏌️ Practice puzzle. It doesn't count toward your stats.</span><span><a href="${practiceHref(PROFILES.indexOf(profile))}">New practice puzzle</a> · <a href="./">Today's hole</a></span>`
        : `<span>📅 Archive: ${esc(formatDay(dayId))}. Replays don't affect streaks.</span><a href="./">Back to today's hole</a>`;
  }
}

function practiceHref(level) {
  return `?practice=${Math.random().toString(36).slice(2, 8)}&level=${level}`;
}

// ---------------------------------------------------------------------------
// Clues

const itemHtml = (text) =>
  esc(text).replace(/\{\{(\d+):([^}]*)\}\}/g, (_, c, label) => `<span class="ci c-${c}">${label}</span>`);

function renderClues() {
  const list = $('#clues');
  list.innerHTML = '';
  puzzle.clues.forEach((cl, i) => {
    const li = document.createElement('li');
    li.className = 'clue';
    li.tabIndex = 0;
    li.dataset.id = cl.id;
    li.innerHTML = `<span class="num">${i + 1}</span><span class="txt">${itemHtml(cl.text)}</span>`;
    const toggle = () => {
      const s = new Set(game.struck);
      s.has(cl.id) ? s.delete(cl.id) : s.add(cl.id);
      game.struck = [...s];
      li.classList.toggle('done', s.has(cl.id));
      save();
    };
    li.addEventListener('click', toggle);
    li.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        toggle();
      }
    });
    li.classList.toggle('done', game.struck.includes(cl.id));
    list.appendChild(li);
  });
}

// ---------------------------------------------------------------------------
// Logic grid (classic staircase layout)

const colCats = [...Array(k - 1).keys()].map((i) => i + 1); // 1..k-1
const rowCats = [0, ...[...Array(k - 2).keys()].map((i) => k - 1 - i)]; // 0, k-1 .. 2
const cellEls = new Map(); // key -> td
const cellPos = new Map(); // "row,col" -> td
const rowHeads = new Map(); // "c.x" -> th
const colHeads = new Map();

function buildGrid() {
  const table = $('#grid');
  table.innerHTML = '';
  const thead = document.createElement('thead');
  const tr1 = document.createElement('tr');
  tr1.innerHTML = `<th class="corner" colspan="2" rowspan="2"></th>`;
  for (const c of colCats) {
    tr1.insertAdjacentHTML('beforeend', `<th class="cat-col c-${c}" colspan="${n}">${esc(cats[c].name)}</th>`);
  }
  const tr2 = document.createElement('tr');
  for (const c of colCats) {
    cats[c].items.forEach((it, x) => {
      const th = document.createElement('th');
      th.className = 'item-col';
      th.title = it.label;
      th.innerHTML = `<span>${esc(it.short)}</span>`;
      colHeads.set(`${c}.${x}`, th);
      tr2.appendChild(th);
    });
  }
  thead.append(tr1, tr2);

  const tbody = document.createElement('tbody');
  let rowIdx = 0;
  rowCats.forEach((r) => {
    cats[r].items.forEach((it, x) => {
      const tr = document.createElement('tr');
      if (x === 0) {
        tr.insertAdjacentHTML('beforeend', `<th class="cat-row c-${r}" rowspan="${n}"><span>${esc(cats[r].name)}</span></th>`);
      }
      const th = document.createElement('th');
      th.className = 'item-row';
      th.title = it.label;
      th.textContent = it.short;
      rowHeads.set(`${r}.${x}`, th);
      tr.appendChild(th);

      let colIdx = 0;
      for (const c of colCats) {
        if (r !== 0 && c >= r) {
          const td = document.createElement('td');
          td.className = 'void';
          td.colSpan = n;
          tr.appendChild(td);
          colIdx += n;
          continue;
        }
        for (let y = 0; y < n; y++) {
          const td = document.createElement('td');
          const kk = key(r, x, c, y);
          td.className = 'cell';
          if (y === 0) td.classList.add('bl');
          if (x === 0) td.classList.add('bt');
          if (y === n - 1) td.classList.add('br');
          if (x === n - 1) td.classList.add('bb');
          td.dataset.key = kk;
          td.dataset.r = r;
          td.dataset.x = x;
          td.dataset.c = c;
          td.dataset.y = y;
          td.dataset.row = rowIdx;
          td.dataset.col = colIdx;
          td.tabIndex = -1;
          td.setAttribute('role', 'button');
          td.setAttribute('aria-label', `${it.label} and ${cats[c].items[y].label}`);
          cellEls.set(kk, td);
          cellPos.set(`${rowIdx},${colIdx}`, td);
          tr.appendChild(td);
          colIdx++;
        }
      }
      tbody.appendChild(tr);
      rowIdx++;
    });
  });
  table.append(thead, tbody);
  const first = cellPos.get('0,0');
  if (first) first.tabIndex = 0;
  bindGridEvents(table);
}

function refreshGrid() {
  const done = !playing();
  $('#grid').classList.toggle('readonly', done);
  for (const [kk, td] of cellEls) {
    const [c1, x1, c2, x2] = parseKey(kk);
    const m = markOf(kk);
    const locked = isLocked(kk);
    const inLine = lineTick(c1, x1, c2, x2);
    td.classList.toggle('is-tick', m === 2);
    td.classList.toggle('is-lock', locked);
    td.classList.toggle('is-conflict', m === 2 && !locked && inLine);
    td.classList.toggle('is-cross', m === 1);
    td.classList.toggle('is-auto', m === 0 && settings.autoX && inLine);
    td.classList.toggle('is-sol', done && isTrueLink(c1, x1, c2, x2));
    const state = m === 2 ? 'confirmed' : m === 1 ? 'ruled out' : 'empty';
    td.setAttribute('aria-pressed', m === 2 ? 'true' : 'false');
    td.title = `${cats[c1].items[x1].label} × ${cats[c2].items[x2].label}: ${state}`;
  }
}

function cycle(v) {
  return (v + 1) % 3; // blank -> ✕ -> ● -> blank
}

function applyToCell(td, value, { pop = true } = {}) {
  const kk = td.dataset.key;
  if (isLocked(kk)) {
    shake(td);
    return false;
  }
  if (markOf(kk) === value) return false;
  setMark(kk, value);
  if (pop) {
    td.classList.remove('pop');
    void td.offsetWidth;
    td.classList.add('pop');
  }
  return true;
}

function bindGridEvents(table) {
  let paint = null; // { value } while dragging with a mouse
  let press = null; // long-press state for touch/pen

  table.addEventListener('contextmenu', (ev) => {
    if (ev.target.closest('.cell')) ev.preventDefault();
  });

  table.addEventListener('pointerdown', (ev) => {
    const td = ev.target.closest('.cell');
    if (!td || !playing()) return;
    startClock();
    focusCell(td, false);
    if (ev.pointerType === 'mouse') {
      if (ev.button === 2 || ev.shiftKey) {
        snapshot();
        applyToCell(td, markOf(td.dataset.key) === 2 ? 0 : 2);
        changed();
        return;
      }
      if (ev.button !== 0) return;
      snapshot();
      const value = cycle(markOf(td.dataset.key));
      applyToCell(td, value);
      paint = { value: value === 2 ? null : value };
      changed();
      ev.preventDefault();
    } else {
      // Touch: tap cycles on pointerup, long press sets ●.
      press = {
        td,
        x: ev.clientX,
        y: ev.clientY,
        fired: false,
        timer: setTimeout(() => {
          press.fired = true;
          snapshot();
          applyToCell(td, markOf(td.dataset.key) === 2 ? 0 : 2);
          if (navigator.vibrate) navigator.vibrate(12);
          changed();
        }, 420),
      };
    }
  });

  table.addEventListener('pointermove', (ev) => {
    if (press && Math.hypot(ev.clientX - press.x, ev.clientY - press.y) > 10) {
      clearTimeout(press.timer);
      press = null; // it's a scroll, not a tap
    }
    if (!paint || paint.value === null) return;
    const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('.cell');
    if (target && table.contains(target) && applyToCell(target, paint.value)) changed();
  });

  const endPress = (ev) => {
    paint = null;
    if (!press) return;
    clearTimeout(press.timer);
    if (!press.fired && ev.type === 'pointerup') {
      snapshot();
      applyToCell(press.td, cycle(markOf(press.td.dataset.key)));
      changed();
    }
    press = null;
  };
  window.addEventListener('pointerup', endPress);
  table.addEventListener('pointercancel', endPress);

  table.addEventListener('pointerover', (ev) => {
    const td = ev.target.closest('.cell');
    highlight(td);
  });
  table.addEventListener('pointerleave', () => highlight(null));

  table.addEventListener('keydown', (ev) => {
    const td = ev.target.closest('.cell');
    if (!td) return;
    const row = +td.dataset.row, col = +td.dataset.col;
    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (moves[ev.key]) {
      ev.preventDefault();
      const [dr, dc] = moves[ev.key];
      let r = row + dr, c = col + dc;
      for (let i = 0; i < 40; i++, r += dr, c += dc) {
        const next = cellPos.get(`${r},${c}`);
        if (next) {
          focusCell(next, true);
          break;
        }
      }
      return;
    }
    if (!playing()) return;
    const actions = { ' ': () => cycle(markOf(td.dataset.key)), Enter: () => cycle(markOf(td.dataset.key)), x: () => 1, X: () => 1, o: () => 2, O: () => 2, Backspace: () => 0, Delete: () => 0 };
    if (actions[ev.key]) {
      ev.preventDefault();
      startClock();
      snapshot();
      applyToCell(td, actions[ev.key]());
      changed();
    }
  });
}

let focused = null;
function focusCell(td, move) {
  if (focused) focused.tabIndex = -1;
  focused = td;
  td.tabIndex = 0;
  if (move) td.focus();
  highlight(td);
}

let lastHl = [];
function highlight(td) {
  lastHl.forEach((h) => h.classList.remove('hl'));
  lastHl = [];
  for (const el of document.querySelectorAll('.cell.xh')) el.classList.remove('xh');
  if (!td) return;
  const { r, x, c, y } = td.dataset;
  const rh = rowHeads.get(`${r}.${x}`), ch = colHeads.get(`${c}.${y}`);
  [rh, ch].forEach((h) => h && (h.classList.add('hl'), lastHl.push(h)));
  // Crosshair within the subgrid.
  for (let i = 0; i < n; i++) {
    cellEls.get(key(+r, +x, +c, i))?.classList.add('xh');
    cellEls.get(key(+r, i, +c, +y))?.classList.add('xh');
  }
}

// ---------------------------------------------------------------------------
// Scorecard (answer table)

function renderAnswer() {
  const table = $('#answer');
  const done = !playing();
  const { guess, dupCats } = currentGuess();
  const last = [...game.log].reverse().find((l) => l.type === 'guess');

  let html = `<thead><tr><th class="c-0">${esc(cats[0].name)}</th>`;
  for (let c = 1; c < k; c++) html += `<th class="c-${c}">${esc(cats[c].name)}</th>`;
  html += '</tr></thead><tbody>';
  for (let e = 0; e < n; e++) {
    html += `<tr><th>${esc(cats[0].items[e].label)}</th>`;
    for (let c = 1; c < k; c++) {
      if (done) {
        const sol = solution[e][c];
        const g = last?.guess?.[e]?.[c];
        const right = g === sol;
        html += `<td class="${right ? 'sol-right' : 'sol-wrong'}">${!right && g != null ? `<s>${esc(cats[c].items[g].short)}</s>` : ''}${esc(cats[c].items[sol].label)}</td>`;
        continue;
      }
      const p = pickFor(e, c);
      const kk = p.x !== null ? key(0, e, c, p.x) : null;
      const cls = [
        p.x === null ? 'empty' : '',
        p.implied ? 'implied' : '',
        dupCats.has(c) && p.x !== null && guess.some((row, e2) => e2 !== e && row[c] === p.x) ? 'dup' : '',
        kk && isLocked(kk) ? 'locked' : '',
      ].join(' ');
      html += `<td><select data-e="${e}" data-c="${c}" class="${cls}" aria-label="${esc(cats[0].items[e].label)}: ${esc(cats[c].name)}">`;
      html += `<option value="">${p.conflict ? '⚠ conflict' : '—'}</option>`;
      cats[c].items.forEach((it, x) => {
        html += `<option value="${x}" ${p.x === x ? 'selected' : ''}>${esc(it.label)}</option>`;
      });
      html += '</select></td>';
    }
    html += '</tr>';
  }
  html += '</tbody>';
  table.innerHTML = html;
  $('#answer-hint').textContent = done ? 'Solution' : 'Fills in from your ● marks';
}

$('#answer').addEventListener('change', (ev) => {
  const sel = ev.target.closest('select');
  if (!sel || !playing()) return;
  startClock();
  const e = +sel.dataset.e, c = +sel.dataset.c;
  const x = sel.value === '' ? null : +sel.value;
  snapshot();
  // Clear existing ● in this person's row (unless revealed by a hint).
  for (let y = 0; y < n; y++) {
    const kk = key(0, e, c, y);
    if (markOf(kk) === 2 && !isLocked(kk)) setMark(kk, 0);
  }
  if (x !== null) {
    const kk = key(0, e, c, x);
    if (!lockedClash(e, c, x)) {
      // Free the column: nobody else can hold this item.
      for (let z = 0; z < n; z++) {
        const other = key(0, z, c, x);
        if (z !== e && markOf(other) === 2 && !isLocked(other)) setMark(other, 0);
      }
      setMark(kk, 2);
    } else {
      toast('That clashes with a revealed link');
    }
  }
  changed();
});

// Would placing ● at (0,e,c,x) clash with a link revealed by a hint?
function lockedClash(e, c, x) {
  return game.locked.some((m) => {
    const [c1, x1, c2, x2] = parseKey(m);
    return c1 === 0 && c2 === c && (x1 === e) !== (x2 === x);
  });
}

// ---------------------------------------------------------------------------
// Strokes, history, actions

function renderStrokes() {
  const used = strokesUsed(game);
  const balls = $('#balls');
  balls.innerHTML = '';
  for (let i = 0; i < MAX_STROKES; i++) {
    const b = document.createElement('span');
    b.className = 'ball';
    const entry = game.log[i];
    if (entry) {
      b.classList.add('used');
      if (entry.type === 'hint') b.classList.add('hint');
      else if (game.status === 'won' && i === used - 1) b.classList.add('win');
      else if (game.status === 'lost' && i === used - 1) b.classList.add('lost');
      b.title = entry.type === 'hint' ? `Stroke ${i + 1}: penalty` : `Stroke ${i + 1}: ${entry.correct}/${n * (k - 1)} links`;
    } else if (i === used && playing()) {
      b.classList.add('current');
      b.title = `Stroke ${i + 1}`;
    }
    b.textContent = i + 1;
    balls.appendChild(b);
    if (i === PAR - 1) {
      balls.insertAdjacentHTML(
        'beforeend',
        `<span class="par-flag" title="Par ${PAR}"><svg viewBox="0 0 14 18"><path d="M3 1v16"/><path class="f" d="M4 1l9 3.5L4 8z"/></svg>PAR</span>`,
      );
    }
  }
  const label = $('#stroke-label');
  if (game.status === 'won') label.textContent = `${termFor(used).name} · ${relToPar(used)}`;
  else if (game.status === 'lost') label.textContent = 'Lost ball';
  else label.textContent = `Stroke ${used + 1} of ${MAX_STROKES} · Par ${PAR}`;
}

function renderHistory() {
  const list = $('#history');
  list.innerHTML = '';
  game.log.forEach((entry, i) => {
    const li = document.createElement('li');
    if (entry.type === 'hint') {
      li.innerHTML = `<span class="stroke-no">Stroke ${i + 1}</span><span>💡 Penalty: <b class="c-0">${esc(cats[0].items[entry.e].label)}</b> ↔ <b class="c-${entry.c}">${esc(cats[entry.c].items[solution[entry.e][entry.c]].label)}</b></span>`;
    } else {
      const chips = entry.perCat
        .map((h, j) => {
          const cls = h === n ? 'full' : h > 0 ? 'part' : 'none';
          return `<span class="chip ${cls}"><i></i>${esc(cats[j + 1].name)} ${h}/${n}</span>`;
        })
        .join('');
      li.innerHTML = `<span class="stroke-no">Stroke ${i + 1}</span>${chips}<span class="total">${entry.correct}/${n * (k - 1)}</span>`;
    }
    list.appendChild(li);
  });
  $('#btn-show-result').hidden = playing();
}

function updateActions() {
  const submit = $('#btn-submit'), hint = $('#btn-hint'), note = $('#submit-note');
  const used = strokesUsed(game);
  if (!playing()) {
    submit.disabled = true;
    hint.disabled = true;
    $('#submit-label').textContent = game.status === 'won' ? 'Holed out!' : 'Out of strokes';
    note.textContent = '';
    return;
  }
  const { complete, dupCats } = currentGuess();
  submit.disabled = !complete || dupCats.size > 0;
  $('#submit-label').textContent = used === MAX_STROKES - 1 ? 'Final shot' : `Take shot ${used + 1}`;
  hint.disabled = used >= MAX_STROKES - 1;
  hint.title = hint.disabled ? 'You need your last stroke for a shot' : 'Costs one stroke: reveals one correct link';
  if (dupCats.size) {
    const names = [...dupCats].map((c) => cats[c].name.toLowerCase()).join(' and ');
    note.textContent = `Two ${puzzle.theme.people} share the same ${names}. Each item belongs to exactly one.`;
  } else if (!complete) {
    note.textContent = 'Complete every row of the scorecard to take a shot.';
  } else {
    note.textContent = used === MAX_STROKES - 1 ? 'Last stroke. Make it count.' : 'Ready when you are.';
  }
}

function changed() {
  refreshGrid();
  renderAnswer();
  updateActions();
  save();
}

function renderAll() {
  renderStrokes();
  refreshGrid();
  renderAnswer();
  renderHistory();
  updateActions();
  renderTimer();
}

// ---------------------------------------------------------------------------
// Confirm dialog

function confirmBox(title, text, yes = 'OK') {
  if (!settings.confirm) return Promise.resolve(true);
  return new Promise((resolve) => {
    const dlg = $('#dlg-confirm');
    $('#confirm-title').textContent = title;
    $('#confirm-text').textContent = text;
    $('#confirm-yes').textContent = yes;
    const onClick = (ev) => {
      const btn = ev.target.closest('[data-answer]');
      if (!btn) return;
      dlg.close(btn.dataset.answer);
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
// Shooting & hints

$('#btn-submit').addEventListener('click', async () => {
  if (!playing()) return;
  const { guess, complete, dupCats } = currentGuess();
  if (!complete || dupCats.size) return;
  const used = strokesUsed(game);
  const ok = await confirmBox(
    used === MAX_STROKES - 1 ? 'Final shot?' : `Take shot ${used + 1}?`,
    `This uses stroke ${used + 1} of ${MAX_STROKES}. You'll see how many links are right in each category.`,
    'Shoot',
  );
  if (!ok) return;
  startClock();
  const res = evaluateGuess(puzzle, guess);
  game.log.push({ type: 'guess', perCat: res.perCat, correct: res.correct, guess });
  if (res.won) finish('won');
  else if (strokesUsed(game) >= MAX_STROKES) finish('lost');
  else {
    const left = MAX_STROKES - strokesUsed(game);
    toast(`${res.correct} of ${res.total} links correct · ${left} stroke${left === 1 ? '' : 's'} left`, 3200);
    shake($('.answer-panel'));
  }
  save();
  renderAll();
});

$('#btn-hint').addEventListener('click', async () => {
  if (!playing() || strokesUsed(game) >= MAX_STROKES - 1) return;
  const ok = await confirmBox('Take a penalty stroke?', 'One correct link will be revealed on your grid. It costs a stroke.', 'Reveal');
  if (!ok) return;
  startClock();
  const { guess } = currentGuess();
  const candidates = [];
  for (let e = 0; e < n; e++) {
    for (let c = 1; c < k; c++) {
      const kk = key(0, e, c, solution[e][c]);
      if (isLocked(kk)) continue;
      candidates.push({ e, c, wrong: guess[e][c] !== solution[e][c] });
    }
  }
  const pool = candidates.some((x) => x.wrong) ? candidates.filter((x) => x.wrong) : candidates;
  if (!pool.length) return;
  const { e, c } = pool[Math.floor(Math.random() * pool.length)];
  const sx = solution[e][c];
  // Clear anything contradicting the revealed link, then lock it in.
  for (let y = 0; y < n; y++) if (y !== sx && markOf(key(0, e, c, y)) === 2) setMark(key(0, e, c, y), 0);
  for (let z = 0; z < n; z++) if (z !== e && markOf(key(0, z, c, sx)) === 2) setMark(key(0, z, c, sx), 0);
  const kk = key(0, e, c, sx);
  game.marks[kk] = 2;
  game.locked.push(kk);
  game.log.push({ type: 'hint', e, c });
  undoStack.length = 0;
  toast(`Revealed: ${cats[0].items[e].label} ↔ ${cats[c].items[sx].label}`, 3200);
  save();
  renderAll();
  const td = cellEls.get(kk);
  td?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
});

function finish(status) {
  game.status = status;
  game.finishedAt = Date.now();
  if (mode === 'daily' && todayId() === dayId) {
    const results = store.get('results', {});
    results[dayId] = { won: status === 'won', strokes: finalStrokes(game) };
    store.set('results', results);
  }
  save();
  if (status === 'won') setTimeout(confetti, 150);
  setTimeout(() => openResult(), status === 'won' ? 700 : 400);
}

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
  if (playing() && game.started && document.visibilityState === 'visible') {
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
// Result dialog

function currentStreak() {
  return computeStats(store.get('results', {}), todayId()).current;
}

let countdownTimer;
function openResult() {
  const won = game.status === 'won';
  const strokes = finalStrokes(game);
  const term = termFor(strokes);
  const rows = game.log.map((e) => squaresFor(e, n)).join('<br>');
  const body = $('#result-body');
  body.innerHTML = `
    <svg class="result-hole" viewBox="0 0 260 90" aria-hidden="true">
      <ellipse cx="160" cy="78" rx="110" ry="9" fill="var(--accent-soft)"/>
      <ellipse cx="160" cy="76" rx="13" ry="4" fill="var(--ink)" opacity=".85"/>
      <path d="M160 76V12" stroke="var(--ink)" stroke-width="2.5"/>
      <path d="M161 12l30 10-30 10z" fill="var(--flag)" stroke="none"/>
      <circle class="${won ? 'ball-anim' : 'ball-lost'}" cx="160" cy="70" r="6" fill="#fff" stroke="var(--line-strong)" stroke-width="1.2"/>
    </svg>
    <div class="result-term">${term.emoji} ${esc(term.name)}</div>
    <div class="result-sub">${won ? `${strokes} stroke${strokes === 1 ? '' : 's'} · ${relToPar(strokes)} · ` : `Out of strokes · ${relToPar(strokes)} · `}⏱ ${formatDuration(game.elapsed)}</div>
    <div class="result-grid">${rows}</div>
    <div class="actions">
      <button class="btn primary" id="btn-share"><svg viewBox="0 0 24 24"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4M12 2v13"/></svg>Share</button>
      <button class="btn" data-open="dlg-stats">Stats</button>
    </div>
    <details class="result-sol"><summary>Solution</summary>${solutionTable()}</details>
    ${mode === 'daily' ? '<div class="countdown">Next hole in<b id="countdown"></b></div>' : `<div class="countdown"><a class="btn ghost" href="${mode === 'practice' ? practiceHref(PROFILES.indexOf(profile)) : './'}">${mode === 'practice' ? 'Play another practice puzzle' : "Play today's hole"}</a></div>`}
  `;
  $('#btn-share').addEventListener('click', share);
  clearInterval(countdownTimer);
  const tick = () => {
    const c = $('#countdown');
    if (!c) return;
    const ms = msUntilMidnight();
    c.textContent = formatDuration(ms);
    if (ms < 1000) c.innerHTML = '<a href="./">Tee off!</a>';
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
  openDialog('dlg-result');
}

function solutionTable() {
  let html = `<table class="answer"><thead><tr>${cats.map((c, i) => `<th class="c-${i}">${esc(c.name)}</th>`).join('')}</tr></thead><tbody>`;
  for (let e = 0; e < n; e++) {
    html += `<tr>${cats.map((c, i) => `<td>${esc(c.items[solution[e][i]].label)}</td>`).join('')}</tr>`;
  }
  return `${html}</tbody></table>`;
}

async function share() {
  const url = location.origin + location.pathname;
  const text = shareText({ game, puzzle, number, url: mode === 'practice' ? '' : url, streak: mode === 'daily' ? currentStreak() : 0 });
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (coarse && navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch {
      /* fall through to clipboard */
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Result copied to clipboard');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast('Result copied to clipboard');
  }
}

// ---------------------------------------------------------------------------
// Stats dialog

function renderStats() {
  const results = store.get('results', {});
  const s = computeStats(results, todayId());
  const max = Math.max(1, ...Object.values(s.dist));
  const todayStrokes = results[todayId()] ? (results[todayId()].won ? results[todayId()].strokes : LOST_STROKES) : null;

  let html = `<div class="stat-row">
      <div><b>${s.played}</b><span>Played</span></div>
      <div><b>${s.winPct}</b><span>Holed %</span></div>
      <div><b>${s.current}</b><span>Streak</span></div>
      <div><b>${s.best}</b><span>Best streak</span></div>
    </div>
    <h3>Score distribution</h3><div class="dist">`;
  for (const t of TERMS) {
    const v = s.dist[t.strokes];
    html += `<div class="dist-row"><span>${t.emoji} ${t.short}</span><div class="dist-bar ${todayStrokes === t.strokes ? 'hi' : ''}" style="width:${Math.max(8, (v / max) * 100)}%">${v}</div></div>`;
  }
  html += '</div>';
  if (s.played) html += `<p class="muted small">Average ${s.avg.toFixed(2)} strokes · ${s.toPar === 0 ? 'even' : s.toPar > 0 ? `+${s.toPar}` : `−${-s.toPar}`} to par overall</p>`;

  // Scorecard: the last nine days, golf-style.
  const days = [...Array(9).keys()].map((i) => addDays(todayId(), i - 8));
  let total = 0, playedHoles = 0;
  html += '<h3>Last nine holes</h3><div class="answer-scroll"><table class="scorecard"><tr><th class="lbl">Day</th>';
  html += days.map((d) => `<th>${formatDay(d, { weekday: 'narrow' })}</th>`).join('');
  html += '<th>±</th></tr><tr><td class="lbl">Par</td>' + days.map(() => `<td>${PAR}</td>`).join('') + `<td></td></tr><tr><td class="lbl">You</td>`;
  for (const d of days) {
    const r = results[d];
    if (!r) {
      html += `<td><span class="sc miss ${d === todayId() ? 'today' : ''}">·</span></td>`;
      continue;
    }
    const st = r.won ? r.strokes : LOST_STROKES;
    total += st - PAR;
    playedHoles++;
    const cls = st === 1 ? 'ace' : st < PAR ? 'under' : st === PAR ? '' : st === PAR + 1 ? 'over' : 'over2';
    html += `<td><span class="sc ${cls}">${r.won ? st : '✕'}</span></td>`;
  }
  html += `<td><b>${playedHoles ? (total === 0 ? 'E' : total > 0 ? `+${total}` : `−${-total}`) : '–'}</b></td></tr></table></div>`;
  $('#stats-body').innerHTML = html;
}

// ---------------------------------------------------------------------------
// Archive & practice

function renderArchive() {
  const pb = $('#practice-buttons');
  const order = [1, 2, 3, 4, 5, 6, 0];
  pb.innerHTML = order
    .map((i) => `<a class="btn" href="${practiceHref(i)}">${PROFILES[i].name}<small>${PROFILES[i].day} · ${PROFILES[i].k}×${PROFILES[i].n}</small></a>`)
    .join('');

  const results = store.get('results', {});
  const list = $('#archive-list');
  let html = '';
  for (let d = todayId(), i = 0; d >= EPOCH && i < 120; d = addDays(d, -1), i++) {
    const g = store.get(`game:${d}`, null);
    const p = profileForWeekday(weekday(d));
    let st = '<span class="muted">Not played</span>';
    if (g?.status === 'won') {
      const s = g.log.length;
      st = `<span class="c-3">${termFor(s).emoji} ${termFor(s).short}</span>`;
    } else if (g?.status === 'lost') st = '<span class="muted">🕳️ Lost ball</span>';
    else if (g?.log?.length || g?.started) st = '<span class="muted">In progress</span>';
    const href = d === todayId() ? './' : `?day=${d}`;
    html += `<li><a href="${href}"><span class="no">#${puzzleNumber(d)}</span><span>${esc(formatDay(d, { weekday: 'short', day: 'numeric', month: 'short' }))} <span class="muted small">· ${p.name}</span></span><span class="st">${st}</span></a></li>`;
  }
  list.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Settings

function applyTheme() {
  if (settings.theme === 'light' || settings.theme === 'dark') document.documentElement.dataset.theme = settings.theme;
  else delete document.documentElement.dataset.theme;
  for (const b of document.querySelectorAll('#set-theme button')) b.classList.toggle('on', b.dataset.v === settings.theme);
}

function bindSettings() {
  $('#set-theme').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    settings.theme = b.dataset.v;
    saveSettings();
    applyTheme();
  });
  const bindSwitch = (id, prop, after) => {
    const input = $(id);
    input.checked = !!settings[prop];
    input.addEventListener('change', () => {
      settings[prop] = input.checked;
      saveSettings();
      after?.();
    });
  };
  bindSwitch('#set-autox', 'autoX', refreshGrid);
  bindSwitch('#set-confirm', 'confirm');
  bindSwitch('#set-timer', 'timer', renderTimer);
  applyTheme();
}

// ---------------------------------------------------------------------------
// Dialog plumbing

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
// Click on the backdrop closes a dialog.
for (const dlg of document.querySelectorAll('dialog')) {
  dlg.addEventListener('click', (ev) => {
    if (ev.target !== dlg || dlg.id === 'dlg-confirm') return;
    const r = dlg.getBoundingClientRect();
    if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) dlg.close();
  });
}
$('#dlg-help').addEventListener('close', () => store.set('seenHelp', true));

$('#btn-undo').addEventListener('click', undo);
$('#btn-clear').addEventListener('click', async () => {
  if (!playing() || !Object.keys(game.marks).length) return;
  const wasConfirm = settings.confirm;
  settings.confirm = true;
  const ok = await confirmBox('Clear the grid?', 'All your marks will be removed (revealed links stay).', 'Clear');
  settings.confirm = wasConfirm;
  if (!ok) return;
  snapshot();
  game.marks = {};
  for (const kk of game.locked) game.marks[kk] = 2;
  changed();
});
$('#btn-show-result').addEventListener('click', openResult);
document.addEventListener('keydown', (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z' && !ev.target.closest('input, select, textarea')) {
    ev.preventDefault();
    undo();
  }
});

// ---------------------------------------------------------------------------
// Confetti

function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = $('#confetti');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  const styles = getComputedStyle(document.documentElement);
  const colors = ['--accent', '--flag', '--gold', '--c0', '--c2', '--c3'].map((v) => styles.getPropertyValue(v).trim());
  const parts = Array.from({ length: 140 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 14 - 4,
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
      p.vx *= 0.99;
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
    if (t - start < 2600) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  };
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// Boot

renderHeader();
renderClues();
buildGrid();
bindSettings();
renderAll();
if (!store.get('seenHelp', false)) openDialog('dlg-help');
else if (!playing() && mode === 'daily') setTimeout(openResult, 300);
