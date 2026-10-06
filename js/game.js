// Pure game rules: strokes, golf scoring, guess evaluation, stats and sharing.

import { addDays, daysBetween } from './date.js';

export const PAR = 3;
export const MAX_STROKES = 5;
export const LOST_STROKES = MAX_STROKES + 1; // a lost ball is scored as 6

export const TERMS = [
  { strokes: 1, name: 'Hole in one', short: 'Ace', emoji: '🏆' },
  { strokes: 2, name: 'Birdie', short: 'Birdie', emoji: '🐦' },
  { strokes: 3, name: 'Par', short: 'Par', emoji: '⛳' },
  { strokes: 4, name: 'Bogey', short: 'Bogey', emoji: '😬' },
  { strokes: 5, name: 'Double bogey', short: 'Dbl bogey', emoji: '😵' },
  { strokes: LOST_STROKES, name: 'Lost ball', short: 'Lost', emoji: '🕳️' },
];

export function strokesUsed(game) {
  return game.log.length;
}

export function finalStrokes(game) {
  return game.status === 'won' ? strokesUsed(game) : LOST_STROKES;
}

export function termFor(strokes) {
  return TERMS.find((t) => t.strokes === strokes) ?? TERMS[TERMS.length - 1];
}

export function relToPar(strokes) {
  const d = strokes - PAR;
  return d === 0 ? 'E' : d > 0 ? `+${d}` : `−${-d}`;
}

// guess[e][c] = item index (c >= 1); returns per-category correct counts.
export function evaluateGuess(puzzle, guess) {
  const perCat = [];
  let correct = 0;
  for (let c = 1; c < puzzle.k; c++) {
    let hits = 0;
    for (let e = 0; e < puzzle.n; e++) if (guess[e][c] === puzzle.solution[e][c]) hits++;
    perCat.push(hits);
    correct += hits;
  }
  const total = puzzle.n * (puzzle.k - 1);
  return { perCat, correct, total, won: correct === total };
}

export function newGame(id) {
  return {
    id,
    marks: {}, // "c1.x1.c2.x2" -> 1 (✗) | 2 (✓)
    locked: [], // cell keys revealed by penalty hints
    struck: [], // clue ids the player crossed off
    log: [], // strokes: { type: 'guess', perCat, correct } | { type: 'hint', e, c }
    status: 'playing', // 'playing' | 'won' | 'lost'
    elapsed: 0,
  };
}

export function squaresFor(entry, n) {
  if (entry.type === 'hint') return '💡';
  return entry.perCat.map((h) => (h === n ? '🟩' : h > 0 ? '🟨' : '⬛')).join('');
}

export function shareText({ game, puzzle, number, url, streak }) {
  const strokes = finalStrokes(game);
  const term = termFor(strokes);
  const label = number ? `PuzzleMind #${number}` : 'PuzzleMind practice';
  const head = `${label} · ${puzzle.profile.day} ${puzzle.profile.name}`;
  const rows = game.log.map((e) => squaresFor(e, puzzle.n));
  const result =
    game.status === 'won'
      ? `${term.emoji} ${term.name} (${relToPar(strokes)}) in ${strokes}/${MAX_STROKES}`
      : `${term.emoji} Lost ball (${relToPar(strokes)})`;
  const lines = [head, ...rows, result];
  const extras = [];
  if (game.elapsed) extras.push(`⏱️ ${fmt(game.elapsed)}`);
  if (streak > 1) extras.push(`🔥 ${streak}`);
  if (extras.length) lines.push(extras.join('  '));
  if (url) lines.push(url);
  return lines.join('\n');
}

const fmt = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// results: { [dayId]: { strokes, won } } for dailies finished on their day.
export function computeStats(results, today) {
  const days = Object.keys(results).sort();
  const played = days.length;
  const wins = days.filter((d) => results[d].won).length;

  let current = 0;
  let cursor = results[today] ? today : addDays(today, -1);
  while (results[cursor]?.won) {
    current++;
    cursor = addDays(cursor, -1);
  }
  if (results[today] && !results[today].won) current = 0;

  let best = 0, run = 0, prev = null;
  for (const d of days) {
    run = results[d].won && prev && daysBetween(prev, d) === 1 && results[prev].won ? run + 1 : results[d].won ? 1 : 0;
    best = Math.max(best, run);
    prev = d;
  }

  const dist = Object.fromEntries(TERMS.map((t) => [t.strokes, 0]));
  let totalStrokes = 0;
  for (const d of days) {
    const s = results[d].won ? results[d].strokes : LOST_STROKES;
    dist[s]++;
    totalStrokes += s;
  }

  return {
    played,
    wins,
    winPct: played ? Math.round((wins / played) * 100) : 0,
    current,
    best,
    dist,
    avg: played ? totalStrokes / played : 0,
    toPar: totalStrokes - PAR * played,
  };
}
