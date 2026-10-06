# PuzzleMind ⛳

**One hard logic-grid puzzle a day. Five strokes. Par 3.**

Every day, everyone gets the same logic puzzle: a story, a set of clues, and a
classic logic grid. Work out who goes with what, fill in your scorecard, and
take your shot. Each wrong shot tells you how many links you got right per
category. Solve it in as few strokes as you can and share your round.

## Features

- **Guaranteed fair puzzles.** Every puzzle has exactly one solution that pure
  deduction can reach, with no guessing. The generator only accepts puzzles its
  logical solver can finish, and the tests check uniqueness by brute force.
- **Weekly difficulty ramp.** Mon *Gentle* → Tue *Steady* → Wed *Tricky* →
  Thu *Tough* → Fri *Fierce* → Sat *Savage* → Sun *Monster*. From Wednesday
  on, puzzles *require* "suppose… contradiction" reasoning, and the grader
  counts how many such steps each puzzle needs.
- **Golf scoring.** 1 stroke = Hole in one, 2 = Birdie, 3 = Par, 4 = Bogey,
  5 = Double bogey, out of strokes = Lost ball. A *penalty stroke* reveals one
  correct link.
- **Spoiler-free share card** with per-category feedback squares, time and streak.
- **Stats:** streaks, score distribution and a nine-hole golf scorecard.
- **Archive and practice range:** replay past dailies, or play endless random
  puzzles at any difficulty.
- **Seven story themes** (Night Train, Bake-Off, Heist, Dog Show, Space
  Station, Marathon, Masquerade) with naturally phrased clues.
- Logic grid with tap / long-press / right-click / drag-to-paint, keyboard
  support (arrows, `x`, `o`, space, Ctrl+Z), auto-cross, crosshair highlight
  and undo. Light and dark themes, mobile friendly.

No backend and no build step: the daily puzzle is generated deterministically
from the date in the browser.

## Running locally

```sh
npm start          # serves the site on http://localhost:8080
npm test           # engine + game-rule tests (Node 20+)
```

Any static host works (GitHub Pages, Netlify, Cloudflare Pages). Just serve
the repository root.

## How it works

| File | Purpose |
| --- | --- |
| `js/engine.js` | Solver (constraint propagation + one level of what-if reasoning), clue generation, minimisation, grading, clue text |
| `js/profiles.js` | Per-weekday difficulty settings |
| `js/themes.js` | Story themes, categories and clue phrasing |
| `js/game.js` | Strokes, golf terms, guess evaluation, stats, share text |
| `js/date.js` | Local-midnight day ids and puzzle numbering (`EPOCH` = puzzle #1) |
| `js/app.js` | UI |

Generating a puzzle: pick a theme and a random solution → build a pool of
true clues (direct, negative, either/or, pairs, all-different, comparisons and
exact offsets on an ordered category) → add clues until the solver finishes
the grid → remove every clue that isn't needed → check the difficulty matches
the day, retrying with the same seeded RNG if it doesn't.
