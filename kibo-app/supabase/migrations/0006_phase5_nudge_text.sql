-- KIBO - Phase 5: somewhere for a nudge to land.
--
-- Run the WHOLE file. The Supabase SQL Editor executes only the highlighted
-- text if there is a selection - click into the editor, Ctrl+A, then paste.
--
-- Safe to re-run.
--
-- `rooms` already carried last_nudged_at from 0001, but a timestamp is not a
-- notification. Push is deferred (see Agent.md Phase 5), so the fallback is an
-- in-app banner on next open - which needs the sentence itself to survive the
-- request that generated it. One column, written by one caller.

alter table public.rooms add column if not exists nudge_text text
  check (nudge_text is null or char_length(nudge_text) <= 200);

-- No `grant update (nudge_text)`. This is the whole security model of the
-- feature, so it is worth stating rather than leaving as an absence:
--
--   * last_nudged_at has no client grant either (0001), so the idempotency
--     ledger cannot be cleared by the party that benefits from clearing it.
--     Without that, one client could re-arm the cron job at will and turn a
--     once-per-3-days job into an unbounded spend on someone else's key.
--   * nudge_text is rendered to the OTHER participant. A client that can write
--     it can put arbitrary text on a screen it does not own, over a channel the
--     reader has been taught to trust.
--
-- Both columns are therefore service-role only, written by app/api/nudge.
-- `grant select on public.rooms` in 0001 is whole-row, so reading needs nothing
-- new; the banner is a plain read of a column the client cannot forge.
--
-- The length check is a spend guard as much as a data one: the route caps the
-- model's output tokens, and this is the second wall behind that cap. 200 leaves
-- room for one sentence and refuses a paragraph.

-- Dismissal deliberately has no column.
--
-- "Seen" is per-device, not per-room: two participants share the row and would
-- otherwise clear each other's banner, and the obvious fix - a per-participant
-- seen_nudge_at with an update grant - hands back the write this migration just
-- withheld. The client instead remembers the last_nudged_at it has already shown
-- in localStorage. Clearing browser storage re-shows one nudge, which is a
-- better failure than a forgeable one.

-- ------------------------------------------------- love_language, constrained ---
-- 0001 created this as bare `text` with a client update grant, because nothing
-- read it. Phase 5 reads it, and it is now the one client-writable value that
-- reaches a language model and comes back out on the other participant's screen.
-- Bare text there is a prompt-injection channel between two people who are only
-- supposed to be exchanging fish: set your love language to a paragraph of
-- instructions and the nudge is yours to write.
--
-- The route also validates against the same allowlist before building the prompt
-- - defence in depth, since a constraint added later cannot retroactively clean
-- rows written before it - but the constraint is what makes the vocabulary a
-- fact about the schema rather than a convention in the client.
--
-- Mirrored in lib/constants.ts as LOVE_LANGUAGES; change both together, exactly
-- like tank_mood.
alter table public.room_participants
  drop constraint if exists room_participants_love_language_check;
alter table public.room_participants
  add constraint room_participants_love_language_check
  check (love_language is null or love_language in
    ('words', 'time', 'touch', 'acts', 'symbols'));

-- Plain btree, deliberately not partial. The selective half of the nudge query
-- is `last_interaction_at < now() - interval '3 days'`; the last_nudged_at half
-- cannot go in an index predicate, because a partial index is only used when the
-- query provably implies its predicate and every useful form of that condition
-- is written against now(), which is not immutable. This same index also serves
-- the 30-day sweep in delete_stale_rooms() from 0001.
create index if not exists rooms_last_interaction_idx
  on public.rooms (last_interaction_at);

-- Declared LAST, so a partial run cannot report a version it did not reach.
create or replace function public.kibo_schema_version() returns text
language sql immutable set search_path = pg_catalog as $$
  select '0006'::text;
$$;
grant execute on function public.kibo_schema_version() to authenticated, anon;
