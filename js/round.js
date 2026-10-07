// Rules for a round: stars, stats and the share card.

import { addDays, daysBetween } from './date.js';

export const PUZZLES = 5;
export const MAX_STARS = PUZZLES * 3;

export const RESULTS = [
  { stars: 3, name: 'Exakt!', square: '🟩' },
  { stars: 2, name: 'Nära', square: '🟨' },
  { stars: 1, name: 'Hyfsat', square: '🟧' },
  { stars: 0, name: 'Långt ifrån', square: '⬛' },
];

export const resultFor = (stars) => RESULTS.find((r) => r.stars === stars) ?? RESULTS[RESULTS.length - 1];
export const starString = (stars, max = 3) => '★'.repeat(stars) + '☆'.repeat(max - stars);

// Stars for a finished puzzle. A hint costs one star.
export function puzzleStars(puzzle, value, hint) {
  const dist = Math.abs(puzzle.target - value);
  const base = dist === 0 ? 3 : dist <= puzzle.near ? 2 : dist <= puzzle.ok ? 1 : 0;
  return Math.max(0, base - (hint ? 1 : 0));
}

export function shareText({ number, label, stars, elapsed, streak, url }) {
  const total = stars.reduce((s, h) => s + h, 0);
  const lines = [
    number ? `Dagens tal #${number} · ${label}` : 'Dagens tal · träning',
    stars.map((s) => resultFor(s).square).join(''),
    `${total}/${MAX_STARS} ⭐`,
  ];
  const extras = [];
  if (elapsed) extras.push(`⏱️ ${Math.floor(elapsed / 60000)}:${String(Math.floor(elapsed / 1000) % 60).padStart(2, '0')}`);
  if (streak > 1) extras.push(`🔥 ${streak} dagar i rad`);
  if (extras.length) lines.push(extras.join('  '));
  if (url) lines.push(url);
  return lines.join('\n');
}

// results: { [dayId]: { stars: [0..3 x5] } } for rounds finished on their own day.
export function computeStats(results, today) {
  const days = Object.keys(results).sort();
  const totals = days.map((d) => results[d].stars.reduce((s, h) => s + h, 0));

  let current = 0;
  let cursor = results[today] ? today : addDays(today, -1);
  while (results[cursor]) {
    current++;
    cursor = addDays(cursor, -1);
  }
  let best = 0, run = 0, prev = null;
  for (const d of days) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }

  const dist = Object.fromEntries(RESULTS.map((r) => [r.stars, 0]));
  for (const d of days) for (const s of results[d].stars) dist[s]++;

  return {
    played: days.length,
    current,
    best,
    bestRound: totals.length ? Math.max(...totals) : null,
    avg: totals.length ? totals.reduce((s, t) => s + t, 0) / totals.length : null,
    perfect: totals.filter((t) => t === MAX_STARS).length,
    dist,
  };
}
