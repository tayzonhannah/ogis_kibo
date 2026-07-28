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
-- Either participant can retract any memo in their room. For a two-person
-- space this is the proportionate moderation path — no report queue needed.
create policy "members retract memos" on memos
  for update using (is_member(room_id)) with check (is_member(room_id));
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

create function join_room(room_code text) returns uuid
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
  if recent_failures >= 10 then raise exception 'too_many_attempts'; end if;

  select id into target from rooms where code = upper(trim(room_code));

  if target is null then
    insert into join_attempts (user_id, succeeded) values (caller, false);
    raise exception 'room_not_found';
  end if;

  -- Idempotent rejoin: not a new attempt, no capacity check.
  if exists (
    select 1 from room_participants where room_id = target and user_id = caller
  ) then
    update room_participants set last_seen_at = now()
    where room_id = target and user_id = caller;
    return target;
  end if;

  -- Free the slot of anyone who has been silent past the staleness window.
  -- This is what rescues a room whose partner lost their anonymous session.
  delete from room_participants
  where room_id = target
    and last_seen_at < now() - interval '14 days';

  select count(*) into occupants
  from room_participants where room_id = target;
  if occupants >= 2 then
    insert into join_attempts (user_id, succeeded) values (caller, false);
    raise exception 'room_full';
  end if;

  insert into room_participants (room_id, user_id) values (target, caller);
  insert into join_attempts (user_id, succeeded) values (caller, true);
  update rooms set last_interaction_at = now() where id = target;
  return target;
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

`room_full` and `room_not_found` are distinct errors, which technically tells an attacker that a guessed code is real. The rate limit is what bounds enumeration; the alternative — one generic error — would leave a third friend trying to join a dyad with no idea why it failed. If that trade-off is unacceptable later, collapse both into `room_unavailable`.

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

Do not start until every Phase 2 check passes.

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
- **Retract:** either participant can soft-delete any memo in the room (`update memos set deleted_at = now()`). For a two-person space this is the whole moderation story; cleanup drops tombstones after 7 days.
- **Reply:** clicking a bubble sends a heart back over broadcast.

---

## Phase 4: Phone-Off Continuity

**Goal:** when both people have put the app away, the tank quietly gains nutrients.

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

- Both tabs visible → nutrients static.
- One tab hidden → still static.
- Both hidden → the live counter advances; on return, `nutrient_seconds` matches elapsed wall-clock time within a second or two.
- Rapid tab switching does not double-count or produce negative intervals.
- Both hidden for longer than the cap → exactly `MAX_AWAY_CREDIT_SECONDS` is credited, not the full elapsed time.
- A solo participant hiding and returning credits nothing.
- A direct client `update rooms set nutrient_seconds = 999999` fails on column privileges.

---

## Phase 5: AI Listener & PWA

### 1. Nudges (`gemini-3.5-flash-lite`)

```bash
npm install @google/genai
```

- **Model:** `gemini-3.5-flash-lite` is the cost-appropriate default for a one-sentence notification. `gemini-3.6-flash` is the upgrade if nudge quality turns out to matter more than cost. `gemini-flash-latest` exists as a floating alias — **do not use it here**, because a silent model change under a scheduled job is a debugging trap.
- **Verify the call shape before writing it.** Package (`@google/genai`) and model IDs above are current as of 2026-07, but the client surface has moved recently — the quickstart shows `ai.interactions.create({ model, input })`, whereas older tutorials use `models.generateContent`. Check [ai.google.dev/gemini-api/docs/quickstart](https://ai.google.dev/gemini-api/docs/quickstart) at implementation time rather than copying either from memory.
- **Route:** `app/api/nudge/route.ts`, server-side only, using `lib/supabase/admin.ts`.
- **Scheduling:** an API route does not fire on its own. Use **Vercel Cron** (`vercel.json`, once or twice daily) or `pg_cron` + `pg_net`. The draft's "run a cron job or scheduled function" left this ambiguous; pick one and write it down.
- **Auth:** verify `Authorization: Bearer ${CRON_SECRET}` and return 401 otherwise. An unauthenticated route that calls a paid API is a billing vulnerability.
- **Trigger:** rooms where `last_interaction_at < now() - interval '3 days'` **and** (`last_nudged_at` is null or older than the same window).
- **Idempotency:** set `last_nudged_at = now()` in the same transaction that sends. Cron delivery is at-least-once, so without this a retry double-nudges.
- **Prompt context:** pass both participants' `love_language` plus the current `tank_mood`, and ask for one short notification line (e.g. "Drop a small memo?"). Cap the output token limit low — the output is one sentence, and the cap is a hard spend ceiling.
- **Never send room content to the model.** Memo bodies are private between two people. The nudge only needs the love languages, the mood, and how long the tank has been quiet — send those, not the conversation.

**Love language capture:** `room_participants.love_language` exists in the schema but nothing populates it. Add a one-time prompt after a participant's first join — a four-or-five-option picker, skippable. The nudge prompt must handle nulls, since it will often have one participant's answer and not the other's, or neither.

### 2. PWA

- **Manifest:** `app/manifest.ts` with `display: 'standalone'`, icons, and theme colour matching the tank.
- **Service worker:** cache the shell only. Keep the aquarium online-only — a cached stale tank is worse than an honest offline state.
- **Push notifications:** a bigger lift than the draft implies. Web Push needs VAPID keys, a `web-push` server dependency, a `PushSubscription` stored per participant, and explicit permission. On iOS, Web Push works **only** when the PWA has been added to the Home Screen, and permission must be requested from a user gesture. Budget this as its own increment; if it slips, the nudge degrades to an in-app banner on next open.

### Phase 5 verification

- `curl` to `/api/nudge` without the secret returns 401.
- With the secret, a room idle >3 days produces exactly one nudge; calling twice in a row produces no second nudge.
- A room with one or both `love_language` values null still produces a sensible nudge.
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

## Deferred Increments

Not open questions — decided to be out of scope, with the constraint each one would relax.

| Increment | What has to change |
| --- | --- |
| Rooms of 3+ | Raise `ROOM_CAPACITY`; replace `peersRef.current[0]` with a deterministic neighbour ordering (a ring), so a fish traverses everyone rather than ping-ponging between two arbitrary devices. Phase 4's `away = total` also gets much harder to satisfy — consider a quorum instead. |
| Named accounts | Swap `signInAnonymously` for magic-link auth. All RLS stays as written, since it keys on `auth.uid()` either way; add an account-linking path so existing anonymous rooms survive the upgrade. |
| Fish variety, growth, breeding | `fish` gains species/age columns and a server-side growth tick, which means either `pg_cron` or deriving age from `created_at` at read time. Prefer the latter, for the same reason the nutrient score is derived. |
| Push notifications | See Phase 5. VAPID keys, per-participant subscriptions, and an iOS install requirement. |
