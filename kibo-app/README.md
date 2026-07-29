# KIBO — app

Shared aquarium for two. See [`../Agent.md`](../Agent.md) for the design, the
locked decisions, and the per-phase verification checklists.

**Implemented:** Phase 0 (setup), Phase 1 (schema, RLS, room join), Phase 2
(canvas + fish handoff), Phase 3 (warmth, mood, memos). Phases 4–5 are specced
in `Agent.md` but not built.

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication → Providers → Anonymous sign-ins: enable.** Without this,
   every page shows a sign-in error.
3. **Database → Extensions → enable `pg_cron`** (optional; without it the
   nightly cleanup job is skipped with a notice instead of failing).
4. **SQL Editor →** paste and run
   [`supabase/migrations/0001_phase1_rooms_and_fish.sql`](supabase/migrations/0001_phase1_rooms_and_fish.sql).

The migration is idempotent — re-running it is safe.

### 2. Environment

```bash
cp .env.local.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from
**Project Settings → API**. `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, and
`CRON_SECRET` are only needed for Phase 5 — the app runs without them.

When deploying, set the same variables in **Vercel → Project Settings →
Environment Variables**. `.env.local` is git-ignored and never reaches Vercel.

Never prefix the service-role key with `NEXT_PUBLIC_`. It bypasses every RLS
policy in the schema.

### 3. Run

```bash
npm run dev
```

Open two browser profiles (or one normal + one incognito — *not* two tabs of
the same profile, which share one anonymous identity and therefore one room
slot). Create a tank in the first, copy the code, join from the second.

## Verifying Phase 1

```powershell
.\scripts\verify-phase1.ps1
```

38 checks against your live project over plain REST — no browser needed. It signs in several throwaway anonymous users and exercises the room RPCs the way a client would: capacity cap, code enumeration, score forgery, fish theft, the join rate limiter, `leave_room` releasing fish. Reads its config from `.env.local`.

It checks `kibo_schema_version()` first and stops if the expected migration isn't live. That gate exists because three rounds of debugging were lost to testing a function that wasn't the one deployed — the Supabase SQL Editor runs **only the highlighted text** when there's a selection, so a stale run looks like a successful one.

Each run leaves ~5 anonymous users and 2 rooms behind. Clear them under Authentication → Users if you like.

> Keep this script ASCII-only. PowerShell 5.1 reads a UTF-8-no-BOM `.ps1` as cp1252, where an em dash's trailing byte `0x94` becomes a smart closing quote and silently terminates a string literal.

## Verifying the tank end to end

```bash
npm run dev          # in one terminal
node scripts/e2e-handoff.mjs
```

23 checks driving two real browser contexts (separate storage, so two genuine
anonymous identities and two room slots). Covers the fish handoff in both
directions, the "exactly 2 fish across both screens" invariant, orphan reclaim,
solo reflection, reload recovery, and the Phase 3 layer: warmth and memos
crossing to the other client, tapping a memo to send a heart back, and mood
propagating *and* surviving a reload.

The warmth glow, memo bubbles and hearts are drawn straight to canvas, so the
canvas publishes `data-kibo-fx` ("corals:bubbles:hearts") and `data-kibo-bubble`
(the topmost bubble's hit box) for the suite to read. Bubbles drift, so without
the hit box a click is aiming at a moving target.

## Verifying the handoff

The Phase 2 acceptance tests are listed in `Agent.md`. The two that catch the
most:

- **Broadcast-drop resilience** — comment out the `FISH_CROSS` handler in
  [`components/Aquarium.tsx`](components/Aquarium.tsx). Fish should still cross,
  just ~150ms slower, via `postgres_changes`. If they stop crossing entirely,
  the realtime publication in the migration didn't apply.
- **Solo** — close the second profile. Fish should reflect off the right edge
  rather than vanishing.

## Layout

```
app/
  page.tsx                 landing: create or join a tank
  room/[code]/page.tsx     server component; awaits params, hands off to client
components/
  AuthProvider.tsx         anonymous sign-in, once per tab
  RoomClient.tsx           join_room, heartbeat, overlay chrome
  Aquarium.tsx             canvas, presence, two-phase handoff, recovery
lib/
  constants.ts             tuning knobs mirrored from the SQL
  types.ts                 row types + typed RPC errors
  useHeartbeat.ts          last_seen_at while visible
  supabase/client.ts       browser client (cached per tab)
  supabase/admin.ts        service-role client, `server-only`
supabase/migrations/       schema, grants, policies, RPCs, cleanup
```

## Known limitations

- **Broadcast and presence channels are not RLS-protected.** Row access is
  locked down, but the Realtime channel is named `room:<uuid>`, and anyone who
  knows that UUID could subscribe to its broadcasts. Getting the UUID requires
  already being a member (there is no code→id lookup for clients), so this is
  defence-in-depth rather than an open door. The fix is Supabase Realtime
  Authorization with policies on `realtime.messages`.
- **`npm audit` reports high-severity advisories** in `minimatch`/`brace-expansion`
  (via eslint) and `postcss`/`sharp` (via next). All are dev/build tooling with
  no app-code exposure.
- Two tabs in the same browser profile share one anonymous user, so they act as
  one participant. Use separate profiles to test handoff.
