// Logic-grid engine: generation, solving and grading.
//
// Representation
//  - Category 0 holds the people. Person e *is* entity e.
//  - For every other category c and item x, the solver tracks a bitmask of
//    the entities that item could still belong to.
//  - A ref {c, x} names "item x of category c" (i.e. whoever has it).
//
// The propagator only makes sound deductions, so if it reaches a fully
// determined grid the puzzle has exactly one solution. That property is what
// lets us guarantee every daily is uniquely solvable without brute force.

import { Rng } from './rng.js';
import { THEMES } from './themes.js';

const CONTRA = { contradiction: true };
const isSingle = (m) => m !== 0 && (m & (m - 1)) === 0;
const bitIndex = (m) => 31 - Math.clz32(m);

function relHolds(cl, va, vb) {
  if (cl.type === 'cmp') return cl.dir > 0 ? va > vb : va < vb;
  return va - vb === cl.d;
}

// ---------------------------------------------------------------------------
// Solver

export function initialState(ctx) {
  return new Int32Array((ctx.k - 1) * ctx.n).fill((1 << ctx.n) - 1);
}

export function propagate(ctx, s, clues) {
  const { k, n, values } = ctx;
  let changed = true;

  const dom = (r) => (r.c === 0 ? 1 << r.x : s[(r.c - 1) * n + r.x]);
  const restrict = (r, mask) => {
    if (r.c === 0) {
      if (!(mask & (1 << r.x))) throw CONTRA;
      return;
    }
    const i = (r.c - 1) * n + r.x;
    const v = s[i] & mask;
    if (v !== s[i]) {
      if (!v) throw CONTRA;
      s[i] = v;
      changed = true;
    }
  };
  const same = (a, b) => {
    const m = dom(a) & dom(b);
    restrict(a, m);
    restrict(b, m);
  };
  const diff = (a, b) => {
    const da = dom(a), db = dom(b);
    if (isSingle(da)) restrict(b, ~da);
    if (isSingle(db)) restrict(a, ~db);
  };
  const relation = (cl) => {
    const vals = values[cl.o];
    const base = (cl.o - 1) * n;
    const da = dom(cl.a), db = dom(cl.b);
    let na = 0, nb = 0;
    const supA = new Array(n).fill(0), supB = new Array(n).fill(0);
    for (let ea = 0; ea < n; ea++) {
      if (!((da >> ea) & 1)) continue;
      for (let eb = 0; eb < n; eb++) {
        if (eb === ea || !((db >> eb) & 1)) continue;
        for (let va = 0; va < n; va++) {
          if (!((s[base + va] >> ea) & 1)) continue;
          for (let vb = 0; vb < n; vb++) {
            if (vb === va || !((s[base + vb] >> eb) & 1)) continue;
            if (!relHolds(cl, vals[va], vals[vb])) continue;
            na |= 1 << ea;
            nb |= 1 << eb;
            supA[ea] |= 1 << va;
            supB[eb] |= 1 << vb;
          }
        }
      }
    }
    restrict(cl.a, na);
    restrict(cl.b, nb);
    const fa = dom(cl.a);
    if (isSingle(fa)) {
      const ea = bitIndex(fa);
      for (let va = 0; va < n; va++) if (!((supA[ea] >> va) & 1)) restrict({ c: cl.o, x: va }, ~fa);
    }
    const fb = dom(cl.b);
    if (isSingle(fb)) {
      const eb = bitIndex(fb);
      for (let vb = 0; vb < n; vb++) if (!((supB[eb] >> vb) & 1)) restrict({ c: cl.o, x: vb }, ~fb);
    }
  };

  try {
    while (changed) {
      changed = false;

      // Each category is a bijection onto the people.
      for (let c = 1; c < k; c++) {
        const base = (c - 1) * n;
        for (let x = 0; x < n; x++) {
          const m = s[base + x];
          if (isSingle(m)) for (let y = 0; y < n; y++) if (y !== x) restrict({ c, x: y }, ~m);
        }
        for (let e = 0; e < n; e++) {
          let count = 0, last = -1;
          for (let x = 0; x < n; x++) if ((s[base + x] >> e) & 1) { count++; last = x; }
          if (count === 0) throw CONTRA;
          if (count === 1) restrict({ c, x: last }, 1 << e);
        }
      }

      for (const cl of clues) {
        switch (cl.type) {
          case 'same':
            same(cl.a, cl.b);
            break;
          case 'diff':
            diff(cl.a, cl.b);
            break;
          case 'either': {
            restrict(cl.a, dom(cl.b) | dom(cl.c));
            if (!(dom(cl.a) & dom(cl.b))) same(cl.a, cl.c);
            else if (!(dom(cl.a) & dom(cl.c))) same(cl.a, cl.b);
            break;
          }
          case 'pair': {
            const { a1, a2, b1, b2 } = cl;
            const u = dom(b1) | dom(b2);
            restrict(a1, u);
            restrict(a2, u);
            const v = dom(a1) | dom(a2);
            restrict(b1, v);
            restrict(b2, v);
            if (!(dom(a1) & dom(b1)) || !(dom(a2) & dom(b2))) {
              same(a1, b2);
              same(a2, b1);
            } else if (!(dom(a1) & dom(b2)) || !(dom(a2) & dom(b1))) {
              same(a1, b1);
              same(a2, b2);
            }
            break;
          }
          case 'allDiff':
            diff(cl.a, cl.b);
            diff(cl.a, cl.c);
            diff(cl.b, cl.c);
            break;
          case 'cmp':
          case 'offset':
            relation(cl);
            break;
          default:
            throw new Error(`Unknown clue type ${cl.type}`);
        }
      }
    }
    return true;
  } catch (e) {
    if (e === CONTRA) return false;
    throw e;
  }
}

export const isSolved = (s) => s.every(isSingle);

// Solve using direct propagation, optionally followed by single-level
// "suppose this... it breaks" reasoning. Returns how many such what-if
// deductions were needed, which is our main hardness signal.
export function solve(ctx, clues, level = 1) {
  const s = initialState(ctx);
  if (!propagate(ctx, s, clues)) return { ok: false, solved: false, trials: 0, state: s };
  let trials = 0;
  if (level >= 1) {
    let progress = true;
    while (progress && !isSolved(s)) {
      progress = false;
      scan: for (let i = 0; i < s.length; i++) {
        const m = s[i];
        if (isSingle(m)) continue;
        for (let e = 0; e < ctx.n; e++) {
          if (!((m >> e) & 1)) continue;
          const t = s.slice();
          t[i] = 1 << e;
          if (!propagate(ctx, t, clues)) {
            s[i] &= ~(1 << e);
            trials++;
            if (!propagate(ctx, s, clues)) return { ok: false, solved: false, trials, state: s };
            progress = true;
            break scan;
          }
        }
      }
    }
  }
  return { ok: true, solved: isSolved(s), trials, state: s };
}

// ---------------------------------------------------------------------------
// Truth of a clue against a full solution (used by generation and tests).

export function clueHolds(puzzle, cl) {
  const { inv, ent, values } = puzzle;
  const who = (r) => inv[r.c][r.x];
  switch (cl.type) {
    case 'same':
      return who(cl.a) === who(cl.b);
    case 'diff':
      return who(cl.a) !== who(cl.b);
    case 'either':
      return who(cl.a) === who(cl.b) || who(cl.a) === who(cl.c);
    case 'pair':
      return (
        (who(cl.a1) === who(cl.b1) && who(cl.a2) === who(cl.b2)) ||
        (who(cl.a1) === who(cl.b2) && who(cl.a2) === who(cl.b1))
      );
    case 'allDiff': {
      const a = who(cl.a), b = who(cl.b), c = who(cl.c);
      return a !== b && a !== c && b !== c;
    }
    case 'cmp':
    case 'offset': {
      const ea = who(cl.a), eb = who(cl.b);
      if (ea === eb) return false;
      return relHolds(cl, values[cl.o][ent[ea][cl.o]], values[cl.o][ent[eb][cl.o]]);
    }
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Generation

function randomClue(rng, P, type) {
  const { k, n, ent, ordered, values } = P;
  const ref = (e, c) => ({ c, x: ent[e][c] });
  const twoEnts = () => {
    const a = rng.int(n);
    let b = rng.int(n - 1);
    if (b >= a) b++;
    return [a, b];
  };
  const twoCats = (pool) => {
    const [a, b] = rng.shuffle(pool);
    return [a, b];
  };
  const allCats = [...Array(k).keys()];
  const plainCats = allCats.filter((c) => c !== ordered);

  switch (type) {
    case 'same': {
      const e = rng.int(n);
      const [ca, cb] = twoCats(allCats);
      return { type, a: ref(e, ca), b: ref(e, cb) };
    }
    case 'diff': {
      const [e1, e2] = twoEnts();
      const [ca, cb] = twoCats(allCats);
      return { type, a: ref(e1, ca), b: ref(e2, cb) };
    }
    case 'either': {
      const [e1, e2] = twoEnts();
      const [ca, cb] = twoCats(allCats);
      const right = ref(e1, cb), wrong = ref(e2, cb);
      const [b, c] = rng.next() < 0.5 ? [right, wrong] : [wrong, right];
      return { type, a: ref(e1, ca), b, c };
    }
    case 'pair': {
      const [e1, e2] = twoEnts();
      const [ca, cb] = twoCats(allCats);
      const swap = rng.next() < 0.5;
      return {
        type,
        a1: ref(e1, ca), a2: ref(e2, ca),
        b1: ref(swap ? e2 : e1, cb), b2: ref(swap ? e1 : e2, cb),
      };
    }
    case 'allDiff': {
      if (k < 3 || n < 3) return null;
      const es = rng.shuffle([...Array(n).keys()]).slice(0, 3);
      const cs = rng.shuffle(allCats).slice(0, 3);
      return { type, a: ref(es[0], cs[0]), b: ref(es[1], cs[1]), c: ref(es[2], cs[2]) };
    }
    case 'cmp':
    case 'offset': {
      const [e1, e2] = twoEnts();
      const ca = rng.pick(plainCats), cb = rng.pick(plainCats);
      const va = values[ordered][ent[e1][ordered]];
      const vb = values[ordered][ent[e2][ordered]];
      const base = { type, o: ordered, a: ref(e1, ca), b: ref(e2, cb) };
      return type === 'cmp' ? { ...base, dir: va > vb ? 1 : -1 } : { ...base, d: va - vb };
    }
    default:
      return null;
  }
}

function buildSkeleton(rng, profile) {
  const { k, n } = profile;
  const theme = rng.pick(THEMES);

  const makeItems = (spec) =>
    spec.items.map((it) => (Array.isArray(it) ? { label: it[0], short: it[1] } : { label: it, short: it }));

  const anchorItems = rng
    .shuffle(makeItems(theme.anchor))
    .slice(0, n)
    .sort((a, b) => a.label.localeCompare(b.label));

  const extras = rng.shuffle(theme.extras).slice(0, k - 2);
  const ordSpec = theme.ordered;
  const ordValues = rng
    .shuffle(ordSpec.values)
    .slice(0, n)
    .sort((a, b) => a - b);
  const ordCat = {
    name: ordSpec.name,
    ordered: true,
    items: ordValues.map((v) => ({
      label: ordSpec.fmt(v),
      short: ordSpec.short ? ordSpec.short(v) : ordSpec.fmt(v),
      value: v,
    })),
    spec: ordSpec,
  };
  const plain = extras.map((spec) => ({
    name: spec.name,
    items: rng
      .shuffle(makeItems(spec))
      .slice(0, n)
      .sort((a, b) => a.short.localeCompare(b.short)),
    spec,
  }));

  // Put the ordered category in a random non-anchor slot.
  const others = plain.slice();
  others.splice(rng.int(others.length + 1), 0, ordCat);
  const cats = [
    {
      name: theme.anchor.name,
      items: anchorItems,
      spec: { subj: (x) => x, pos: (x) => `is ${x}`, neg: (x) => `is not ${x}` },
    },
    ...others,
  ];
  const ordered = cats.indexOf(ordCat);
  const values = cats.map((c) => (c.ordered ? c.items.map((i) => i.value) : null));

  // Random solution: ent[e][c] = item index; inv[c][x] = entity.
  const ent = [...Array(n)].map((_, e) => [e]);
  for (let c = 1; c < k; c++) {
    const perm = rng.shuffle([...Array(n).keys()]);
    for (let e = 0; e < n; e++) ent[e][c] = perm[e];
  }
  const inv = cats.map((_, c) => {
    const row = [];
    for (let e = 0; e < n; e++) row[ent[e][c]] = e;
    return row;
  });

  return { theme, cats, k, n, ordered, values, ent, inv };
}

function sameState(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function attempt(rng, profile) {
  const P = buildSkeleton(rng, profile);
  const ctx = { k: P.k, n: P.n, values: P.values };

  // Candidate pool of true clues.
  const pool = [];
  const seen = new Set();
  for (let i = 0; i < 400 && pool.length < 220; i++) {
    const cl = randomClue(rng, P, rng.weighted(profile.weights));
    if (!cl) continue;
    const key = JSON.stringify(cl);
    if (seen.has(key) || !clueHolds(P, cl)) continue;
    seen.add(key);
    pool.push(cl);
  }

  // Grow: add clues that tell us something new until the grid is solvable.
  const chosen = [];
  let state = initialState(ctx);
  let solved = false;
  for (const cl of pool) {
    const next = state.slice();
    if (!propagate(ctx, next, [...chosen, cl])) return null; // would mean a false clue
    if (sameState(next, state)) continue;
    chosen.push(cl);
    state = next;
    if (isSolved(state) || solve(ctx, chosen, profile.level).solved) {
      solved = true;
      break;
    }
  }
  if (!solved) return null;

  // Shrink: drop every clue that isn't needed.
  let clues = chosen;
  for (const cl of rng.shuffle(chosen)) {
    const without = clues.filter((c) => c !== cl);
    if (solve(ctx, without, profile.level).solved) clues = without;
  }

  const direct = solve(ctx, clues, 0).solved;
  const { trials } = solve(ctx, clues, 1);
  return { P, ctx, clues: rng.shuffle(clues), direct, trials };
}

function score(profile, cand) {
  // 0 = perfect fit, larger = worse.
  if (profile.level === 0) return cand.direct ? 0 : 100;
  return Math.max(0, profile.minTrials - cand.trials);
}

export function generatePuzzle(seed, profile, { maxAttempts = 60 } = {}) {
  const rng = new Rng(`puzzlemind|${seed}`);
  let best = null, bestScore = Infinity;
  for (let i = 0; i < maxAttempts; i++) {
    const cand = attempt(rng, profile);
    if (!cand) continue;
    const sc = score(profile, cand);
    if (sc < bestScore) {
      best = cand;
      bestScore = sc;
    }
    if (sc === 0) break;
  }
  if (!best) throw new Error(`Could not generate puzzle for ${seed}`);
  return finalize(best, profile, seed);
}

// ---------------------------------------------------------------------------
// Presentation

// Items in clue text are wrapped as {{c:label}} so the UI can colour them.
const mark = (c, label) => `{{${c}:${label}}}`;

export function clueText(P, cl) {
  const ph = (r, form) => P.cats[r.c].spec[form](mark(r.c, P.cats[r.c].items[r.x].label));
  const S = (r) => capFirst(ph(r, 'subj'));
  const s = (r) => ph(r, 'subj');
  const pos = (r) => ph(r, 'pos');
  const neg = (r) => ph(r, 'neg');
  switch (cl.type) {
    case 'same':
      return `${S(cl.a)} ${pos(cl.b)}.`;
    case 'diff':
      return `${S(cl.a)} ${neg(cl.b)}.`;
    case 'either':
      return `${S(cl.a)} is either ${s(cl.b)} or ${s(cl.c)}.`;
    case 'pair':
      return `Of ${s(cl.a1)} and ${s(cl.a2)}, one ${pos(cl.b1)} and the other ${pos(cl.b2)}.`;
    case 'allDiff':
      return `${S(cl.a)}, ${s(cl.b)} and ${s(cl.c)} are three different ${P.theme.people}.`;
    case 'cmp': {
      const o = P.cats[cl.o].spec;
      return `${S(cl.a)} ${cl.dir > 0 ? o.more : o.less} ${s(cl.b)}.`;
    }
    case 'offset': {
      const o = P.cats[cl.o].spec;
      return `${S(cl.a)} ${cl.d > 0 ? o.diffMore(cl.d) : o.diffLess(-cl.d)} ${s(cl.b)}.`;
    }
    default:
      return '';
  }
}

export const plainText = (text) => text.replace(/\{\{\d+:([^}]*)\}\}/g, '$1');

function capFirst(str) {
  // Capitalise the first visible character, skipping a leading {{c: marker.
  const m = str.match(/^(\{\{\d+:)?(.)/);
  if (!m) return str;
  const prefix = m[1] || '';
  return prefix + m[2].toUpperCase() + str.slice(prefix.length + 1);
}

function finalize(cand, profile, seed) {
  const { P, clues, trials, direct } = cand;
  return {
    seed,
    profile: { day: profile.day, name: profile.name },
    theme: { id: P.theme.id, title: P.theme.title, icon: P.theme.icon, people: P.theme.people, intro: P.theme.intro(P.n) },
    k: P.k,
    n: P.n,
    cats: P.cats.map((c) => ({ name: c.name, ordered: !!c.ordered, items: c.items.map((i) => ({ label: i.label, short: i.short })) })),
    clues: clues.map((cl, i) => ({ id: i, type: cl.type, text: clueText(P, cl) })),
    rawClues: clues,
    solution: P.ent.map((row) => row.slice()),
    values: P.values,
    stats: { trials, direct },
  };
}
