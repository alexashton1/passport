-- Passport: daily scoreboard + optional accounts. Run once in Supabase → SQL Editor. Safe to re-run.
-- Stores only: puzzle number, a random anonymous player id and the day's score; for accounts, the player's own save.

-- ───────────── Daily scoreboard ─────────────
create table if not exists public.passport_plays (
  day     int      not null check (day > 0 and day < 100000),
  player  uuid     not null,
  score   smallint not null check (score between 0 and 1000),
  created_at timestamptz not null default now(),
  primary key (day, player)
);
alter table public.passport_plays enable row level security;
drop policy if exists "anyone can submit" on public.passport_plays;
create policy "anyone can submit" on public.passport_plays for insert to anon, authenticated with check (true);
-- Nobody reads rows directly: only the aggregate below.
create or replace function public.passport_rank(d int, s int)
returns table (total bigint, below bigint)
language sql stable security definer set search_path = public as $$
  select count(*)::bigint, count(*) filter (where score < s)::bigint from public.passport_plays where day = d;
$$;
grant execute on function public.passport_rank(int, int) to anon, authenticated;

-- ───────────── Optional accounts ─────────────
create table if not exists public.passport_saves (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb check (pg_column_size(data) < 400000),
  updated_at timestamptz not null default now()
);
alter table public.passport_saves enable row level security;
drop policy if exists "read own" on public.passport_saves;
drop policy if exists "create own" on public.passport_saves;
drop policy if exists "update own" on public.passport_saves;
create policy "read own"   on public.passport_saves for select to authenticated using (user_id = auth.uid());
create policy "create own" on public.passport_saves for insert to authenticated with check (user_id = auth.uid());
create policy "update own" on public.passport_saves for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.passport_saves to authenticated;

create or replace function public.delete_my_passport()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.passport_saves where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_passport() from public;
revoke all on function public.delete_my_passport() from anon;
grant execute on function public.delete_my_passport() to authenticated;

-- ───────────── Private leagues ─────────────
create table if not exists public.passport_leagues (
  code text primary key check (code ~ '^[A-Z2-9]{6}$'),
  name text not null check (char_length(name) between 1 and 30),
  created_at timestamptz not null default now()
);
create table if not exists public.passport_league_members (
  code   text not null references public.passport_leagues(code) on delete cascade,
  player uuid not null,
  name   text not null check (char_length(name) between 1 and 20),
  joined_at timestamptz not null default now(),
  primary key (code, player)
);
-- No policies: only reachable through the functions below.
alter table public.passport_leagues enable row level security;
alter table public.passport_league_members enable row level security;

create or replace function public.passport_create_league(n text, p uuid, pn text)
returns text language plpgsql security definer set search_path = public as $$
declare c text; tries int := 0;
begin
  if char_length(trim(n)) < 1 or char_length(trim(pn)) < 1 then raise exception 'name required'; end if;
  if (select count(*) from passport_league_members where player = p) >= 10 then raise exception 'too many leagues'; end if;
  loop
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') into c from generate_series(1, 6);
    exit when not exists (select 1 from passport_leagues where code = c);
    tries := tries + 1; if tries > 20 then raise exception 'could not allocate a code'; end if;
  end loop;
  insert into passport_leagues (code, name) values (c, left(trim(n), 30));
  insert into passport_league_members (code, player, name) values (c, p, left(trim(pn), 20));
  return c;
end $$;

create or replace function public.passport_join_league(c text, p uuid, pn text)
returns text language plpgsql security definer set search_path = public as $$
declare ln text; cc text := upper(trim(c));
begin
  if char_length(trim(pn)) < 1 then raise exception 'name required'; end if;
  select name into ln from passport_leagues where code = cc;
  if ln is null then return null; end if;
  if not exists (select 1 from passport_league_members where code = cc and player = p)
     and (select count(*) from passport_league_members where code = cc) >= 100 then raise exception 'league full'; end if;
  insert into passport_league_members (code, player, name) values (cc, p, left(trim(pn), 20))
    on conflict (code, player) do update set name = excluded.name;
  return ln;
end $$;

create or replace function public.passport_leave_league(c text, p uuid)
returns void language sql security definer set search_path = public as $$
  delete from passport_league_members where code = upper(trim(c)) and player = p;
$$;

-- Members' daily scores between d0 and d1. Only members can read it; player ids are never returned.
create or replace function public.passport_league_board(c text, me uuid, d0 int, d1 int)
returns table (league text, k text, member text, is_me boolean, day int, score smallint)
language sql stable security definer set search_path = public as $$
  select l.name, left(md5(m.player::text || l.code), 10), m.name, m.player = me, p.day, p.score
  from passport_leagues l
  join passport_league_members m on m.code = l.code
  left join passport_plays p on p.player = m.player and p.day between d0 and d1
  where l.code = upper(trim(c))
    and exists (select 1 from passport_league_members x where x.code = l.code and x.player = me);
$$;

grant execute on function public.passport_create_league(text, uuid, text) to anon, authenticated;
grant execute on function public.passport_join_league(text, uuid, text) to anon, authenticated;
grant execute on function public.passport_leave_league(text, uuid) to anon, authenticated;
grant execute on function public.passport_league_board(text, uuid, int, int) to anon, authenticated;
