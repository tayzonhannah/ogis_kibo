-- KIBO — join_room fixes. Safe to re-run.
--
-- ⚠️ Run the WHOLE file. The Supabase SQL Editor executes only the highlighted
-- text if there is a selection — click into the editor, Ctrl+A, then paste, so
-- nothing is left selected or stale.
--
-- BUG 1 — the rate limiter was decorative.
-- 0001's join_room() recorded a failed attempt and then signalled failure with
-- RAISE EXCEPTION. In PL/pgSQL a raise aborts the surrounding transaction, and
-- PostgREST runs each RPC call in its own transaction, so the
-- `insert into join_attempts` rolled back with it. The ledger stayed empty,
-- recent_failures was always 0, and code guessing was unthrottled.
--
-- A function that must persist a side effect cannot report failure by raising.
-- join_room now RETURNS a status row, so the insert commits. `not_authenticated`
-- still raises: nothing to persist, no session at all.
--
-- BUG 2 — `column reference "room_id" is ambiguous` (42702).
-- `returns table (status text, room_id uuid)` declares an OUT parameter named
-- room_id, colliding with room_participants.room_id. Qualifying the WHERE
-- clauses was not enough: an INSERT column list cannot be qualified. The output
-- field is therefore `joined_room`, which collides with nothing.
--
-- Lesson: name OUT parameters so they cannot collide with a column of any table
-- the function touches. Aliasing only fixes the references you can alias.

-- Drop every overload by OID, so this cannot be skipped by a signature
-- mismatch or leave an old return type in place (42P13).
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'join_room'
  loop
    execute format('drop function %s', f.sig);
  end loop;
end
$$;

create function public.join_room(room_code text)
returns table (status text, joined_room uuid)
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  caller uuid := auth.uid();
  target uuid;
  occupants int;
  recent_failures int;
begin
  if caller is null then raise exception 'not_authenticated'; end if;

  select count(*) into recent_failures
  from public.join_attempts ja
  where ja.user_id = caller
    and ja.succeeded = false
    and ja.attempted_at > now() - interval '15 minutes';

  if recent_failures >= 10 then
    -- Records no further attempt: a throttled caller must not be able to
    -- extend their own lockout indefinitely.
    return query select 'too_many_attempts'::text, null::uuid;
    return;
  end if;

  select r.id into target from public.rooms r where r.code = upper(trim(room_code));

  if target is null then
    insert into public.join_attempts (user_id, succeeded) values (caller, false);
    return query select 'room_not_found'::text, null::uuid;
    return;
  end if;

  -- Idempotent rejoin: not a new attempt, no capacity check.
  if exists (
    select 1 from public.room_participants rp
    where rp.room_id = target and rp.user_id = caller
  ) then
    update public.room_participants rp set last_seen_at = now()
    where rp.room_id = target and rp.user_id = caller;
    return query select 'ok'::text, target;
    return;
  end if;

  -- Free the slot of anyone silent past the staleness window. This is what
  -- rescues a room whose partner lost their anonymous session.
  delete from public.room_participants rp
  where rp.room_id = target
    and rp.last_seen_at < now() - interval '14 days';

  select count(*) into occupants
  from public.room_participants rp where rp.room_id = target;

  if occupants >= 2 then
    insert into public.join_attempts (user_id, succeeded) values (caller, false);
    return query select 'room_full'::text, null::uuid;
    return;
  end if;

  insert into public.room_participants (room_id, user_id) values (target, caller);
  insert into public.join_attempts (user_id, succeeded) values (caller, true);
  update public.rooms r set last_interaction_at = now() where r.id = target;
  return query select 'ok'::text, target;
end;
$$;

-- Grants do not survive DROP FUNCTION.
revoke execute on function public.join_room(text) from public, anon;
grant execute on function public.join_room(text) to authenticated;

-- Declared LAST, so a partial run cannot report a version it did not reach.
-- Lets a client confirm what is live instead of inferring it from behaviour.
create or replace function public.kibo_schema_version() returns text
language sql immutable set search_path = pg_catalog as $$
  select '0002c'::text;
$$;
grant execute on function public.kibo_schema_version() to authenticated, anon;
