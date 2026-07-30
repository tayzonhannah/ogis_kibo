# KIBO Web App: Agent Implementation Guide

## Project Overview

KIBO is a shared aquarium application designed for ambient connection, treating silence and low-effort presence as design materials. The app replaces forced texting with a shared virtual space where a dyad cares for a virtual ecosystem.

## Locked Decisions

| Decision | Choice |
| --- | --- |
| Repo shape | Next.js app lives in a nested `kibo-app/` folder. Repo root keeps `LICENSE`, `README.md`, and this guide. |
| Language | TypeScript. |
| Access model | 8-character room code **plus** Supabase anonymous auth, so every device has a stable `auth.uid()` for RLS and per-user state. |
| State model | Postgres is the source of truth (fish roster, tank state, nutrient score, memos). Realtime **broadcast** carries only per-frame motion and handoff events. `postgres_changes` is the reconciliation channel. |
| Room size | **Two participants, enforced in the database.** Larger rooms are a later increment (see Tuning Knobs). |
| AI model | Google Gemini — `gemini-3.5-flash-lite` for nudges. |

### Why the state model matters

The original draft used broadcast alone for fish handoff. That design loses fish: a fish that exits the right edge with no peer listening is gone forever, nothing survives a page refresh, and two tabs each independently spawn their own `fish-1` (ID collision on the first crossing). The rule for this build:

- **Broadcast is the fast path.** Lossy, fire-and-forget, never authoritative.
- **Postgres is the slow path and the truth.** Every handoff also writes `fish.holder`. If the broadcast is dropped, the receiving client still picks the fish up from a `postgres_changes` event or on next load.

## Tech Stack

- **Framework:** Next.js (App Router), TypeScript
- **Styling:** Tailwind CSS
- **Database & Realtime:** Supabase — Postgres, Row Level Security, Realtime (Broadcast + Presence + `postgres_changes`), anonymous auth, `pg_cron`
- **Animation:** HTML5 Canvas, single `requestAnimationFrame` loop, delta-time based
- **AI Layer:** Google Gemini API (`gemini-3.5-flash-lite`) via `@google/genai`, **server-side only**

> The first draft specified `claude-3-5-haiku`, which was retired on 2026-02-19. Rather than update it, the AI layer moved to Gemini — see the note in Phase 5 for why the swap is nearly free and what still needs verifying.

## MVP Boundary

**In scope for the first working build:** anonymous auth, room create/join by code, presence, the shared canvas, and fish handoff that survives a dropped broadcast.

**Deferred until the core loop works:** Send Warmth, emotional weather, memos, phone-off scoring, AI nudges, PWA. Each has a phase below, but do not start one until the verification checklist for the previous phase passes.

---

## Phase 0: Setup

```bash
npx create-next-app@latest kibo-app --typescript --tailwind --app --eslint
cd kibo-app
npm install @supabase/supabase-js @supabase/ssr
```

The AI dependency is installed in Phase 5, where it is first used — Phases 0–4 have no AI surface, and an unused SDK in `package.json` invites someone to import it from a client component.

### Environment variables (`kibo-app/.env.local`)

Create the file and instruct the user to populate it. **Only** the two `NEXT_PUBLIC_` values may reach the browser.

```
# Browser-safe
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Server-only — never prefix these with NEXT_PUBLIC_
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_api_key
CRON_SECRET=generate_a_long_random_string
```

Add `.env.local` to `.gitignore` (Next.js does this by default — verify it).

### Clients

`lib/supabase/client.ts` — browser client, used by all components:

```ts
import { createBrowserClient } from '@supabase/ssr';

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
```

`lib/supabase/admin.ts` — service-role client for API routes and cron only. The `server-only` import makes accidental use in a client component a build error, not a leak:

```ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';

export const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
```

### Anonymous sign-in

Enable **Anonymous sign-ins** in the Supabase dashboard (Authentication → Providers). Then, before any room interaction:

```ts
const supabase = createClient();
const { data: { session } } = await supabase.auth.getSession();
if (!session) await supabase.auth.signInAnonymously();
```

Do this once in a top-level client provider, not per-component. Every device keeps its `auth.uid()` in local storage, so a refresh rejoins as the same participant.

An anonymous identity is only as durable as the browser's local storage. Clearing site data creates a new `auth.uid()`, and with a hard two-person cap that would lock the user out of their own room. Phase 1's stale-participant eviction is what makes this recoverable — do not skip it.

---

## Phase 1: Schema, RLS, and Room Join

**Goal:** two devices end up in the same room with distinct identities, neither can read any other room, and neither can forge state they shouldn't own.

### Tuning knobs

These numbers appear in the SQL below. Change them in one place each, and treat them as product decisions rather than implementation details.

| Constant | Value | Rationale |
| --- | --- | --- |
| `ROOM_CAPACITY` | 2 | Dyad only. The handoff code assumes exactly one peer. |
| `CODE_LENGTH` / alphabet | 8 chars / 32 symbols | `32^8 ≈ 1.1e12`. Excludes `I O 0 1` so codes survive being read aloud. |
| `JOIN_ATTEMPT_LIMIT` | 10 failures / 15 min | Bounds code enumeration. |
| `STALE_PARTICIPANT_DAYS` | 14 | After this, a silent participant can be evicted to free their slot. |
| `MAX_AWAY_CREDIT_SECONDS` | 28800 (8h) | Caps a single co-away interval so one long absence can't dominate the score. |
| `MEMO_MAX_LEN` | 140 | Also a `check` constraint, so it holds regardless of client. |
| `ROOM_IDLE_EXPIRY_DAYS` | 30 | Nightly cleanup deletes rooms idle this long. |

### Schema

```sql
create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  created_at timestamptz not null default now(),
  tank_mood text not null default 'calm',
  nutrient_seconds integer not null default 0,
  co_away_since timestamptz,
  last_interaction_at timestamptz not null default now(),
  last_nudged_at timestamptz
);

create table room_participants (
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- null = present/looking, timestamp = when they looked away
  hidden_since timestamptz,
  love_language text,
  primary key (room_id, user_id)
);

create table fish (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  holder uuid references auth.users(id) on delete set null,
  y_frac real not null check (y_frac between 0 and 1),
  speed_px_s real not null check (speed_px_s > 0),
  direction smallint not null default 1 check (direction in (1, -1)),
  color text not null,
  updated_at timestamptz not null default now()
);
create index fish_room_holder_idx on fish (room_id, holder);

create table memos (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  author uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 140),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index memos_room_idx on memos (room_id, created_at desc);

-- Rate-limit ledger. No client grants; only reachable via join_room().
create table join_attempts (
  id bigserial primary key,
  user_id uuid not null,
  attempted_at timestamptz not null default now(),
  succeeded boolean not null
);
create index join_attempts_user_idx on join_attempts (user_id, attempted_at desc);
```

Notes on the columns that changed from the draft:

- **`y_frac`, not `y`.** Phones and laptops have different viewport heights; a raw pixel Y makes a fish teleport vertically on crossing.
- **`speed_px_s`, not `speed`.** The draft's `fish.x += fish.speed` is per-*frame*, so a 144Hz monitor swims 2.4× faster than a 60Hz phone. Multiply by delta-time instead.
- **`holder`, not a boolean.** This is what makes handoff recoverable. `on delete set null` means a deleted account's fish becomes orphaned rather than disappearing — Phase 2 reclaims orphans.
- **No `x`.** Position within a screen is ephemeral and doesn't need a write per frame. A fish always enters at the edge it crossed into.

### Privileges before policies

RLS decides *which rows* you can touch. Column privileges decide *which columns*. Both are needed: an RLS policy alone would let a room member set `nutrient_seconds` to a million, because they legitimately have access to that row.

```sql
alter table rooms enable row level security;
alter table room_participants enable row level security;
alter table fish enable row level security;
alter table memos enable row level security;

revoke all on rooms, room_participants, fish, memos, join_attempts
  from anon, authenticated;

grant select on rooms, room_participants, fish, memos to authenticated;

-- Clients may set the mood. They may NOT touch nutrient_seconds,
-- co_away_since, last_interaction_at, code, or last_nudged_at.
grant update (tank_mood) on rooms to authenticated;

grant update (hidden_since, last_seen_at, love_language)
  on room_participants to authenticated;

grant update (holder, direction, y_frac) on fish to authenticated;

grant insert on memos to authenticated;
grant update (deleted_at) on memos to authenticated;
```

`nutrient_seconds` and `co_away_since` have **no client grant at all**, so the score cannot be forged even by a legitimate member. They are written only by the `security definer` trigger in Phase 4, which runs with the definer's privileges rather than the caller's.

### Policies

```sql
-- security definer, so it bypasses RLS and does not recurse when used
-- inside a policy on room_participants itself. This is the standard
-- Supabase fix for "infinite recursion detected in policy".
create function is_member(target_room uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from room_participants
    where room_id = target_room and user_id = auth.uid()
  );
$$;

create function is_member_of(target_room uuid, target_user uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from room_participants
    where room_id = target_room and user_id = target_user
  );
$$;

create policy "members read room" on rooms
  for select using (is_member(id));
create policy "members set mood" on rooms
  for update using (is_member(id)) with check (is_member(id));

create policy "members read participants" on room_participants
  for select using (is_member(room_id));
create policy "self update participant" on room_participants
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "members read fish" on fish
  for select using (is_member(room_id));
-- A member can hand a fish to a room-mate or release it, but cannot
-- assign it to a stranger.
create policy "members move fish" on fish
  for update using (is_member(room_id))
  with check (
    is_member(room_id)
    and (holder is null or is_member_of(room_id, holder))
  );

create policy "members read memos" on memos
  for select using (is_member(room_id) and deleted_at is null);
create policy "members write memos" on memos
  for insert with check (is_member(room_id) and author = auth.uid());
-- NO update policy on memos, deliberately. Retraction goes through the
-- retract_memo() definer function instead — see migration 0004.
--
-- A client UPDATE cannot soft-delete a row when the SELECT policy filters
-- soft-deleted rows out: setting deleted_at hides the row from the very policy
-- PostgREST reads the updated row back through, and the write fails with 42501
-- "new row violates row-level security policy". Isolating the predicate proves
-- it — `deleted_at = null` returns 204 while a timestamp returns 403, even
-- though the WITH CHECK never mentions deleted_at.
--
-- Either stop hiding them in the policy and filter in every query, or move the
-- write into a definer function. This build does the latter, so no query can
-- forget to filter.
```

There are deliberately **no INSERT policies** on `rooms`, `room_participants`, or `fish`. All creation goes through the `security definer` RPCs below, so the capacity cap and rate limit cannot be bypassed by writing directly to the table.

### Room lifecycle RPCs

There is **no `select` policy keyed on `code`** — a client cannot look a room up by code, which would make codes enumerable. Joining goes through an RPC that enforces the rate limit and the capacity cap:

```sql
create function create_room() returns text
language plpgsql security definer set search_path = public as $$
declare
  caller uuid := auth.uid();
  new_code text;
  new_id uuid;
  tries int := 0;
begin
  if caller is null then raise exception 'not_authenticated'; end if;

  loop
    new_code := (
      select string_agg(
        substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
               1 + floor(random() * 32)::int, 1), '')
      from generate_series(1, 8)
    );
    exit when not exists (select 1 from rooms where code = new_code);
    tries := tries + 1;
    if tries > 10 then raise exception 'code_generation_failed'; end if;
  end loop;

  insert into rooms (code) values (new_code) returning id into new_id;
  insert into room_participants (room_id, user_id) values (new_id, caller);
  insert into fish (room_id, holder, y_frac, speed_px_s, direction, color)
  values (new_id, caller, 0.45, 55, 1, '#F5B041');

  return new_code;
end;
$$;

-- Returns a status row rather than raising. This is load-bearing, not style:
-- RAISE EXCEPTION aborts the transaction, and because PostgREST runs each RPC
-- in its own transaction, a raise would roll back the join_attempts insert
-- that the rate limiter counts. The first implementation did exactly that, so
-- the ledger stayed empty and the throttle never fired. A function that must
-- persist a side effect cannot report failure by raising.
--
-- `not_authenticated` still raises: nothing to persist, no session at all.
--
-- The output field is `joined_room`, NOT `room_id`. An OUT parameter named
-- room_id shadows room_participants.room_id and the function fails at runtime
-- with 42702 "column reference is ambiguous" — only on the paths that reach
-- that table, which makes it easy to miss. Aliasing the WHERE clauses is not a
-- complete fix, because an INSERT column list cannot be qualified.
create function join_room(room_code text)
returns table (status text, joined_room uuid)
language plpgsql security definer set search_path = public as $$
declare
  caller uuid := auth.uid();
  target uuid;
  occupants int;
  recent_failures int;
begin
  if caller is null then raise exception 'not_authenticated'; end if;

  select count(*) into recent_failures
  from join_attempts
  where user_id = caller
    and succeeded = false
    and attempted_at > now() - interval '15 minutes';
  if recent_failures >= 10 then
    -- No extra attempt recorded: a throttled caller must not be able to
    -- extend their own lockout.
    return query select 'too_many_attempts'::text, null::uuid;
    return;
  end if;

  select id into target from rooms where code = upper(trim(room_code));

  if target is null then
    insert into join_attempts (user_id, succeeded) values (caller, false);
    return query select 'room_not_found'::text, null::uuid;
    return;
  end if;

  -- Idempotent rejoin: not a new attempt, no capacity check.
  if exists (
    select 1 from room_participants rp
    where rp.room_id = target and rp.user_id = caller
  ) then
    update room_participants rp set last_seen_at = now()
    where rp.room_id = target and rp.user_id = caller;
    return query select 'ok'::text, target;
    return;
  end if;

  -- Free the slot of anyone who has been silent past the staleness window.
  -- This is what rescues a room whose partner lost their anonymous session.
  delete from room_participants rp
  where rp.room_id = target
    and rp.last_seen_at < now() - interval '14 days';

  select count(*) into occupants
  from room_participants rp where rp.room_id = target;
  if occupants >= 2 then
    insert into join_attempts (user_id, succeeded) values (caller, false);
    return query select 'room_full'::text, null::uuid;
    return;
  end if;

  insert into room_participants (room_id, user_id) values (target, caller);
  insert into join_attempts (user_id, succeeded) values (caller, true);
  update rooms set last_interaction_at = now() where id = target;
  return query select 'ok'::text, target;
end;
$$;

create function leave_room(target_room uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from room_participants
  where room_id = target_room and user_id = auth.uid();
  -- Release rather than delete: the remaining participant reclaims them.
  update fish set holder = null
  where room_id = target_room and holder = auth.uid();
end;
$$;

-- Clients cannot write last_interaction_at directly (no column grant),
-- so warmth and other ephemeral gestures bump it through here. This also
-- prevents a client from setting a future timestamp to suppress nudges.
create function touch_room(target_room uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_member(target_room) then raise exception 'not_a_member'; end if;
  update rooms set last_interaction_at = now() where id = target_room;
end;
$$;
```

> **Any `security definer` function that both records something and can fail needs this shape.** If you add one, check whether its audit write survives its failure path — a rolled-back ledger fails silently and looks identical to a working one.
>
> **Name OUT parameters so they cannot collide with a column of any table the function touches.** `room_id` as an output field cost three deploy cycles.

### Knowing what is actually deployed

`kibo_schema_version()` returns a literal version string, declared **last** in each migration so a partially-executed script cannot report a version it never reached. Probe it before running any verification:

```
POST /rest/v1/rpc/kibo_schema_version   -> "0002c"
```

Bump the literal whenever a migration changes. This exists because three separate rounds of debugging were spent on symptoms that all reduced to "the migration I was testing was not the one deployed" — most often because the Supabase SQL Editor runs **only the highlighted text** when there is a selection.

`room_full` and `room_not_found` are distinct statuses, which technically tells an attacker that a guessed code is real. The rate limit is what bounds enumeration; the alternative — one generic error — would leave a third friend trying to join a dyad with no idea why it failed. If that trade-off is unacceptable later, collapse both into `room_unavailable`.

### Nightly cleanup

Enable `pg_cron` in the Supabase dashboard, then:

```sql
select cron.schedule('kibo-cleanup', '0 4 * * *', $$
  delete from rooms where last_interaction_at < now() - interval '30 days';
  delete from join_attempts where attempted_at < now() - interval '1 day';
  delete from memos where deleted_at < now() - interval '7 days';
$$);
```

Room deletion cascades to participants, fish, and memos. Without this, nothing in the system ever deletes anything.

### Phase 1 verification

**Verified green against the live project (38/38).** These are runnable over plain REST with the anon key — no browser needed — by signing in several anonymous users and exercising the RPCs as a client would. Check `kibo_schema_version()` first; a stale deployment makes every other result meaningless.

- Two browser profiles both `signInAnonymously()` and get different `auth.uid()`s.
- Both join the same code; `room_participants` has two rows. A **third** profile joining the same code fails with `room_full`.
- From profile A's session, `select * from rooms` returns exactly one row. `select * from rooms where code = '<other room code>'` returns zero rows.
- Reload profile A: it rejoins as the same `user_id`, not a third participant.
- **Forgery:** from a member's session, `update rooms set nutrient_seconds = 999999` fails on column privileges. So does `update rooms set code = 'AAAAAAAA'`.
- **Fish theft:** `update fish set holder = '<a non-member uuid>'` is rejected by the `with check` clause.
- **Rate limit:** 11 rapid `join_room('BADCODE1')` calls — the 11th raises `too_many_attempts`.
- **Eviction:** manually backdate a participant's `last_seen_at` by 15 days, then join with a third profile. It succeeds, and the stale row is gone.
- **Leave:** `leave_room` frees the slot and leaves the departing user's fish with `holder = null`.

---

## Phase 2: The Screen-Handoff Canvas

**Goal:** a fish swims across one device, exits, and appears on the other — and is never lost if a message drops.

### Handoff protocol

Only the **holder** simulates and draws a fish. Every other client ignores it.

Handoff is two-phase, and the fish is never removed optimistically:

1. On exit, mark the fish `handingOff` locally. It stops advancing and stops drawing, but stays in the local array. This is what prevents a double-send while the write is in flight.
2. Resolve the peer from Realtime Presence. **If there is no peer present, reflect the fish** (`direction *= -1`, clear the flag) and stop — never hand off into the void.
3. `broadcast` `FISH_CROSS` with `{ fishId, y_frac, speed_px_s, direction, color, toUser }`.
4. `update fish set holder = toUser, direction, y_frac where id = fishId`.
5. **Only if the update succeeds**, drop the fish from the local array. On failure, clear the flag and reflect — the holder keeps a fish it still owns rather than gambling it on a write that didn't land.

On the receiving side, adopt on **whichever arrives first**:

- A `FISH_CROSS` broadcast addressed to me (fast path, ~50ms).
- A `postgres_changes` UPDATE on `fish` whose new `holder` is me (safety net, ~200ms).

Deduplicate by checking whether the id is already in the local fish array. `adoptFish` pushes synchronously and JavaScript is single-threaded, so the second signal always sees the first one's result — no separate seen-set, and therefore no unbounded set that would also block a fish from ever returning.

Spawn at `x = -MARGIN` for `direction = 1`, or `x = width + MARGIN` for `direction = -1`, at `y = y_frac * height`.

On subscribe, also run **recovery**, which is what makes a refresh non-destructive and cleans up after a departed partner:

```ts
// Claim anything released by someone who left, then load everything I hold.
await supabase.from('fish').update({ holder: userId })
  .eq('room_id', roomId).is('holder', null);
const { data } = await supabase.from('fish').select('*')
  .eq('room_id', roomId).eq('holder', userId);
```

The orphan claim is racy when both clients start at once — both may try, one wins, and the loser's follow-up `select` simply doesn't return that fish. That is the correct outcome, so no locking is needed.

### Canvas component (`components/Aquarium.tsx`)

The draft's render loop had four bugs worth naming, because they are easy to reintroduce:

1. `setFishes` was called inside `requestAnimationFrame`, triggering a React re-render every frame (~60/s) and mutating state objects in place. **Keep the fish array in a `useRef`.** React state is for things that change the DOM; the canvas is not the DOM.
2. `fish.x += fish.speed` is frame-rate dependent. **Multiply by delta seconds.**
3. `width={typeof window !== 'undefined' ? window.innerWidth : 800}` produces a server/client hydration mismatch and never responds to resize or rotation. **Size the canvas in an effect**, and scale by `devicePixelRatio` or it renders blurry on phones.
4. The channel effect runs twice under React 18 StrictMode in dev, creating two subscriptions and duplicating every received fish. Always `removeChannel` in cleanup; the array-based dedupe covers the rest.

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

type Fish = {
  id: string;
  x: number;          // CSS px, local to this screen, never persisted
  yFrac: number;      // 0..1
  speedPxS: number;
  direction: 1 | -1;
  color: string;
  handingOff: boolean;
};

const MARGIN = 40;

export default function Aquarium({
  roomId,
  userId,
}: {
  roomId: string;
  userId: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fishRef = useRef<Fish[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const peersRef = useRef<string[]>([]);

  // --- Realtime: presence + broadcast + reconciliation + recovery ---
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;

    const adopt = (p: {
      fishId: string;
      y_frac: number;
      speed_px_s: number;
      direction: 1 | -1;
      color?: string;
    }) => {
      // Dedupe broadcast vs postgres_changes vs recovery.
      if (fishRef.current.some((f) => f.id === p.fishId)) return;
      const w = canvasRef.current?.clientWidth ?? 0;
      fishRef.current.push({
        id: p.fishId,
        x: p.direction === 1 ? -MARGIN : w + MARGIN,
        yFrac: p.y_frac,
        speedPxS: p.speed_px_s,
        direction: p.direction,
        color: p.color ?? '#F5B041',
        handingOff: false,
      });
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        peersRef.current = Object.keys(channel.presenceState()).filter(
          (id) => id !== userId
        );
      })
      .on('broadcast', { event: 'FISH_CROSS' }, ({ payload }) => {
        if (payload.toUser !== userId) return;
        adopt(payload);
      })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'fish',
          filter: `room_id=eq.${roomId}`,
        },
        ({ new: row }) => {
          if (row.holder !== userId) return;
          adopt({
            fishId: row.id,
            y_frac: row.y_frac,
            speed_px_s: row.speed_px_s,
            direction: row.direction,
            color: row.color,
          });
        }
      )
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;
        await channel.track({ at: Date.now() });

        // Claim fish released by a departed participant...
        await supabase
          .from('fish')
          .update({ holder: userId })
          .eq('room_id', roomId)
          .is('holder', null);
        // ...then load everything I hold (covers reload + missed broadcasts).
        const { data } = await supabase
          .from('fish')
          .select('*')
          .eq('room_id', roomId)
          .eq('holder', userId);
        data?.forEach((row) =>
          adopt({
            fishId: row.id,
            y_frac: row.y_frac,
            speed_px_s: row.speed_px_s,
            direction: row.direction,
            color: row.color,
          })
        );
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, userId]);

  // --- Canvas sizing (DPR-aware, resize-aware) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // --- Single delta-time render loop ---
  useEffect(() => {
    const supabase = createClient();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let raf = 0;
    let last = performance.now();
    const departed = new Set<string>();

    // Two-phase handoff: confirm the write before giving up the fish.
    const handOff = async (fish: Fish, peer: string) => {
      fish.handingOff = true;
      channelRef.current?.send({
        type: 'broadcast',
        event: 'FISH_CROSS',
        payload: {
          fishId: fish.id,
          y_frac: fish.yFrac,
          speed_px_s: fish.speedPxS,
          direction: fish.direction,
          color: fish.color,
          toUser: peer,
        },
      });
      const { error } = await supabase
        .from('fish')
        .update({
          holder: peer,
          direction: fish.direction,
          y_frac: fish.yFrac,
          updated_at: new Date().toISOString(),
        })
        .eq('id', fish.id);

      if (error) {
        // Write failed: keep the fish, turn it around, try again next lap.
        fish.handingOff = false;
        fish.direction = (fish.direction * -1) as 1 | -1;
        return;
      }
      departed.add(fish.id);
    };

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1); // clamp after tab-away
      last = now;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      ctx.clearRect(0, 0, w, h);

      fishRef.current = fishRef.current.filter((fish) => {
        if (departed.has(fish.id)) {
          departed.delete(fish.id);
          return false; // handoff confirmed — safe to drop
        }
        if (fish.handingOff) return true; // in flight: hold, don't draw

        fish.x += fish.speedPxS * fish.direction * dt;
        drawFish(ctx, fish, h);

        const exitedRight = fish.direction === 1 && fish.x > w + MARGIN;
        const exitedLeft = fish.direction === -1 && fish.x < -MARGIN;
        if (!exitedRight && !exitedLeft) return true;

        const peer = peersRef.current[0];
        if (!peer) {
          // Nobody to receive it — reflect rather than lose the fish.
          fish.direction = (fish.direction * -1) as 1 | -1;
          return true;
        }
        void handOff(fish, peer);
        return true;
      });

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [roomId, userId]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-slate-900">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
```

`drawFish` is left to the implementation. `peersRef.current[0]` is correct only because `ROOM_CAPACITY` is 2 and enforced in the database — see Tuning Knobs before raising it.

### Presence heartbeat

While the tab is visible, update `last_seen_at` every 60s. This is what makes stale-participant eviction meaningful, and it must **not** run while hidden — a hidden tab that keeps reporting itself alive is indistinguishable from a present one, which breaks Phase 4.

### Main page

Routing is `/` → create or enter a code → `/room/[code]`. The room page resolves the code via `join_room`, gets `roomId` and the session `userId`, then renders `<Aquarium roomId={...} userId={...} />`. There is no hardcoded demo room. Surface `room_not_found`, `room_full`, and `too_many_attempts` as distinct user-facing states.

Since 8 characters is a lot to type on a phone, the invite path should be a shareable `/room/CODE` link, with the typed code as the fallback.

### Phase 2 verification

These are the acceptance tests. All must pass before Phase 3.

- **Two-tab sync:** two profiles, same room, side by side. A fish exiting A's right edge appears on B's left within ~250ms, at the same relative height.
- **No duplication:** with StrictMode on in dev, the fish appears exactly once, not twice.
- **Broadcast-drop resilience:** temporarily comment out the `FISH_CROSS` handler on B. The fish still arrives, via `postgres_changes`, just slower. This proves the safety net.
- **Failed-write resilience:** revoke the `fish` update grant, then let a fish exit. It reflects and keeps swimming on the sender instead of vanishing.
- **Reload:** refresh whichever tab holds the fish. The fish comes back on that tab, and only that tab.
- **Solo:** with B closed, the fish reflects off the right edge instead of vanishing.
- **Orphan reclaim:** call `leave_room` from B while B holds the fish, then reload A. A picks the fish up.
- **Frame-rate independence:** the fish crosses a given screen in roughly the same wall-clock time on a 60Hz and a 120Hz display.
- **Resize/rotate:** rotating a phone re-lays out the canvas without blurring or losing fish.

---

## Phase 3: Ambient Interactions

**Built and verified.** Migration `0003`, `components/TankControls.tsx`, and the warmth/memo/heart/mood layers in `Aquarium.tsx`. Verified by `scripts/e2e-handoff.mjs` (23 checks, stable over four consecutive runs).

**Mood vocabulary: `calm / deep / bright / murky / warm`, kept deliberately.** These began as placeholders and were reviewed and retained, so treat them as the vocabulary rather than a TODO. If they ever change, they live in exactly two places — the `tank_mood` check constraint and `TANK_MOODS` in `lib/constants.ts` — plus `TANK_MOOD_LABELS` and `TANK_MOOD_GRADIENT` for the display name and colours.

### 1. Send Warmth

- **UI:** a "Send Warmth" button overlaid on the canvas.
- **Transport:** broadcast a `WARMTH_SENT` event, then call `touch_room(roomId)`. Warmth is intentionally ephemeral — a missed one is a missed moment, not lost state — so broadcast-only is correct, but the room's idle clock still needs to move (Phase 5 reads it).
- **Canvas:** on receipt, spawn a glowing coral at the bottom that fades over ~5s. Keep these in a separate `useRef` array with a `bornAt` timestamp; the existing render loop draws and expires them.
- **Guard:** debounce client-side to one per few seconds, and cap the coral array length so a rapid sender can't grow it without bound.

### 2. Emotional Weather (Tank State)

- **UI:** a small mood selector (e.g. "Deep Sea Blue" for overwhelmed).
- **Transport:** `update rooms set tank_mood = ...`. Persistent state, so it goes through Postgres, not broadcast. Both clients pick it up via `postgres_changes` on `rooms`. This is the one `rooms` column clients may write.
- **Validation:** add a `check (tank_mood in (...))` constraint listing the valid moods. The column grant lets a client write any string otherwise.
- **Render:** drive the canvas background fill from `tank_mood`, cross-fading over ~2s. An instant colour snap reads as a notification; a slow fade reads as weather.

### 3. Small Memos

- **UI:** a short text input, capped at 140 characters to match the `check` constraint.
- **Transport:** insert into `memos`, then broadcast for immediate delivery. Same fast-path/truth-path split as fish — a memo that evaporates because the partner wasn't looking undercuts the premise.
- **Rate limit:** add a `before insert` trigger rejecting more than ~10 memos per author per minute. The insert policy authorizes *who*, not *how often*.
- **Canvas:** render text inside a floating bubble in the render loop. `ctx.fillText` is not an HTML injection surface, but still clip to the bubble and store each bubble's current bounds on the memo object so clicks can be hit-tested.
- **Retract:** either participant can retract either person's memo, via the `retract_memo()` RPC (not a client UPDATE — see the policy note in Phase 1). For a two-person space this is the whole moderation story; cleanup drops tombstones after 7 days.

  **Built: hold a bubble for `RETRACT_HOLD_MS` (700ms), offered to both people.** Tap was already taken by hearts, so the two gestures are separated by duration on one pointer: the tap fires on `pointerup` so that a press which becomes a hold does not also send a heart, and moving more than `PRESS_CANCEL_PX` mid-press fires neither. The bubble fades as the hold progresses, which makes the gesture its own confirmation — no dialog, and the removal at the end lands on an already-faint bubble rather than snapping something solid away. Showing it to both matches the policy rather than narrowing it: the DB has always allowed either participant to retract either memo, and hiding the affordance from the non-author would have been a UI-only restriction pretending to be a rule.

  **Retraction travels by broadcast, and has no truth-path fallback.** Setting `deleted_at` makes the row stop satisfying the memos SELECT policy (`deleted_at is null`), so `postgres_changes` cannot deliver it — the subscription reads through that same policy. Unlike fish and memos, there is no second channel to fall back on. That is acceptable only because a missed retraction self-heals rather than desyncing: the bubble expires on its own within `MEMO_LIFETIME_MS`, and the backlog query on next load already filters retracted memos out. The row is gone either way.
- **Reply:** clicking a bubble sends a heart back over broadcast.
- **Backlog:** on subscribe, the five most recent memos are loaded as bubbles, so arriving later still shows you what was left.

### One channel, listeners registered before subscribe

Supabase requires every `.on()` before `.subscribe()`, so a component cannot attach a listener to a channel someone else already subscribed. `Aquarium` therefore owns the single `room:<id>` channel and registers **all** listeners — fish, warmth, memos, hearts, and the `rooms` row. Anything not drawn on the canvas is forwarded upward through `onRoomUpdate`; `onChannelReady` hands the channel out so `TankControls` can send on it.

Those callbacks must be referentially stable (`useCallback` with `[]`) — they are dependencies of the channel effect, and a fresh identity tears down and re-opens the subscription on every render.

The channel is opened with `broadcast: { self: true }` so a sender also sees its own warmth, memo, and heart. `FISH_CROSS` filters on `toUser`, so it is unaffected.

### Two behaviours worth knowing before Phase 4

Both surfaced while writing the browser test, and both are properties of the design rather than bugs:

1. **Only the holder simulates a fish, and `requestAnimationFrame` is paused in a backgrounded tab.** So if the holder's tab isn't visible, its fish stop moving and no handoff fires. Receiving is unaffected — adoption happens in a realtime callback. This is benign today and arguably correct for Phase 4 (a pocketed phone shouldn't be animating), but it means "both people away" freezes the tank rather than continuing it. Decide deliberately whether the nutrient score should keep accruing while nothing moves.
2. **Handoff is eventually consistent, and any count must exclude fish in flight.** B adopts from the broadcast *before* A's `holder` write resolves, so for a few hundred milliseconds the fish is logically owned by B while A still holds a record of it. A fish marked `handingOff` has already stopped being drawn, so it must not be counted — counting it claims the fish is on two screens at once. Assert the "exactly N fish across both screens" invariant with a wait, never instantaneously.

---

## Phase 4: Phone-Off Continuity

**Goal:** when both people have put the app away, the tank quietly gains nutrients.

**Built and verified.** Migration `0005`, `lib/useCoAway.ts`, `lib/nutrients.ts`, `components/NutrientMeter.tsx`, and the room-row plumbing in `RoomClient.tsx`. Verified by `scripts/verify-phase4.ps1` (37 checks over REST, cap included) and sections 5f–6 of `scripts/e2e-handoff.mjs` (42 in the suite overall).

Building it also turned up a bug that had been silently live since Phase 1 — un-awaited supabase-js builders never issue their request, which had killed the heartbeat and `touch_room()` as well as this phase's own write. See the entry under Standing Constraints; it is the most transferable thing in this document.

Three things came out differently from the draft below, and the reasons are worth keeping:

1. **The trigger locks the room *before* counting, not after.** The draft counts participants first and then takes `for update` on the room. Both people can look away in the same instant, and each trigger runs inside its own client transaction — so counting first means neither sees the other's uncommitted `hidden_since` under READ COMMITTED, both conclude someone is still present, and the interval never opens at all. Taking the row lock first serialises the whole count-then-decide: the waiter re-reads the room after the lock is released, and its count then runs on a snapshot that includes the sibling's committed write.
2. **The trigger returns early when `hidden_since` did not actually move.** `after update of hidden_since` fires on any UPDATE whose target list names the column, changed or not, and clients re-write the same state routinely — a repeated `visibilitychange`, a mount that sets null over null, the unload beacon landing behind its own ordinary write. None of those can change the outcome, so leaving early keeps both participants off the room's row lock for writes that were always no-ops.
3. **`navigator.sendBeacon` cannot be used for the unload write**, even though it is the tool the draft reaches for first. It sends no custom headers, so it cannot present the `Authorization` bearer PostgREST needs, and RLS rejects it. `fetch` with `keepalive: true` survives unload *and* can carry the header, which is why `useCoAway` builds that one request by hand instead of going through supabase-js.

Two smaller notes:

- **`useCoAway` is deliberately separate from `useHeartbeat`**, despite both listening to `visibilitychange` with the same dependencies. The heartbeat's rule is "never beat while hidden"; this one's is "always say which way it went". Sharing one UPDATE would also make every heartbeat fire the co-away trigger.
- **The client re-reads the room on returning to the tab**, not only on mount. The interesting change happens precisely while nobody is watching, and a backgrounded mobile tab has lost its websocket — realtime has a gap exactly where the credit landed. That re-read races `useCoAway`'s own write harmlessly: whichever side of the credit it reads, `liveNutrientSeconds` renders the same total, which is the real reason the open interval is rendered rather than ignored.

### The mechanic

Track per-participant away state; compute the shared interval **server-side**. The draft's `update rooms set user_backgrounded = document.hidden` cannot work for two people — one boolean column cannot represent two participants, and the second writer overwrites the first.

Client side, on `visibilitychange`:

```ts
document.addEventListener('visibilitychange', () => {
  void supabase
    .from('room_participants')
    .update({ hidden_since: document.hidden ? new Date().toISOString() : null })
    .eq('room_id', roomId)
    .eq('user_id', userId);
});
```

Server side, a `security definer` trigger maintains the ledger. It runs with the definer's privileges, which is why it can write columns the client has no grant on:

```sql
create function sync_co_away() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  total int;
  away int;
  opened timestamptz;
  credit int;
begin
  select count(*), count(hidden_since)
    into total, away
  from room_participants
  where room_id = new.room_id;

  select co_away_since into opened
  from rooms where id = new.room_id for update;

  if away = total and total >= 2 and opened is null then
    update rooms set co_away_since = now() where id = new.room_id;

  elsif away < total and opened is not null then
    credit := least(
      greatest(extract(epoch from (now() - opened))::int, 0),
      28800  -- MAX_AWAY_CREDIT_SECONDS
    );
    update rooms
      set nutrient_seconds = nutrient_seconds + credit,
          co_away_since = null,
          last_interaction_at = now()
      where id = new.room_id;
  end if;

  return new;
end;
$$;

create trigger room_participants_co_away
after update of hidden_since on room_participants
for each row execute function sync_co_away();
```

Three properties fall out of this design, and each one closes a hole:

- **`total >= 2` means a solo room never accrues.** One person alone can't farm nutrients.
- **Credit is banked on return, not during absence.** An abandoned room accrues nothing permanent. This is also thematically right: the reward is for reunion after rest, not for absence itself.
- **`least(..., 28800)` caps one interval at 8 hours.** This is what makes the tab-close ambiguity survivable — see below.

For live display, the UI shows `nutrient_seconds + min(now - co_away_since, MAX_AWAY_CREDIT_SECONDS)`. The open portion is rendered, never written.

### The tab-close ambiguity, and why it's bounded rather than solved

`visibilitychange` fires `hidden` when a tab is closed, so "phone in my pocket" and "I quit the app" produce the identical signal. There is no reliable way to tell them apart:

- A heartbeat doesn't help — a backgrounded mobile tab is frozen by the OS and stops heartbeating exactly like a closed one.
- Realtime Presence doesn't help either — mobile backgrounding drops the websocket, so presence-leave fires for both cases.

So the mechanic is **bounded** instead of perfectly discriminated, on three fronts:

1. `pagehide` with `event.persisted === false` is a best-effort explicit departure signal. Send it with `navigator.sendBeacon` or `fetch(..., { keepalive: true })` — a normal Supabase call will not finish during unload.
2. Credit only lands on return, so walking away forever earns nothing.
3. `MAX_AWAY_CREDIT_SECONDS` caps any single interval, so a week-long absence is worth the same as one good night.

Together these mean the worst case for a closed tab is that one 8-hour interval gets credited when someone eventually reopens the app — noticeable but not score-breaking. Tune the cap if 8 hours reads as too generous.

### PWA install state

Phone-off keys on **page visibility only**. `display-mode: standalone` tells you how the app was launched, not whether the phone is face-down, and gating the core mechanic on installation makes the feature invisible to anyone who hasn't installed. Track install state separately if it's interesting as analytics.

### Phase 4 verification

`scripts/verify-phase4.ps1` covers all of these over REST; section 5f of `scripts/e2e-handoff.mjs` covers the two that are only visible in a browser.

- Both tabs visible → nutrients static.
- One tab hidden → still static.
- Both hidden → the live counter advances; on return, `nutrient_seconds` matches elapsed wall-clock time within a second or two.
- Rapid tab switching does not double-count or produce negative intervals.
- Both hidden for longer than the cap → exactly `MAX_AWAY_CREDIT_SECONDS` is credited, not the full elapsed time.
- A solo participant hiding and returning credits nothing.
- A direct client `update rooms set nutrient_seconds = 999999` fails on column privileges.

Two more the checklist did not originally call for, both worth keeping:

- **Neither participant can rewrite the other's `hidden_since`.** Marking your partner away would open the interval while you are still looking, which is the one forgery this mechanic actually invites. The `self update participant` policy stops it, so the attempt returns 200 with an empty result set rather than an error — assert on the unchanged value, not on a status code.
- **A no-op write leaves the ledger alone**, including one that bundles `hidden_since` with the heartbeat column.

The cap check has to backdate `co_away_since`, and no client may write that column — so that one section needs `SUPABASE_SERVICE_ROLE_KEY` and skips itself, loudly, without it. The simultaneous-hide race behind the lock ordering is *not* covered: every request the script makes is sequential.

---

## Phase 5: AI Listener & PWA

### 1. Nudges (`gemini-3.5-flash-lite`)

```bash
npm install @google/genai
```

- **Model:** `gemini-3.5-flash-lite` is the cost-appropriate default for a one-sentence notification. `gemini-3.6-flash` is the upgrade if nudge quality turns out to matter more than cost. `gemini-flash-latest` exists as a floating alias — **do not use it here**, because a silent model change under a scheduled job is a debugging trap.
- **Verify the call shape before writing it.** Package (`@google/genai`) and model IDs above are current as of 2026-07, but the client surface has moved recently — the quickstart shows `ai.interactions.create({ model, input })`, whereas older tutorials use `models.generateContent`. Check [ai.google.dev/gemini-api/docs/quickstart](https://ai.google.dev/gemini-api/docs/quickstart) at implementation time rather than copying either from memory.
- **Route:** `app/api/nudge/route.ts`, server-side only, using `lib/supabase/admin.ts`.
- **Scheduling: Vercel Cron. Decided.** An API route does not fire on its own, and the two candidates were `vercel.json` cron or `pg_cron` + `pg_net`. Vercel Cron wins because it keeps `GEMINI_API_KEY` in exactly one place — the server env — whereas driving it from Postgres means the database also needs to hold or reach the key. It also lines up with the auth check below: Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when that variable is set. **Verify both the header behaviour and the Hobby-plan limits on frequency and job count against current Vercel docs at implementation time** — same rule as the Gemini SDK above, for the same reason.
- **Verified at implementation time (2026-07), as the bullet above requires.** `CRON_SECRET` is sent automatically as `Authorization: Bearer <value>` — confirmed. Hobby allows 100 jobs per project but **at most one run per day**, and a more frequent expression *fails deployment* rather than degrading; precision is the hour, so `0 4 * * *` fires somewhere in 04:00–04:59 UTC. Daily is ample against a 3-day window, so the Hobby limit costs nothing here. Two further facts changed the design: Vercel **never retries a failed invocation**, and delivery **can duplicate**. Together they say a missed run should simply wait for tomorrow, and a duplicate run must be harmless — see the claim below.
- **Auth:** verify `Authorization: Bearer ${CRON_SECRET}` and return 401 otherwise. An unauthenticated route that calls a paid API is a billing vulnerability. Compared with `timingSafeEqual` after a length check, rather than `!==`; the docs' own example uses `!==`, and matching a secret byte-by-byte with early exit is a habit worth not having.
- **Claim before you spend.** Idempotency is a compare-and-set, not a check-then-write: one `update ... set last_nudged_at = now(), nudge_text = null where id = ? and <the same idle predicate the scan used>`, returning the row. Whoever flips the timestamp first owns the room; a concurrent or duplicate invocation gets zero rows back and moves on. This is the row-level version of the lock Vercel's own docs recommend for overlapping runs, and it is why the idle window is re-tested inside the claim rather than trusted from the scan. Clearing `nudge_text` in the same statement matters: a generation failure after a successful claim would otherwise pair a fresh timestamp with a stale sentence, and the banner dedupes on the timestamp — so the client would replay an old nudge as new. A failed generation therefore burns the room's slot for one window, which is the correct direction to fail, because retrying immediately is how a broken prompt becomes an invoice.
- **Trigger:** rooms where `last_interaction_at < now() - interval '3 days'` **and** (`last_nudged_at` is null or older than the same window).
- **Idempotency:** set `last_nudged_at = now()` in the same transaction that sends. Cron delivery is at-least-once, so without this a retry double-nudges.
- **Prompt context:** pass both participants' `love_language` plus the current `tank_mood`, and ask for one short notification line (e.g. "Drop a small memo?"). Cap the output token limit low — the output is one sentence, and the cap is a hard spend ceiling.
- **Never send room content to the model.** Memo bodies are private between two people. The nudge only needs the love languages, the mood, and how long the tank has been quiet — send those, not the conversation.

**Love language capture:** `room_participants.love_language` exists in the schema but nothing populates it. Add a one-time prompt after a participant's first join — a four-or-five-option picker, skippable. The nudge prompt must handle nulls, since it will often have one participant's answer and not the other's, or neither.

The column grant (`grant update (love_language) on public.room_participants`) and the `self update participant` policy already permit exactly this write and nothing wider, so the picker needs no *access* migration. It is awaited rather than sent through `fire()`, because the card dismisses on success — the result is genuinely needed, which makes this the case `fire()`'s doc comment excludes. It still gets a read-back assertion, since the stored value's only reader is a job that runs three days later.

**The column did need constraining, though.** 0001 created `love_language` as bare `text` with a client update grant, which was harmless while nothing read it. Phase 5 makes it the only client-written value that reaches a language model and comes back out on the *other* participant's screen — a prompt-injection channel between two people who are supposed to be exchanging fish. 0006 adds a check constraint over a closed vocabulary (mirrored as `LOVE_LANGUAGES` in `lib/constants.ts`, the same arrangement as `tank_mood`), and the route validates against the same list before building the prompt. Neither alone is enough: a constraint added later cannot clean rows written before it, and a client-side allowlist is not access control.

### Delivery: where a nudge actually lands

The draft generated a sentence and had nowhere to put it. `rooms` carried `last_nudged_at` — a timestamp — and no column for the text, so with push deferred the cron job would have paid Gemini per room and discarded the result. Two ways out, and the cheap one is wrong:

- **Generate the line on page open instead.** Rejected. It moves a paid API call onto a user-triggered path, where spend scales with traffic rather than with a once-daily job, and it contradicts the scheduling decision above.
- **Store it.** `0006` adds `rooms.nudge_text`, written only by the route holding the service-role key. It gets **no** `grant update`, for the same reason `nutrient_seconds` has none: a client that can write its own nudge can forge one.

Dismissal is deliberately local. The client cannot write `nudge_text` — that is the point of withholding the grant — so "seen" lives in `localStorage` as the `last_nudged_at` value the banner was last shown for, and a nudge is new when the server's timestamp differs from the stored one. This keeps the ledger server-owned without inventing a second write path, and the failure mode is a banner reappearing on a cleared browser, which is survivable. `grant select on public.rooms` is whole-row, so no read grant changes either.

This is the standing constraint about broadcast applied one layer up: a nudge is a state change that must survive a refresh, so it lives in a column, not in a channel.

### 2. PWA

- **Manifest:** `app/manifest.ts` with `display: 'standalone'`, icons, and theme colour matching the tank.
- **Icons are a real dependency, not a detail.** The repo ships only `app/favicon.ico`. Chrome will not treat the app as installable without 192px and 512px PNGs, and Android crops a non-maskable icon into a circle, so a square logo loses its edges. Needs 192, 512, and a 512 maskable with the artwork inside the safe zone (~80% of the canvas). Generated from one source shape by `scripts/gen-icons.mjs` so the set can be regenerated rather than hand-maintained.
- **Service worker:** cache the shell only. Keep the aquarium online-only — a cached stale tank is worse than an honest offline state. A `fetch` handler is not optional even so: installability requires one. Network-first for navigation with a static `/offline` fallback satisfies that without ever serving a stale tank.
- **Push notifications:** a bigger lift than the draft implies. Web Push needs VAPID keys, a `web-push` server dependency, a `PushSubscription` stored per participant, and explicit permission. On iOS, Web Push works **only** when the PWA has been added to the Home Screen, and permission must be requested from a user gesture. Budget this as its own increment; if it slips, the nudge degrades to an in-app banner on next open.

### Phase 5 verification

`scripts/verify-phase5.ps1` covers the route and the grants over REST. It backdates `last_interaction_at` with the service role, so it skips itself loudly without `SUPABASE_SERVICE_ROLE_KEY` — same shape as the Phase 4 cap check.

- `curl` to `/api/nudge` without the secret returns 401.
- With the secret, a room idle >3 days produces exactly one nudge; calling twice in a row produces no second nudge.
- A room with one or both `love_language` values null still produces a sensible nudge.
- An *active* room is not nudged — the trigger window has to be able to exclude.
- **`nudge_text` and `last_nudged_at` are read back after the call.** The route's whole observable output is that write; without reading it, a 200 from a route that generated nothing looks identical to success.
- **A direct client `update rooms set nudge_text = '...'` fails on column privileges**, and so does writing `last_nudged_at`. A forgeable nudge is a stranger's notification.
- A participant can write their own `love_language` and **not** their partner's.
- Lighthouse reports the app as installable; it launches standalone on Android and iOS.
- No `GEMINI_API_KEY` or service-role key appears in any client bundle (`grep` the `.next` output).

---

## Standing Constraints

- Never expose `SUPABASE_SERVICE_ROLE_KEY` or `GEMINI_API_KEY` to the browser. The service-role key bypasses every policy in this document.
- Treat any key that reaches a chat window, an issue, or a log as burned. Rotate it rather than reasoning about who might have seen it.
- Every new table gets RLS enabled, a membership-based policy, **and** explicit column grants in the same commit that creates it. Policies alone are not access control.
- Any column a client must never forge gets no `grant update` and is written only by a `security definer` function.
- Broadcast is never the only record of a state change that should survive a refresh.
- Anything drawn on the canvas is driven by one `requestAnimationFrame` loop and delta time. No `setInterval` animations, no per-frame React state.
- Keep the ambient feel in code review too: transitions fade, they don't snap.
- **Never `void` a supabase-js query or RPC builder.** They are *lazy thenables*: the request is issued when something awaits them, not when the chain is built, so `void supabase.from(...).update(...)` sends nothing whatsoever — no request, no error, no console output, and a call site that reads exactly like a write. Fire-and-forget writes go through `fire()` in `lib/supabase/fire.ts`, which awaits and logs. `channel.send()`, `removeChannel()` and everything under `supabase.auth` are real promises, so `void` on those is fine.

  This is not hypothetical: it silently killed three writes across two phases — the presence heartbeat (`useHeartbeat`, since Phase 1), `touch_room()` on warmth (`TankControls`, since Phase 3), and the phone-off report (`useCoAway`, Phase 4). All three are writes whose effect is invisible from the screen that makes them, which is exactly why the first two survived a phase sign-off each. **The lesson generalises past this API: a fire-and-forget write with no observable local effect needs a test that reads it back, or it is indistinguishable from a no-op.** Phase 4 only caught it because the meter renders what the write causes.

- **Every assertion must be able to fail.** Prefer waiting for a *change from a captured baseline* over an absolute threshold: a threshold is often already satisfied by whatever happened to be on screen. Two real ones from Phase 4, both green while the thing under test was broken or wrong. `waitFor(bubbles >= 1)` was satisfied by a memo still drifting from an earlier section, so the retract test held down on the wrong memo and then read the unchanged count as "nothing happened". `settled === banked` was satisfied by `0 === 0` when the meter never rendered at all. When a check passes, ask what it would take for it to fail.

## Deferred Increments

Not open questions — decided to be out of scope, with the constraint each one would relax.

| Increment | What has to change |
| --- | --- |
| Rooms of 3+ | Raise `ROOM_CAPACITY`; replace `peersRef.current[0]` with a deterministic neighbour ordering (a ring), so a fish traverses everyone rather than ping-ponging between two arbitrary devices. Phase 4's `away = total` also gets much harder to satisfy — consider a quorum instead. |
| Named accounts | Swap `signInAnonymously` for magic-link auth. All RLS stays as written, since it keys on `auth.uid()` either way; add an account-linking path so existing anonymous rooms survive the upgrade. |
| Fish variety, growth, breeding | `fish` gains species/age columns and a server-side growth tick, which means either `pg_cron` or deriving age from `created_at` at read time. Prefer the latter, for the same reason the nutrient score is derived. |
| Push notifications | See Phase 5. VAPID keys, per-participant subscriptions, and an iOS install requirement. |
