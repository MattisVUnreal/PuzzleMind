// Day handling. A "day id" is the player's local calendar date, YYYY-MM-DD,
// so the puzzle rolls over at local midnight (like Wordle).

export const EPOCH = '2026-10-01'; // Puzzle #1

const pad = (n) => String(n).padStart(2, '0');
const toUTC = (id) => {
  const [y, m, d] = id.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUTC = (ms) => {
  const dt = new Date(ms);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
};

export const isDayId = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUTC(s));

export function todayId(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export const addDays = (id, delta) => fromUTC(toUTC(id) + delta * 86400000);
export const daysBetween = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000);
export const puzzleNumber = (id) => daysBetween(EPOCH, id) + 1;
export const weekday = (id) => new Date(toUTC(id)).getUTCDay();

export function formatDay(id, opts = { weekday: 'long', day: 'numeric', month: 'long' }) {
  return new Date(toUTC(id)).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' });
}

export function msUntilMidnight(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next - now;
}

export function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
