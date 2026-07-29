-- KIBO - Phase 3 support: memo rate limiting, plus one hardening fix.
--
-- Run the WHOLE file. The Supabase SQL Editor executes only the highlighted
-- text if there is a selection - click into the editor, Ctrl+A, then paste.
--
-- Safe to re-run.

-- ------------------------------------------------------- memo rate limiting ---
-- The insert policy authorises WHO may write a memo, not HOW OFTEN. Without
-- this, either participant can flood the canvas.
--
-- Raising here is correct, unlike in join_room: the thing being aborted IS the
-- insert, so there is no separate ledger write to lose to the rollback.

create or replace function public.enforce_memo_rate_limit() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
declare
  recent int;
begin
  select count(*) into recent
  from public.memos m
  where m.author = new.author
    and m.created_at > now() - interval '1 minute';

  if recent >= 10 then
    raise exception 'memo_rate_limited';
  end if;

  return new;
end;
$$;

drop trigger if exists memos_rate_limit on public.memos;
create trigger memos_rate_limit
before insert on public.memos
for each row execute function public.enforce_memo_rate_limit();

-- --------------------------------------------------------------- hardening ---
-- join_room could raise a unique-violation if the same user's join raced with
-- itself (double click, a retry, StrictMode in some configurations). The
-- participant row is the thing being guarded, so a conflict is not an error:
-- someone already joined, which is exactly the outcome we wanted.
--
-- Signature is unchanged from 0002, so CREATE OR REPLACE is fine here.

create or replace function public.join_room(room_code text)
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
    return query select 'too_many_attempts'::text, null::uuid;
    return;
  end if;

  select r.id into target from public.rooms r where r.code = upper(trim(room_code));

  if target is null then
    insert into public.join_attempts (user_id, succeeded) values (caller, false);
    return query select 'room_not_found'::text, null::uuid;
    return;
  end if;

  if exists (
    select 1 from public.room_participants rp
    where rp.room_id = target and rp.user_id = caller
  ) then
    update public.room_participants rp set last_seen_at = now()
    where rp.room_id = target and rp.user_id = caller;
    return query select 'ok'::text, target;
    return;
  end if;

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

  insert into public.room_participants (room_id, user_id) values (target, caller)
  on conflict (room_id, user_id) do nothing;
  insert into public.join_attempts (user_id, succeeded) values (caller, true);
  update public.rooms r set last_interaction_at = now() where r.id = target;
  return query select 'ok'::text, target;
end;
$$;

revoke execute on function public.join_room(text) from public, anon;
grant execute on function public.join_room(text) to authenticated;

-- Declared LAST, so a partial run cannot report a version it did not reach.
create or replace function public.kibo_schema_version() returns text
language sql immutable set search_path = pg_catalog as $$
  select '0003'::text;
$$;
grant execute on function public.kibo_schema_version() to authenticated, anon;
