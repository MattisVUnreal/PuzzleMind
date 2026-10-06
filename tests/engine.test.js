import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePuzzle, clueHolds, plainText } from '../js/engine.js';
import { PROFILES } from '../js/profiles.js';

function permutations(n) {
  const out = [];
  const rec = (arr, rest) => {
    if (!rest.length) return out.push(arr);
    rest.forEach((v, i) => rec([...arr, v], rest.filter((_, j) => j !== i)));
  };
  rec([], [...Array(n).keys()]);
  return out;
}

// Exhaustively count solutions consistent with every clue.
function countSolutions(pz, limit = 2) {
  const { k, n, rawClues, values } = pz;
  const perms = permutations(n);
  let count = 0;
  const ent = [...Array(n)].map((_, e) => [e]);
  const rec = (c) => {
    if (count >= limit) return;
    if (c === k) {
      const inv = [...Array(k)].map((_, cc) => {
        const row = [];
        for (let e = 0; e < n; e++) row[ent[e][cc]] = e;
        return row;
      });
      const P = { ent, inv, values };
      if (rawClues.every((cl) => clueHolds(P, cl))) count++;
      return;
    }
    for (const p of perms) {
      for (let e = 0; e < n; e++) ent[e][c] = p[e];
      rec(c + 1);
    }
  };
  rec(1);
  return count;
}

function solutionView(pz) {
  const inv = pz.cats.map((_, c) => {
    const row = [];
    pz.solution.forEach((r, e) => (row[r[c]] = e));
    return row;
  });
  return { ent: pz.solution, inv, values: pz.values };
}

for (const profile of PROFILES) {
  test(`${profile.day} (${profile.name}) puzzles are uniquely solvable`, () => {
    for (let i = 0; i < 4; i++) {
      const pz = generatePuzzle(`test-${profile.day}-${i}`, profile);
      assert.equal(pz.k, profile.k);
      assert.equal(pz.n, profile.n);
      const sol = solutionView(pz);
      for (const cl of pz.rawClues) assert.ok(clueHolds(sol, cl), `false clue: ${JSON.stringify(cl)}`);
      assert.equal(countSolutions(pz), 1, `puzzle ${pz.seed} is not unique`);
    }
  });
}

test('generation is deterministic for a seed', () => {
  const a = generatePuzzle('2026-10-06', PROFILES[2]);
  const b = generatePuzzle('2026-10-06', PROFILES[2]);
  assert.deepEqual(a.solution, b.solution);
  assert.deepEqual(a.clues, b.clues);
});

test('harder days demand what-if reasoning', () => {
  for (const profile of PROFILES.filter((p) => p.level === 1)) {
    const pz = generatePuzzle(`hard-${profile.day}`, profile);
    assert.ok(pz.stats.trials >= profile.minTrials, `${profile.day}: ${pz.stats.trials} trials`);
    assert.equal(pz.stats.direct, false);
  }
});

test('clue text is clean prose', () => {
  const pz = generatePuzzle('prose', PROFILES[0]);
  for (const c of pz.clues) {
    const t = plainText(c.text);
    assert.match(t, /^[A-ZÉ]/);
    assert.match(t, /\.$/);
    assert.doesNotMatch(t, /\{\{|\}\}|undefined/);
  }
});
