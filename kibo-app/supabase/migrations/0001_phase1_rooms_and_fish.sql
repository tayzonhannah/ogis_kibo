-- KIBO — Phase 1: schema, privileges, policies, room lifecycle RPCs, cleanup.
--
-- Run this in the Supabase SQL editor (or via `supabase db push`) BEFORE
-- starting the app. Also enable "Anonymous sign-ins" under
-- Authentication -> Providers, and enable the pg_cron extension for the
-- cleanup job at the bottom.
--
-- Tuning knobs (see Agent.md):
--   ROOM_CAPACITY            2
--   CODE_LENGTH / alphabet   8 chars / 32 symbols (no I, O, 0, 1)
--   JOIN_ATTEMPT_LIMIT       10 failures per 15 minutes
--   STALE_PARTICIPANT_DAYS   14
--   MAX_AWAY_CREDIT_SECONDS  28800  (used in Phase 4)
--   MEMO_MAX_LEN             140
--   ROOM_IDLE_EXPIRY_DAYS    30

-- ---------------------------------------------------------------- tables ---

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  created_at timestamptz not null default now(),
  tank_mood text not null default 'calm'
    check (tank_mood in ('calm', 'deep', 'bright', 'murky', 'warm')),
  nutrient_seconds integer not null default 0 check (nutrient_seconds >= 0),
  co_away_since timestamptz,
  last_interaction_at timestamptz not null default now(),
  last_nudged_at timestamptz
);

create table if not exists public.room_participants (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- null = present/looking, timestamp = when they looked away
  hidden_since timestamptz,
  love_language text,
  primary key (room_id, user_id)
);

create table if not exists public.fish (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  holder uuid references auth.users(id) on delete set null,
  y_frac real not null check (y_frac between 0 and 1),
  speed_px_s real not null check (speed_px_s > 0),
  direction smallint not null default 1 check (direction in (1, -1)),
  color text not null,
  updated_at timestamptz not null default now()
);
create index if not exists fish_room_holder_idx on public.fish (room_id, holder);

create table if not exists public.memos (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  author uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 140),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists memos_room_idx on public.memos (room_id, created_at desc);

-- Rate-limit ledger. No client grants; only reachable via join_room().
create table if not exists public.join_attempts (
  id bigserial primary key,
  user_id uuid not null,
  attempted_at timestamptz not null default now(),
  succeeded boolean not null
);
create index if not exists join_attempts_user_idx
  on public.join_attempts (user_id, attempted_at desc);

-- Clients are granted update on (holder, direction, y_frac) only, so
-- updated_at is maintained here rather than by the client.
create or replace function public.touch_fish_updated_at() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists fish_touch_updated_at on public.fish;
create trigger fish_touch_updated_at
before update on public.fish
for each row execute function public.touch_fish_updated_at();

-- ------------------------------------------------------------ privileges ---
-- RLS decides WHICH ROWS you can touch. Column privileges decide WHICH
-- COLUMNS. Both are needed: a policy alone would let a legitimate room
-- member set nutrient_seconds to a million, because they really do have
-- access to that row.

alter table public.rooms enable row level security;
alter table public.room_participants enable row level security;
alter table public.fish enable row level security;
alter table public.memos enable row level security;
alter table public.join_attempts enable row level security;

revoke all on public.rooms, public.room_participants, public.fish,
  public.memos, public.join_attempts from anon, authenticated;

grant select on public.rooms, public.room_participants, public.fish,
  public.memos to authenticated;

-- Clients may set the mood. They may NOT touch nutrient_seconds,
-- co_away_since, last_interaction_at, code, or last_nudged_at.
grant update (tank_mood) on public.rooms to authenticated;

grant update (hidden_since, last_seen_at, love_language)
  on public.room_participants to authenticated;

grant update (holder, direction, y_frac) on public.fish to authenticated;

grant insert on public.memos to authenticated;
grant update (deleted_at) on public.memos to authenticated;

-- ---------------------------------------------------------- policy helpers ---
-- security definer, so these bypass RLS and do not recurse when used inside
-- a policy on room_participants itself. This is the standard fix for
-- "infinite recursion detected in policy for relation room_participants".

create or replace function public.is_member(target_room uuid) returns boolean
language sql security definer stable set search_path = pg_catalog, public as $$
  select exists (
    select 1 from public.room_participants
    where room_id = target_room and user_id = auth.uid()
  );
$$;

create or replace function public.is_member_of(target_room uuid, target_user uuid)
returns boolean
language sql security definer stable set search_path = pg_catalog, public as $$
  select exists (
    select 1 from public.room_participants
    where room_id = target_room and user_id = target_user
  );
$$;

revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.is_member_of(uuid, uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_member_of(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------- policies ---
-- No INSERT policies on rooms / room_participants / fish: all creation goes
-- through the security definer RPCs below, so the capacity cap and the rate
-- limit cannot be bypassed by writing to the table directly.

drop policy if exists "members read room" on public.rooms;
create policy "members read room" on public.rooms
  for select using (public.is_member(id));

drop policy if exists "members set mood" on public.rooms;
create policy "members set mood" on public.rooms
  for update using (public.is_member(id)) with check (public.is_member(id));

drop policy if exists "members read participants" on public.room_participants;
create policy "members read participants" on public.room_participants
  for select using (public.is_member(room_id));

drop policy if exists "self update participant" on public.room_participants;
create policy "self update participant" on public.room_participants
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "members read fish" on public.fish;
create policy "members read fish" on public.fish
  for select using (public.is_member(room_id));

-- A member can hand a fish to a room-mate or release it, but cannot assign
-- it to a stranger.
drop policy if exists "members move fish" on public.fish;
create policy "members move fish" on public.fish
  for update using (public.is_member(room_id))
  with check (
    public.is_member(room_id)
    and (holder is null or public.is_member_of(room_id, holder))
  );

drop policy if exists "members read memos" on public.memos;
create policy "members read memos" on public.memos
  for select using (public.is_member(room_id) and deleted_at is null);

drop policy if exists "members write memos" on public.memos;
create policy "members write memos" on public.memos
  for insert with check (public.is_member(room_id) and author = auth.uid());

-- Either participant can retract any memo in their room. For a two-person
-- space this is the proportionate moderation path — no report queue needed.
drop policy if exists "members retract memos" on public.memos;
create policy "members retract memos" on public.memos
  for update using (public.is_member(room_id)) with check (public.is_member(room_id));

-- ------------------------------------------------------ room lifecycle RPCs ---
-- There is deliberately no select policy keyed on `code`: a client cannot look
-- a room up by code, which would make codes enumerable.

create or replace function public.create_room() returns text
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  caller uuid := auth.uid();
  new_code text;
  new_id uuid;
  tries int := 0;
begin
  if caller is null then raise exception 'not_authenticated'; end if;

  loop
    -- 8 chars from a 32-symbol alphabet with I, O, 0 and 1 removed, so a
    -- code survives being read aloud. 32^8 ~= 1.1e12.
    new_code := (
      select string_agg(
        substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
               1 + floor(random() * 32)::int, 1), '')
      from generate_series(1, 8)
    );
    exit when not exists (select 1 from public.rooms where code = new_code);
    tries := tries + 1;
    if tries > 10 then raise exception 'code_generation_failed'; end if;
  end loop;

  insert into public.rooms (code) values (new_code) returning id into new_id;
  insert into public.room_participants (room_id, user_id) values (new_id, caller);
  insert into public.fish (room_id, holder, y_frac, speed_px_s, direction, color)
  values
    (new_id, caller, 0.42, 52, 1, '#F5B041'),
    (new_id, caller, 0.63, 38, 1, '#7FB3D5');

  return new_code;
end;
$$;

create or replace function public.join_room(room_code text) returns uuid
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  caller uuid := auth.uid();
  target uuid;
  occupants int;
  recent_failures int;
begin
  if caller is null then raise exception 'not_authenticated'; end if;

  select count(*) into recent_failures
  from public.join_attempts
  where user_id = caller
    and succeeded = false
    and attempted_at > now() - interval '15 minutes';
  if recent_failures >= 10 then raise exception 'too_many_attempts'; end if;

  select id into target from public.rooms where code = upper(trim(room_code));

  if target is null then
    insert into public.join_attempts (user_id, succeeded) values (caller, false);
    raise exception 'room_not_found';
  end if;

  -- Idempotent rejoin: not a new attempt, no capacity check.
  if exists (
    select 1 from public.room_participants
    where room_id = target and user_id = caller
  ) then
    update public.room_participants set last_seen_at = now()
    where room_id = target and user_id = caller;
    return target;
  end if;

  -- Free the slot of anyone silent past the staleness window. This is what
  -- rescues a room whose partner lost their anonymous session.
  delete from public.room_participants
  where room_id = target
    and last_seen_at < now() - interval '14 days';

  select count(*) into occupants
  from public.room_participants where room_id = target;
  if occupants >= 2 then
    insert into public.join_attempts (user_id, succeeded) values (caller, false);
    raise exception 'room_full';
  end if;

  insert into public.room_participants (room_id, user_id) values (target, caller);
  insert into public.join_attempts (user_id, succeeded) values (caller, true);
  update public.rooms set last_interaction_at = now() where id = target;
  return target;
end;
$$;

create or replace function public.leave_room(target_room uuid) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  delete from public.room_participants
  where room_id = target_room and user_id = auth.uid();
  -- Release rather than delete: the remaining participant reclaims them.
  update public.fish set holder = null
  where room_id = target_room and holder = auth.uid();
end;
$$;

-- Clients cannot write last_interaction_at directly (no column grant), so
-- ephemeral gestures bump it through here. This also prevents a client from
-- setting a future timestamp to suppress nudges.
create or replace function public.touch_room(target_room uuid) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not public.is_member(target_room) then raise exception 'not_a_member'; end if;
  update public.rooms set last_interaction_at = now() where id = target_room;
end;
$$;

revoke execute on function public.create_room() from public, anon;
revoke execute on function public.join_room(text) from public, anon;
revoke execute on function public.leave_room(uuid) from public, anon;
revoke execute on function public.touch_room(uuid) from public, anon;
grant execute on function public.create_room() to authenticated;
grant execute on function public.join_room(text) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;
grant execute on function public.touch_room(uuid) to authenticated;

-- ---------------------------------------------------------------- realtime ---
-- Without this, postgres_changes never fires and the handoff safety net is
-- silently dead. RLS still applies to realtime, so each client only receives
-- changes for rooms it belongs to.

do $$
begin
  begin
    alter publication supabase_realtime add table public.fish;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.rooms;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.memos;
  exception when duplicate_object then null;
  end;
end
$$;

-- ----------------------------------------------------------------- cleanup ---
-- Requires the pg_cron extension (Database -> Extensions -> pg_cron).
-- Room deletion cascades to participants, fish, and memos. Without this,
-- nothing in the system ever deletes anything.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('kibo-cleanup')
    where exists (select 1 from cron.job where jobname = 'kibo-cleanup');

    perform cron.schedule('kibo-cleanup', '0 4 * * *', $job$
      delete from public.rooms
        where last_interaction_at < now() - interval '30 days';
      delete from public.join_attempts
        where attempted_at < now() - interval '1 day';
      delete from public.memos
        where deleted_at is not null and deleted_at < now() - interval '7 days';
    $job$);
  else
    raise notice 'pg_cron not installed — skipping kibo-cleanup schedule.';
  end if;
end
$$;
