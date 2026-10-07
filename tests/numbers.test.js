import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyOp, canReach, generateRound, LEVELS } from '../js/numbers.js';

test('operations stay whole and positive', () => {
  assert.equal(applyOp(3, 10, '−').value, 7);
  assert.equal(applyOp(5, 25, '÷').value, 5);
  assert.ok(applyOp(7, 25, '÷').error);
  assert.ok(applyOp(6, 6, '−').error);
  assert.equal(applyOp(4, 25, '×').value, 100);
});

// Replay a solution, checking every step uses numbers that are available.
function replay(numbers, solution) {
  const pool = numbers.slice();
  let last = null;
  for (const line of solution) {
    const m = line.match(/^(\d+) (.) (\d+) = (\d+)$/);
    assert.ok(m, `unparseable step: ${line}`);
    const [, a, op, b, r] = m;
    for (const v of [+a, +b]) {
      const i = pool.indexOf(v);
      assert.ok(i >= 0, `${v} not available in ${pool}`);
      pool.splice(i, 1);
    }
    assert.equal(applyOp(+a, +b, op).value, +r);
    pool.push(+r);
    last = +r;
  }
  return last;
}

test('every target is reachable and needs the intended number of steps', () => {
  for (let d = 0; d < 25; d++) {
    const round = generateRound(`test-${d}`);
    assert.equal(round.length, LEVELS.length);
    round.forEach((p, i) => {
      const spec = LEVELS[i];
      assert.equal(p.numbers.length, 6);
      assert.ok(p.target >= spec.range[0] && p.target <= spec.range[1]);
      assert.equal(p.solution.length, spec.steps);
      assert.equal(replay(p.numbers, p.solution), p.target);
      assert.equal(canReach(p.numbers, p.target, spec.steps - 1), false);
    });
  }
});

test('same day gives the same numbers', () => {
  assert.deepEqual(generateRound('2026-10-07'), generateRound('2026-10-07'));
  assert.notDeepEqual(generateRound('2026-10-07'), generateRound('2026-10-08'));
});
