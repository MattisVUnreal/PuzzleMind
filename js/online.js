// Shared results via Supabase: today's average and the leaderboard.
// Everything here is optional. If the service can't be reached the game
// works exactly as before, just without the online parts.

// The publishable key is meant to be public; the database only allows what
// supabase/schema.sql grants.
const SUPABASE_URL = 'https://kdufxprwhrpgjxwkdqhw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wCK2sflvIlXlAg_aQeoTBg_DHxhVLS7';

// Tests point the game at a fake server by setting globalThis.DT_API_URL.
const base = () => globalThis.DT_API_URL ?? SUPABASE_URL;

async function call(path, body, prefer) {
  const res = await fetch(`${base()}/rest/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
  });
  if (res.status === 409) return null; // already submitted today
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export function submitResult({ day, player, name, stars, elapsed }) {
  return call(
    'results',
    {
      day,
      player,
      name: name || null,
      stars,
      total: stars.reduce((s, x) => s + x, 0),
      elapsed_ms: Math.round(elapsed),
    },
    'return=minimal',
  );
}

export const daySummary = (day) => call('rpc/day_summary', { d: day });
export const leaderboard = (day) => call('rpc/leaderboard', { d: day });
export const setName = (day, player, name) => call('rpc/set_name', { d: day, p: player, n: name });

// Share of players who scored strictly fewer stars than `total`.
export function beatShare(hist, total) {
  const all = hist.reduce((s, c) => s + c, 0);
  if (!all) return 0;
  const below = hist.slice(0, total).reduce((s, c) => s + c, 0);
  return Math.round((below / all) * 100);
}
