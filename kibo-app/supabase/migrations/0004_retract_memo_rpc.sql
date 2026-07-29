-- KIBO - fix: retracting a memo was impossible.
--
-- Run the WHOLE file. The Supabase SQL Editor executes only the highlighted
-- text if there is a selection - click into the editor, Ctrl+A, then paste.
--
-- Safe to re-run.
--
-- THE BUG
-- 0001 gave clients `grant update (deleted_at)` plus a "members retract memos"
-- UPDATE policy, intending a soft delete. It always failed with 42501,
-- "new row violates row-level security policy".
--
-- The read policy is:
--     for select using (is_member(room_id) and deleted_at is null)
--
-- Setting deleted_at makes the row invisible to that policy, and PostgREST
-- reads the updated row back, so the write is rejected. Proven by isolating the
-- predicate: `deleted_at = null` succeeds with 204 while a timestamp gives 403,
-- even though the UPDATE policy's WITH CHECK (is_member) never mentions
-- deleted_at. Prefer: return=minimal does not help.
--
-- The general rule: a client UPDATE cannot soft-delete a row when the SELECT
-- policy filters soft-deleted rows out. Either the policy stops hiding them and
-- every read filters explicitly, or the write goes through a definer function.
--
-- THE FIX
-- Keep the read policy hiding retracted memos - that is the behaviour we want,
-- and it means no query can forget to filter. Move the write into a
-- security definer RPC, which is not subject to RLS, and drop the client's
-- direct UPDATE path entirely.

drop policy if exists "members retract memos" on public.memos;
revoke update (deleted_at) on public.memos from authenticated;

create or replace function public.retract_memo(target_memo uuid) returns boolean
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  target_room uuid;
begin
  -- Read the room directly: this function bypasses RLS, so an already-retracted
  -- memo is still visible here and a repeat call is a harmless no-op.
  select m.room_id into target_room from public.memos m where m.id = target_memo;
  if target_room is null then return false; end if;

  -- Either participant may retract either person's memo. For a two-person
  -- space that is the whole moderation story.
  if not public.is_member(target_room) then raise exception 'not_a_member'; end if;

  update public.memos m
     set deleted_at = now()
   where m.id = target_memo
     and m.deleted_at is null;

  return true;
end;
$$;

revoke execute on function public.retract_memo(uuid) from public, anon;
grant execute on function public.retract_memo(uuid) to authenticated;

-- Declared LAST, so a partial run cannot report a version it did not reach.
create or replace function public.kibo_schema_version() returns text
language sql immutable set search_path = pg_catalog as $$
  select '0004'::text;
$$;
grant execute on function public.kibo_schema_version() to authenticated, anon;
