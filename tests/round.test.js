import { test } from 'node:test';
import assert from 'node:assert/strict';
import { puzzleStars, shareText, computeStats } from '../js/round.js';
import { puzzleNumber, addDays } from '../js/date.js';

const p = { target: 100, near: 5, ok: 10 };

test('stars by distance, hint costs one', () => {
  assert.equal(puzzleStars(p, 100, false), 3);
  assert.equal(puzzleStars(p, 96, false), 2);
  assert.equal(puzzleStars(p, 110, false), 1);
  assert.equal(puzzleStars(p, 120, false), 0);
  assert.equal(puzzleStars(p, 100, true), 2);
  assert.equal(puzzleStars(p, 120, true), 0);
});

test('share text', () => {
  const txt = shareText({ number: 1, label: '7 okt.', stars: [3, 3, 2, 1, 0], elapsed: 125000, streak: 3 });
  assert.equal(txt, 'Dagens tal #1 · 7 okt.\n🟩🟩🟨🟧⬜\n9/15 ⭐\n⏱️ 2:05  🔥 3 dagar i rad');
});

test('stats and streaks', () => {
  const r = {
    '2026-10-07': { stars: [3, 3, 3, 3, 3] },
    '2026-10-08': { stars: [3, 2, 1, 0, 2] },
    '2026-10-10': { stars: [3, 3, 3, 2, 2] },
  };
  const s = computeStats(r, '2026-10-11');
  assert.equal(s.played, 3);
  assert.equal(s.current, 1);
  assert.equal(s.best, 2);
  assert.equal(s.bestRound, 15);
  assert.equal(s.perfect, 1);
  assert.equal(s.dist[3], 9);
});

test('dates', () => {
  assert.equal(puzzleNumber('2026-10-07'), 1);
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
});
