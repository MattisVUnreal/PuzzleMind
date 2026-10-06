import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats, evaluateGuess, shareText, termFor, relToPar, newGame } from '../js/game.js';
import { puzzleNumber, addDays, weekday } from '../js/date.js';

test('golf terms and par', () => {
  assert.equal(termFor(1).name, 'Hole in one');
  assert.equal(termFor(3).name, 'Par');
  assert.equal(termFor(6).name, 'Lost ball');
  assert.equal(relToPar(2), '−1');
  assert.equal(relToPar(3), 'E');
  assert.equal(relToPar(5), '+2');
});

test('evaluateGuess counts per category', () => {
  const puzzle = { k: 3, n: 3, solution: [[0, 0, 2], [1, 1, 0], [2, 2, 1]] };
  const res = evaluateGuess(puzzle, [[0, 0, 0], [1, 1, 2], [2, 2, 1]]);
  assert.deepEqual(res.perCat, [3, 1]);
  assert.equal(res.won, false);
  assert.equal(evaluateGuess(puzzle, puzzle.solution).won, true);
});

test('streaks', () => {
  const results = {
    '2026-10-01': { won: true, strokes: 2 },
    '2026-10-02': { won: true, strokes: 3 },
    '2026-10-03': { won: false, strokes: 6 },
    '2026-10-04': { won: true, strokes: 1 },
    '2026-10-05': { won: true, strokes: 4 },
  };
  const s = computeStats(results, '2026-10-06');
  assert.equal(s.current, 2); // today not played yet: streak still alive
  assert.equal(s.best, 2);
  assert.equal(s.played, 5);
  assert.equal(s.winPct, 80);
  assert.equal(s.dist[6], 1);
  assert.equal(computeStats(results, '2026-10-07').current, 0);
});

test('share text', () => {
  const game = newGame('x');
  game.log = [{ type: 'guess', perCat: [4, 2, 0] }, { type: 'hint' }, { type: 'guess', perCat: [4, 4, 4] }];
  game.status = 'won';
  game.elapsed = 125000;
  const txt = shareText({ game, puzzle: { n: 4, profile: { day: 'Wed', name: 'Tricky' } }, number: 6, streak: 3 });
  assert.equal(txt, 'PuzzleMind #6 · Wed Tricky\n🟩🟨⬛\n💡\n🟩🟩🟩\n⛳ Par (E) in 3/5\n⏱️ 2:05  🔥 3');
});

test('dates', () => {
  assert.equal(puzzleNumber('2026-10-01'), 1);
  assert.equal(puzzleNumber('2026-10-06'), 6);
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(weekday('2026-10-06'), 2); // Tuesday
});
