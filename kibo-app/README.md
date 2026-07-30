# KIBO — app

Shared aquarium for two. See [`../Agent.md`](../Agent.md) for the design, the
locked decisions, and the per-phase verification checklists.

**Implemented:** Phase 0 (setup), Phase 1 (schema, RLS, room join), Phase 2
(canvas + fish handoff), Phase 3 (warmth, mood, memos), Phase 4 (phone-off
continuity). Phase 5 is specced in `Agent.md` but not built.

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication → Providers → Anonymous sign-ins: enable.** Without this,
   every page shows a sign-in error.
3. **Database → Extensions → enable `pg_cron`** (optional; without it the
   nightly cleanup job is skipped with a notice instead of failing).
4. **SQL Editor →** paste and run every file in
   [`supabase/migrations/`](supabase/migrations/) **in order**, `0001` through
   `0006`.

Each migration is idempotent — re-running one is safe. Run the *whole* file:
the SQL Editor executes only the highlighted text when there's a selection, so
click into the editor and Ctrl+A before pasting. `kibo_schema_version()` is
declared last in each file, so it can never report a migration that only partly
applied — the verification scripts check it before anything else.

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

## Verifying Phase 4

```powershell
.\scripts\verify-phase4.ps1
```

Phase 4 is almost entirely server-side semantics, so it is verified over REST
rather than in a browser: one participant away is not enough to open the shared
interval, nothing is banked until someone comes back, a repeated `hidden_since`
write is a no-op, a switching burst cannot bank more than it lasted, a solo tank
never accrues, and neither the ledger nor the other person's away state is
client-writable.

37 checks, all green. The 8-hour cap check needs `SUPABASE_SERVICE_ROLE_KEY` in
`.env.local` to backdate `co_away_since` — no client may write that column, which
is the whole point of it. Without the key that one section skips and says so.

Two things about that key, both of which cost a debugging round:

- **Send it as `apikey` only, never as a bearer.** A new-format secret
  (`sb_secret_…`) is not a JWT, so `Authorization: Bearer sb_secret_…` earns
  PGRST301 "Expected 3 parts in JWT". The gateway resolves the role from `apikey`
  for both the new and legacy formats.
- **Identify as a CLI.** Supabase refuses a secret key on any request that looks
  browser-borne, and `Invoke-WebRequest`'s default User-Agent contains "Mozilla" —
  so a perfectly valid key fails with 401 "Forbidden use of secret API key in
  browser". The script sets `User-Agent: kibo-verify/1.0`.

Both `verify-*.ps1` scripts parse `.env.local` the way dotenv does — leading
whitespace, an `export` prefix, quoted values — because a key indented by one
space is still a key, and an anchored `^NAME=` reports it as absent while it sits
there in the file.

Not covered: two participants hiding in the same instant. Every request the
script makes is sequential, so it cannot reproduce the race that
`sync_co_away()` takes the room lock before counting to survive.

## Verifying Phase 5

```powershell
npm run dev                    # in one terminal
.\scripts\verify-phase5.ps1    # or -AppUrl http://localhost:3001
```

Two halves with different requirements, and the script says which it skipped.

Sections 1–2 are pure Postgres and need only `.env.local`: a participant may set
their own `love_language` and it is **read back** to prove the write landed,
neither participant can rewrite the other's, an off-vocabulary value is refused by
the 0006 check constraint, and neither `nudge_text` nor `last_nudged_at` is
client-writable.

Sections 3–6 drive `/api/nudge`, so they additionally need the app running, plus
`SUPABASE_SERVICE_ROLE_KEY` (to backdate `last_interaction_at` — no client may
write it), `CRON_SECRET`, and a working `GEMINI_API_KEY`. They cover 401 on a
missing, wrong, and malformed `Authorization` header; a quiet two-person tank
getting exactly one nudge; an *active* tank and a *solo* quiet tank getting none;
a tank where neither person answered the picker still producing a sentence; and a
second run in a row changing nothing.

**Sections 4–6 spend real money** — one Gemini call per room nudged. The script
creates a small fixed number of rooms rather than looping, which is also why the
route caps its batch at `NUDGE_BATCH_LIMIT` and logs what it deferred.

Not covered here, because it is a deploy and a Lighthouse run rather than a REST
script: that Vercel actually sends the Bearer header on schedule, that a Hobby
deployment accepts the cron expression (it rejects anything more frequent than
daily at deploy time), and that the app installs and launches standalone.

## Verifying the tank end to end

```bash
npm run dev          # in one terminal
node scripts/e2e-handoff.mjs
```

42 checks driving two real browser contexts (separate storage, so two genuine
anonymous identities and two room slots). Covers the fish handoff in both
directions, the "exactly 2 fish across both screens" invariant, orphan reclaim,
solo reflection, reload recovery, the Phase 3 layer (warmth and memos crossing to
the other client, tapping a memo to send a heart back, holding one to retract it,
mood propagating *and* surviving a reload), and the Phase 4 client wiring — both
clients looking away, then the credit arriving back on one screen through its own
re-read and on the other through realtime.

**It also reads the database back**, not just the DOM. It lifts the session token
out of the page's cookies (`@supabase/ssr` stores it there, not in localStorage)
and queries PostgREST read-only as that participant, so RLS still applies and a
check can only assert on rows the client may genuinely see. That capability
exists because DOM-only assertions are structurally blind to a write with no
visible effect — which is how three dead writes survived two phases. The checks
that need it: the heartbeat advancing `last_seen_at`, warmth bumping
`last_interaction_at` through `touch_room()`, the nutrient credit landing
server-side, the retracted memo really being gone, and the unload beacon.

Two Playwright details worth knowing before editing it:

- **`page.close()`, not `context.close()`, to test the unload beacon.** Closing
  the context tears down its network stack with the page, so a `keepalive` fetch
  has nowhere to complete and the beacon looks broken when it isn't. Closing the
  page leaves the context alive to finish the request, and is the more faithful
  model of someone closing one tab anyway.
- **Headless Chromium keeps every page visible** and `document.hidden` is not
  settable, so the Phase 4 section overrides the property and dispatches
  `visibilitychange` by hand. That exercises everything from `useCoAway`'s
  listener inward; when the browser decides a tab is hidden is not ours to test.

The warmth glow, memo bubbles and hearts are drawn straight to canvas, so the
canvas publishes `data-kibo-fx` ("corals:bubbles:hearts") and `data-kibo-bubble`
(the topmost bubble's hit box) for the suite to read. Bubbles drift, so without
the hit box a click is aiming at a moving target. The nutrient meter publishes
`data-kibo-nutrients` for the same reason: the visible string is deliberately
coarse ("4h 12m"), which is no way to assert on a count of seconds.

Headless Chromium keeps every page visible and `document.hidden` is not
settable, so the Phase 4 section overrides the property and dispatches
`visibilitychange` by hand. That exercises everything from `useCoAway`'s listener
inward; when the browser decides a tab is hidden is not ours to test.

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
  offline/page.tsx          precached fallback; served only when truly offline
  manifest.ts               PWA manifest (installability)
  api/nudge/route.ts        the cron-driven AI listener; service-role only
components/
  AuthProvider.tsx         anonymous sign-in, once per tab
  RoomClient.tsx           join_room, heartbeat, overlay chrome
  Aquarium.tsx             canvas, presence, two-phase handoff, recovery
  TankControls.tsx         warmth, mood, memo input
  NutrientMeter.tsx        rest earned while nobody was watching
  LoveLanguagePicker.tsx   asked once; the only input the nudge job reads
  NudgeBanner.tsx          the nudge, delivered on next open
  ServiceWorker.tsx        registers /sw.js in production only
lib/
  constants.ts             tuning knobs mirrored from the SQL
  types.ts                 row types + typed RPC errors
  useHeartbeat.ts          last_seen_at while visible
  useCoAway.ts             hidden_since on visibilitychange, beacon on unload
  nutrients.ts             the open interval, rendered but never written
  nudge.ts                 prompt + output sanitation, pure and key-free
  supabase/client.ts       browser client (cached per tab)
  supabase/admin.ts        service-role client, `server-only`
  supabase/fire.ts         fire-and-forget writes that actually get sent
public/
  sw.js                    installability + honest offline; caches no tank state
  icons/                   generated by scripts/gen-icons.mjs; committed
supabase/migrations/       schema, grants, policies, RPCs, cleanup
```

Icons are generated, not hand-maintained:

```bash
node scripts/gen-icons.mjs
```

Commit the PNGs it writes. It renders one SVG source at 192/512/512-maskable/180
via `sharp` (which arrives with Next), so a deploy never depends on running it.

## The one trap worth knowing before you edit

**Never `void` a supabase-js query or RPC builder.** They are lazy thenables —
the request is issued when something awaits them, not when the chain is built:

```ts
void supabase.from('t').update({ x: 1 }).eq('id', id);   // sends NOTHING
```

No request, no error, no console output. This silently killed three writes across
two phases (the heartbeat, `touch_room`, and the phone-off report) before Phase 4
happened to build a UI that renders one of them. Use
[`lib/supabase/fire.ts`](lib/supabase/fire.ts) for fire-and-forget writes, or
`await`. `channel.send()`, `removeChannel()` and `supabase.auth.*` are real
promises and are fine to `void`.

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
