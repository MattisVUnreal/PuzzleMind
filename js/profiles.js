// Difficulty ramps across the week, NYT-crossword style.
//  k        number of categories (including the people)
//  n        items per category
//  level    deepest reasoning the grader may use
//           0 = direct deductions only, 1 = "suppose X... contradiction"
//  minTrials  minimum number of what-if deductions the puzzle must require
//  weights  relative frequency of each clue type in the candidate pool

export const PROFILES = [
  // Sunday (JS getDay() === 0)
  { day: 'Sun', name: 'Monster', k: 4, n: 5, level: 1, minTrials: 4,
    weights: { same: 0, diff: 3, either: 3, pair: 3, allDiff: 2, cmp: 3, offset: 3 } },
  { day: 'Mon', name: 'Gentle', k: 3, n: 4, level: 0, minTrials: 0,
    weights: { same: 3, diff: 3, either: 2, pair: 1, allDiff: 1, cmp: 2, offset: 1 } },
  { day: 'Tue', name: 'Steady', k: 4, n: 4, level: 0, minTrials: 0,
    weights: { same: 2, diff: 3, either: 2, pair: 2, allDiff: 1, cmp: 2, offset: 2 } },
  { day: 'Wed', name: 'Tricky', k: 4, n: 4, level: 1, minTrials: 1,
    weights: { same: 1, diff: 3, either: 3, pair: 2, allDiff: 2, cmp: 2, offset: 2 } },
  { day: 'Thu', name: 'Tough', k: 4, n: 5, level: 0, minTrials: 0,
    weights: { same: 1, diff: 3, either: 3, pair: 2, allDiff: 2, cmp: 2, offset: 2 } },
  { day: 'Fri', name: 'Fierce', k: 4, n: 5, level: 1, minTrials: 1,
    weights: { same: 1, diff: 3, either: 3, pair: 3, allDiff: 2, cmp: 3, offset: 2 } },
  { day: 'Sat', name: 'Savage', k: 4, n: 5, level: 1, minTrials: 2,
    weights: { same: 0, diff: 3, either: 3, pair: 3, allDiff: 2, cmp: 3, offset: 3 } },
];

export const profileForWeekday = (weekday) => PROFILES[weekday];
