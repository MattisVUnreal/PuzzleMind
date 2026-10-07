-- Dagens tal: switch the database from five to three puzzles a day.
-- Run once: Supabase → SQL Editor → New query → paste → Run.
-- This DELETES all saved results (so far only test rounds) and recreates
-- the table, rules and functions for three puzzles (max 9 stars).

drop table if exists public.results cascade;

-- Dagens tal: results, daily average and leaderboard.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to run again.
--
-- Security model
--  * Players may only INSERT a result for (about) today. They can never read,
--    change or delete rows directly.
--  * Reading happens through two functions that only return aggregates and
--    the leaderboard (names + times), never the per-browser player ids.
--  * The player id is a random id stored in the player's browser. It works as
--    a private token for set_name(), since nobody else can read it.

create table if not exists public.results (
  day        date        not null,
  player     uuid        not null,
  name       text        check (name is null or char_length(name) between 1 and 20),
  stars      smallint[]  not null check (array_length(stars, 1) = 3 and 0 <= all (stars) and 3 >= all (stars)),
  total      smallint    not null check (total between 0 and 9),
  elapsed_ms integer     not null check (elapsed_ms between 0 and 86400000),
  created_at timestamptz not null default now(),
  primary key (day, player),
  check (total = stars[1] + stars[2] + stars[3])
);

alter table public.results enable row level security;

-- Players may add a result for today only (± a day for time zones).
-- A perfect round needs at least 10 seconds, to stop the most obvious fakes.
drop policy if exists "add todays result" on public.results;
create policy "add todays result" on public.results
  for insert to anon, authenticated
  with check (
    day between current_date - 1 and current_date + 1
    and (total < 9 or elapsed_ms >= 10000)
  );

revoke all on public.results from anon, authenticated;
grant insert on public.results to anon, authenticated;

-- How everyone did on a given day: number of players, average and a
-- histogram of totals (index 0..9).
create or replace function public.day_summary(d date)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'players', (select count(*) from results where day = d),
    'avg',     (select round(avg(total)::numeric, 1) from results where day = d),
    'perfect', (select count(*) from results where day = d and total = 9),
    'hist',    (select json_agg(c order by g)
                  from (select g, count(r.total) as c
                          from generate_series(0, 9) as g
                          left join results r on r.total = g and r.day = d
                         group by g) h)
  );
$$;

-- Fastest perfect rounds of the day.
create or replace function public.leaderboard(d date)
returns table (name text, elapsed_ms integer)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(name, 'Anonym'), elapsed_ms
    from results
   where day = d and total = 9
   order by elapsed_ms, created_at
   limit 10;
$$;

-- Put a name on your own result (once), e.g. after a perfect round.
create or replace function public.set_name(d date, p uuid, n text)
returns void
language sql
security definer
set search_path = public
as $$
  update results
     set name = left(btrim(n), 20)
   where day = d and player = p and name is null
     and char_length(btrim(n)) between 1 and 20;
$$;

revoke all on function public.day_summary(date) from public;
revoke all on function public.leaderboard(date) from public;
revoke all on function public.set_name(date, uuid, text) from public;
grant execute on function public.day_summary(date) to anon, authenticated;
grant execute on function public.leaderboard(date) to anon, authenticated;
grant execute on function public.set_name(date, uuid, text) to anon, authenticated;
