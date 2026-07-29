-- KIBO - Phase 4: phone-off continuity (the nutrient ledger).
--
-- Run the WHOLE file. The Supabase SQL Editor executes only the highlighted
-- text if there is a selection - click into the editor, Ctrl+A, then paste.
--
-- Safe to re-run.
--
-- Clients own exactly one column in this mechanic: room_participants.hidden_since,
-- granted back in 0001. Everything derived from it - when the shared away
-- interval opened, what it was finally worth - is computed here, because a
-- client cannot be trusted to score itself, and because one boolean column on
-- `rooms` cannot represent two people (the second writer would overwrite the
-- first).

create or replace function public.sync_co_away() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  opened timestamptz;
  total int;
  away int;
  credit int;
begin
  -- `after update of hidden_since` fires on any UPDATE whose target list
  -- mentions the column, whether or not the value actually moved. Clients
  -- re-write the same state routinely: a repeated visibilitychange, a mount
  -- that sets null over null, the unload beacon landing behind the ordinary
  -- write. None of those can change the outcome below, so leave before taking
  -- the row lock rather than serialising both participants on the room for a
  -- write that was always going to be a no-op.
  if new.hidden_since is not distinct from old.hidden_since then
    return new;
  end if;

  -- Lock the room BEFORE counting, not after.
  --
  -- Both participants can look away in the same instant, and each trigger runs
  -- inside its own client transaction. Counting first means neither sees the
  -- other's uncommitted hidden_since (READ COMMITTED cannot), so both conclude
  -- someone is still present and the interval never opens. Taking the row lock
  -- first serialises the whole count-then-decide: the waiter re-reads the room
  -- once the lock is released, and its count then runs on a fresh snapshot that
  -- includes the sibling's committed write.
  select r.co_away_since into opened
  from public.rooms r
  where r.id = new.room_id
  for update;

  select count(*), count(rp.hidden_since)
    into total, away
  from public.room_participants rp
  where rp.room_id = new.room_id;

  if away = total and total >= 2 and opened is null then
    -- Everyone has looked away. Open the interval; nothing is banked yet.
    update public.rooms r set co_away_since = now() where r.id = new.room_id;

  elsif away < total and opened is not null then
    -- Someone came back. Bank the shared interval, then close it.
    credit := least(
      greatest(extract(epoch from (now() - opened))::int, 0),
      28800  -- MAX_AWAY_CREDIT_SECONDS, mirrored in lib/constants.ts
    );
    update public.rooms r
       set nutrient_seconds = nutrient_seconds + credit,
           co_away_since = null,
           last_interaction_at = now()
     where r.id = new.room_id;
  end if;

  return new;
end;
$$;

drop trigger if exists room_participants_co_away on public.room_participants;
create trigger room_participants_co_away
after update of hidden_since on public.room_participants
for each row execute function public.sync_co_away();

-- Three properties fall out of the shape above, and each one closes a hole:
--
--   total >= 2         A solo room never accrues. One person cannot farm
--                      nutrients by pocketing their own phone.
--   credit on return   An abandoned room banks nothing permanent, and the
--                      reward reads as being for reunion after rest rather
--                      than for absence itself.
--   least(.., 28800)   One interval is worth at most 8 hours. This is what
--                      makes the tab-close ambiguity survivable: closing the
--                      app and reopening it a week later credits one good
--                      night, not a week.
--
-- greatest(.., 0) is belt-and-braces. Only this function writes co_away_since,
-- always with now(), so a negative interval should be unreachable - but
-- nutrient_seconds has a `>= 0` check constraint, and a clock adjustment must
-- not be able to turn a returning participant's write into a 23514.
--
-- Known bound, deliberately not machinery: if a participant's row is deleted
-- while the interval is open (a departure that never came back to look), the
-- interval stays open until the other person returns, and then banks as one
-- capped interval. Both people really were away for it, so crediting it is
-- defensible, and the cap keeps it small either way.

-- Declared LAST, so a partial run cannot report a version it did not reach.
create or replace function public.kibo_schema_version() returns text
language sql immutable set search_path = pg_catalog as $$
  select '0005'::text;
$$;
grant execute on function public.kibo_schema_version() to authenticated, anon;
