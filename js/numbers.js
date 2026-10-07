// Dagens tal: number generation and solving.
//
// Each puzzle has six numbers and a target. A target is made by applying a
// random chain of operations to the numbers, then checked: it must not be
// reachable in fewer steps than the puzzle's difficulty asks for. So every
// target can be hit exactly, and harder puzzles really need more steps.

import { Rng } from './rng.js';

export const OPS = ['+', '−', '×', '÷'];

// Combine two numbers. Subtraction and division always take the larger
// number first, so players never need to think about order or negatives.
export function applyOp(a, b, op) {
  const hi = Math.max(a, b), lo = Math.min(a, b);
  switch (op) {
    case '+':
      return { value: a + b, text: `${a} + ${b}` };
    case '×':
      return { value: a * b, text: `${a} × ${b}` };
    case '−':
      if (hi === lo) return { error: 'Det blir noll. Välj två olika tal.' };
      return { value: hi - lo, text: `${hi} − ${lo}` };
    case '÷':
      if (hi % lo !== 0) return { error: `${hi} går inte att dela jämnt med ${lo}.` };
      return { value: hi / lo, text: `${hi} ÷ ${lo}` };
    default:
      return { error: 'Okänt räknesätt.' };
  }
}

// Can `target` be made from `nums` using at most `depth` operations?
export function canReach(nums, target, depth) {
  const seen = new Set();
  const rec = (list, d) => {
    if (list.includes(target)) return true;
    if (d === 0 || list.length < 2) return false;
    const memo = `${d}|${[...list].sort((x, y) => x - y).join(',')}`;
    if (seen.has(memo)) return false;
    seen.add(memo);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const rest = list.filter((_, k) => k !== i && k !== j);
        for (const op of OPS) {
          const r = applyOp(list[i], list[j], op);
          if (r.error || r.value === list[i] || r.value === list[j]) continue; // ×1, ÷1 are no-ops
          if (rec([...rest, r.value], d - 1)) return true;
        }
      }
    }
    return false;
  };
  return rec(nums, depth);
}

// The three daily puzzles: easy, medium and hard.
//  big      how many of the large numbers (25, 50, 75, 100) are dealt
//  steps    operations the target needs (and can't be done in fewer)
//  range    target range
//  near/ok  how close earns two stars / one star
export const LEVELS = [
  { big: 0, steps: 2, range: [12, 60], near: 2, ok: 5 },
  { big: 1, steps: 3, range: [60, 300], near: 5, ok: 10 },
  { big: 2, steps: 3, range: [150, 600], near: 5, ok: 10 },
];

const BIG = [25, 50, 75, 100];

function dealNumbers(rng, big) {
  const bigs = rng.shuffle(BIG).slice(0, big);
  const smalls = [];
  while (smalls.length < 6 - big) {
    const v = 1 + rng.int(10);
    if (smalls.filter((x) => x === v).length < 2) smalls.push(v);
  }
  return [...smalls.sort((a, b) => a - b), ...bigs.sort((a, b) => a - b)];
}

function randomWalk(rng, nums, steps) {
  // Track numbers with the operations that built them.
  let pool = nums.map((v) => ({ v, made: [] }));
  let last = null;
  for (let s = 0; s < steps; s++) {
    // Always build on the previous result so every step contributes.
    const i = last ?? rng.int(pool.length);
    let j = rng.int(pool.length - 1);
    if (j >= i) j++;
    const a = pool[i], b = pool[j];
    const ops = rng.shuffle(OPS);
    let made = null;
    for (const op of ops) {
      const r = applyOp(a.v, b.v, op);
      if (r.error || r.value === a.v || r.value === b.v || r.value > 2000) continue;
      made = { v: r.value, made: [...a.made, ...b.made, `${r.text} = ${r.value}`] };
      break;
    }
    if (!made) return null;
    pool = pool.filter((_, k) => k !== i && k !== j);
    pool.push(made);
    last = pool.length - 1;
  }
  return pool[last];
}

export function generatePuzzle(rng, spec) {
  for (let tries = 0; tries < 2000; tries++) {
    const nums = dealNumbers(rng, spec.big);
    const res = randomWalk(rng, nums, spec.steps);
    if (!res) continue;
    const t = res.v;
    if (t < spec.range[0] || t > spec.range[1]) continue;
    if (canReach(nums, t, spec.steps - 1)) continue;
    return { numbers: nums, target: t, solution: res.made, ...spec };
  }
  throw new Error('Kunde inte skapa ett tal');
}

export function generateRound(seed) {
  const rng = new Rng(`dagens-tal|${seed}`);
  return LEVELS.map((spec) => generatePuzzle(rng, spec));
}
