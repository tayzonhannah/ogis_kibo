// Phases 2-4 in a browser: two independent clients, one shared tank.
//
//   1. npm run dev
//   2. node scripts/e2e-handoff.mjs
//
// Two browser CONTEXTS, not two tabs: each context has its own storage, so each
// gets its own anonymous auth.uid() and therefore counts as a separate
// participant. Two tabs of one profile share an identity and would occupy a
// single room slot.
//
// The assertions read the canvas aria-label ("N fish on this screen"), which
// tracks the same state the render loop uses. No pixel reading.

import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.KIBO_BASE_URL ?? 'http://localhost:3000';

/**
 * Reads .env.local so the suite can query the database back, not just the DOM.
 *
 * DOM-only assertions are why a whole class of bug survived two phases: a write
 * with no visible effect is invisible to them. `void supabase.from(..).update(..)`
 * never sent its request, and nothing in this file could tell.
 *
 * Tolerates what dotenv tolerates — leading whitespace, an `export` prefix,
 * quotes — because a key indented by one space is still a key, and reporting it
 * as absent sends you looking in the wrong place.
 */
function readEnvLocal() {
  const out = {};
  try {
    const text = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([\w.-]+)\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      const quoted =
        v.length >= 2 &&
        ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")));
      out[m[1]] = quoted ? v.slice(1, -1) : v;
    }
  } catch {
    // Absent .env.local just means the read-back checks report themselves unmet.
  }
  return out;
}

const ENV = readEnvLocal();
const SUPABASE_URL = (ENV.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const SUPABASE_KEY = ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
// A narrow viewport keeps crossings quick: fish move at 52 and 38 CSS px/s, so
// a 420px-wide tank is crossed in roughly 8-11s rather than 25-35s at 1280px.
const VIEWPORT = { width: 420, height: 640 };

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) {
    console.log(`  [PASS] ${name}`);
    pass += 1;
  } else {
    console.log(`  [FAIL] ${name}`);
    if (detail) console.log(`         got: ${detail}`);
    fail += 1;
  }
};

/** Fish count from the canvas aria-label, or null if the canvas is absent. */
async function fishCount(page) {
  const canvas = page.locator('canvas');
  if ((await canvas.count()) === 0) return null;
  const label = await canvas.first().getAttribute('aria-label');
  const m = label?.match(/(\d+) fish/);
  if (m) return Number(m[1]);
  return /No fish/.test(label ?? '') ? 0 : null;
}

/**
 * Ambient effect counts from data-kibo-fx ("corals:bubbles:hearts"). The
 * warmth glow, memo bubbles and hearts are drawn straight to canvas, so this
 * attribute is the only way to observe them.
 */
async function fx(page) {
  const raw = await page.locator('canvas').first().getAttribute('data-kibo-fx');
  const [corals, bubbles, hearts] = (raw ?? '0:0:0').split(':').map(Number);
  return { corals, bubbles, hearts };
}

/**
 * Banked-plus-open nutrient seconds from the meter's data attribute. The meter
 * renders nothing at zero, which is the same reading as "nothing banked yet".
 */
async function nutrients(page) {
  const meter = page.locator('[data-kibo-nutrients]');
  if ((await meter.count()) === 0) return 0;
  return Number(await meter.first().getAttribute('data-kibo-nutrients'));
}

/**
 * Fakes looking away, and tells the page about it.
 *
 * document.hidden is not settable and headless Chromium keeps every page
 * visible, so the property is overridden and the event dispatched by hand. That
 * covers everything from useCoAway's listener inward - the browser's own
 * decision about when a tab counts as hidden is not ours to test.
 */
function setHidden(page, hidden) {
  return page.evaluate((isHidden) => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => isHidden,
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (isHidden ? 'hidden' : 'visible'),
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

/**
 * The page's Supabase access token, lifted out of its cookies.
 *
 * Cookies, not localStorage: the app uses @supabase/ssr's createBrowserClient,
 * which persists the session as `sb-<ref>-auth-token`, base64-prefixed and split
 * across `.0`/`.1` chunks once it outgrows one cookie.
 */
function sessionToken(page) {
  return page.evaluate(() => {
    const jar = {};
    for (const part of document.cookie.split('; ')) {
      const i = part.indexOf('=');
      if (i > 0) jar[part.slice(0, i)] = part.slice(i + 1);
    }
    const chunkIndex = (name) => {
      const m = name.match(/\.(\d+)$/);
      return m ? Number(m[1]) : -1;
    };
    const names = Object.keys(jar)
      .filter((k) => /^sb-.+-auth-token(\.\d+)?$/.test(k))
      .sort((a, b) => chunkIndex(a) - chunkIndex(b));
    if (names.length === 0) return null;

    let raw = decodeURIComponent(names.map((n) => jar[n]).join(''));
    if (raw.startsWith('base64-')) {
      try {
        raw = atob(raw.slice(7));
      } catch {
        return null;
      }
    }
    try {
      return JSON.parse(raw).access_token ?? null;
    } catch {
      return null;
    }
  });
}

/** auth.uid() for a token, read from the JWT's own claims. */
function userIdFromToken(token) {
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return claims.sub ?? null;
  } catch {
    return null;
  }
}

/**
 * Read-only PostgREST query as a given participant. Deliberately read-only: the
 * harness observes what the app did, it never stands in for the app. RLS still
 * applies, so a check can only assert on rows that participant may genuinely
 * see.
 */
async function dbRead(path, token) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !token) return { error: 'no db access' };
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
    });
    const text = await r.text();
    if (!r.ok) return { error: `${r.status} ${text}` };
    return { rows: JSON.parse(text) };
  } catch (cause) {
    return { error: String(cause) };
  }
}

/** The single room this participant can see. RLS makes the lookup unambiguous. */
async function roomRow(token, select) {
  const { rows } = await dbRead(`rooms?select=${select}`, token);
  return Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
}

async function participantRow(token, userId, select) {
  const { rows } = await dbRead(
    `room_participants?select=${select}&user_id=eq.${userId}`,
    token
  );
  return Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
}

/** Press and hold, for the retract gesture. Tap is a click; this is not. */
async function longPress(page, x, y, ms) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await new Promise((r) => setTimeout(r, ms));
  await page.mouse.up();
}

/** Poll until predicate(value) or timeout. Returns the last value seen. */
async function waitFor(fn, predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await fn();
    if (predicate(last)) return last;
    await new Promise((r) => setTimeout(r, 400));
  }
  if (label) console.log(`         (timed out waiting for ${label}, last=${last})`);
  return last;
}

const browser = await chromium.launch();
const errors = [];

// Set once A exists; the read-back checks degrade to explicit failures without
// them rather than silently passing.
let tokenA = null;
let uidA = null;
let canRead = false;

async function newClient(name) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`);
  });
  return { context, page };
}

try {
  console.log('=== 1. Client A opens a tank');
  const A = await newClient('A');
  await A.page.goto(BASE, { waitUntil: 'domcontentloaded' });

  const openButton = A.page.getByRole('button', { name: /open a new tank/i });
  // If auth never resolves the button stays disabled - this is exactly the
  // StrictMode deadlock that left the app stuck on "Filling the tank".
  const enabled = await waitFor(
    () => openButton.isEnabled(),
    (v) => v === true,
    20_000,
    'the create button to enable (auth to resolve)'
  );
  check('anonymous auth resolves and enables the create button', enabled === true);
  if (!enabled) throw new Error('auth never resolved; aborting');

  await openButton.click();
  await A.page.waitForURL(/\/room\/[A-Z0-9]{8}$/, { timeout: 20_000 });
  const code = A.page.url().split('/').pop();
  console.log(`         code = ${code}`);
  check('create_room navigated to /room/CODE', /^[A-Z0-9]{8}$/.test(code ?? ''), code);

  const aFish = await waitFor(() => fishCount(A.page), (v) => v === 2, 25_000, 'A to hold 2 fish');
  check('A renders the tank with its 2 seeded fish', aFish === 2, String(aFish));
  check(
    'A is alone before the partner joins',
    (await A.page.getByText('on your own').count()) === 1
  );

  console.log('\n=== 2. Client B joins the same tank');
  const B = await newClient('B');
  await B.page.goto(`${BASE}/room/${code}`, { waitUntil: 'domcontentloaded' });

  const bJoined = await waitFor(
    async () => (await B.page.locator('canvas').count()) > 0,
    (v) => v === true,
    25_000,
    'B to finish joining'
  );
  check('B joined and rendered a canvas (not stuck on "Filling the tank")', bJoined === true);
  if (!bJoined) {
    const body = (await B.page.textContent('body'))?.slice(0, 200);
    console.log(`         B page text: ${body}`);
    throw new Error('B never joined; aborting');
  }

  console.log('\n=== 3. Presence');
  const aTogether = await waitFor(
    () => A.page.getByText('together').count(),
    (v) => v === 1,
    20_000,
    'A to see B'
  );
  check('A sees the partner as present', aTogether === 1);
  const bTogether = await waitFor(
    () => B.page.getByText('together').count(),
    (v) => v === 1,
    20_000,
    'B to see A'
  );
  check('B sees the partner as present', bTogether === 1);

  console.log('\n=== 3b. The suite can read the database back');
  tokenA = await sessionToken(A.page);
  uidA = tokenA ? userIdFromToken(tokenA) : null;
  check(
    "A's session token was recovered from its cookies",
    typeof tokenA === 'string' && tokenA.length > 40,
    tokenA ? `${tokenA.length} chars` : 'null'
  );
  check('the token resolves to an auth.uid()', typeof uidA === 'string', String(uidA));
  const probe = await roomRow(tokenA, 'id,last_interaction_at');
  check(
    'a read-back query returns exactly the one room A belongs to',
    probe !== null,
    JSON.stringify(probe)
  );
  canRead = probe !== null && typeof uidA === 'string';
  if (!canRead) {
    console.log('         (read-back checks below will report themselves unmet)');
  }

  console.log('\n=== 3c. The heartbeat actually writes (it did not, until it was fixed)');
  if (!canRead) {
    check('heartbeat advances last_seen_at', false, 'no db access');
  } else {
    const before = (await participantRow(tokenA, uidA, 'user_id,last_seen_at'))
      ?.last_seen_at;
    // beat() is bound to visibilitychange, so dispatching one is the cheap way
    // to trigger it — waiting out HEARTBEAT_MS would cost a minute, and the
    // mount beat is indistinguishable from join_room's own last_seen_at write.
    await A.page.evaluate(() =>
      document.dispatchEvent(new Event('visibilitychange'))
    );
    const after = await waitFor(
      async () => (await participantRow(tokenA, uidA, 'user_id,last_seen_at'))?.last_seen_at,
      (v) => v !== before,
      15_000,
      'last_seen_at to advance'
    );
    check('heartbeat advances last_seen_at', after !== before, `${before} -> ${after}`);
  }

  console.log('\n=== 4. Fish crosses from A to B');
  // Only the HOLDER simulates a fish, and requestAnimationFrame is paused in a
  // backgrounded tab -- so the holder must be foregrounded or nothing moves and
  // no handoff ever fires. Receiving is unaffected: adoption happens in a
  // realtime callback, not in the render loop. Without these bringToFront calls
  // the suite is intermittently green depending on which page had focus last.
  await A.page.bringToFront();
  const bGot = await waitFor(
    () => fishCount(B.page),
    (v) => typeof v === 'number' && v >= 1,
    45_000,
    'a fish to arrive on B'
  );
  check('a fish arrived on B', typeof bGot === 'number' && bGot >= 1, String(bGot));

  // Eventually consistent: B adopts from the broadcast before A's holder write
  // resolves, so A's count drops slightly later. Wait for it rather than
  // asserting the invariant instantaneously.
  const aAfter = await waitFor(
    () => fishCount(A.page),
    (v) => typeof v === 'number' && v < 2,
    15_000,
    'A to release the handed-off fish'
  );
  check(
    'the fish left A rather than being duplicated',
    typeof aAfter === 'number' && aAfter < 2,
    `A=${aAfter} B=${bGot}`
  );
  const total = (aAfter ?? 0) + (bGot ?? 0);
  check('no fish were lost or cloned (A + B == 2)', total === 2, `A+B=${total}`);

  console.log('\n=== 5. Fish crosses back to A');
  await B.page.bringToFront(); // B now holds it, so B must be the one running
  const returned = await waitFor(
    () => fishCount(A.page),
    (v) => typeof v === 'number' && v >= (aAfter ?? 0) + 1,
    45_000,
    'a fish to come back to A'
  );
  check(
    'handoff works in both directions',
    typeof returned === 'number' && returned > (aAfter ?? 0),
    `A was ${aAfter}, now ${returned}`
  );

  console.log('\n=== 5b. Warmth reaches the other screen');
  // Captured before the click: warmth also calls touch_room(), and Phase 5's
  // nudge scheduler triggers on last_interaction_at. That RPC was silently dead
  // for a whole phase, so it gets read back rather than assumed.
  const idleBefore = canRead
    ? (await roomRow(tokenA, 'id,last_interaction_at'))?.last_interaction_at
    : null;
  await A.page.getByRole('button', { name: /send warmth/i }).click();
  const bCoral = await waitFor(
    async () => (await fx(B.page)).corals,
    (v) => v >= 1,
    15_000,
    "A's warmth to appear on B"
  );
  check('warmth sent by A renders on B', bCoral >= 1, `corals=${bCoral}`);
  const aCoral = (await fx(A.page)).corals;
  check('the sender sees their own warmth too', aCoral >= 1, `corals=${aCoral}`);

  if (!canRead) {
    check('warmth bumps last_interaction_at via touch_room()', false, 'no db access');
  } else {
    const idleAfter = await waitFor(
      async () => (await roomRow(tokenA, 'id,last_interaction_at'))?.last_interaction_at,
      (v) => v !== idleBefore,
      15_000,
      'last_interaction_at to advance'
    );
    check(
      'warmth bumps last_interaction_at via touch_room()',
      idleAfter !== idleBefore,
      `${idleBefore} -> ${idleAfter}`
    );
  }

  console.log('\n=== 5c. Memo persists and reaches the other screen');
  const memoText = `hello from A ${Date.now() % 100000}`;
  await A.page.getByLabel(/leave a small memo/i).fill(memoText);
  await A.page.getByLabel(/leave a small memo/i).press('Enter');

  const bBubble = await waitFor(
    async () => (await fx(B.page)).bubbles,
    (v) => v >= 1,
    15_000,
    "A's memo to appear on B"
  );
  check('memo sent by A renders as a bubble on B', bBubble >= 1, `bubbles=${bBubble}`);
  check(
    'the memo input clears after sending',
    (await A.page.getByLabel(/leave a small memo/i).inputValue()) === '',
    'input still populated'
  );

  console.log('\n=== 5d. Tapping a memo sends a heart back');
  // Bubbles drift upward and sway, so aim using the live hit box the canvas
  // publishes rather than guessing a fixed point.
  const canvasBox = await B.page.locator('canvas').first().boundingBox();
  const aHearts = await waitFor(
    async () => {
      const raw = await B.page
        .locator('canvas')
        .first()
        .getAttribute('data-kibo-bubble');
      if (raw) {
        const [bx, by, bw, bh] = raw.split(',').map(Number);
        await B.page.mouse.click(
          canvasBox.x + bx + bw / 2,
          canvasBox.y + by + bh / 2
        );
      }
      return (await fx(A.page)).hearts;
    },
    (v) => v >= 1,
    20_000,
    'a heart from B to reach A'
  );
  check('tapping a memo on B sends a heart to A', aHearts >= 1, `hearts=${aHearts}`);

  console.log('\n=== 5e. Mood is shared state, not a broadcast');
  await A.page.getByRole('button', { name: /change the water/i }).click();
  await A.page.getByRole('radio', { name: /deep sea blue/i }).click();
  const bMood = await waitFor(
    () => B.page.getByRole('button', { name: /change the water/i }).getAttribute('title'),
    (v) => /deep sea blue/i.test(v ?? ''),
    15_000,
    "B to pick up A's mood change"
  );
  check('mood chosen on A propagates to B', /deep sea blue/i.test(bMood ?? ''), String(bMood));

  await B.page.reload({ waitUntil: 'domcontentloaded' });
  const moodAfterReload = await waitFor(
    () => B.page.getByRole('button', { name: /change the water/i }).getAttribute('title'),
    (v) => /deep sea blue/i.test(v ?? ''),
    25_000,
    'mood to survive a reload'
  );
  check(
    'mood survives a reload (it is a Postgres write, not a broadcast)',
    /deep sea blue/i.test(moodAfterReload ?? ''),
    String(moodAfterReload)
  );

  const memoAfterReload = await waitFor(
    async () => (await fx(B.page)).bubbles,
    (v) => v >= 1,
    25_000,
    'the memo backlog to load after reload'
  );
  check(
    'memos are still there after a reload (persisted, not just broadcast)',
    memoAfterReload >= 1,
    `bubbles=${memoAfterReload}`
  );

  console.log('\n=== 5f. Phone-off continuity (Phase 4)');
  // Server-side semantics - the cap, the solo case, the ledger's privileges -
  // are verified in scripts/verify-phase4.ps1. What is only observable here is
  // the client wiring: visibilitychange reaching hidden_since, and the credit
  // coming back through realtime into the meter.
  check('nothing is banked while both are looking', (await nutrients(A.page)) === 0);

  const idleBeforeAway = canRead
    ? (await roomRow(tokenA, 'id,last_interaction_at'))?.last_interaction_at
    : null;

  await setHidden(A.page, true);
  await setHidden(B.page, true);

  // The open interval is rendered, never written, so the counter has to advance
  // on its own once realtime says co_away_since opened.
  const ticking = await waitFor(
    () => nutrients(A.page),
    (v) => v >= 1,
    20_000,
    'the live counter to start advancing'
  );
  check('the counter advances while both are away', ticking >= 1, `${ticking}s`);

  const AWAY_MS = 5_000;
  await new Promise((r) => setTimeout(r, AWAY_MS));
  await setHidden(A.page, false);

  const banked = await waitFor(
    () => nutrients(A.page),
    (v) => v >= 3,
    20_000,
    'the away interval to be credited'
  );
  check(
    'both away then back credits roughly the time away',
    banked >= 3 && banked <= AWAY_MS / 1000 + 4,
    `${banked}s for a ~${AWAY_MS / 1000}s absence`
  );

  // A figure that has stopped moving is the observable difference between
  // "banked and the interval closed" and "still open and being rendered". If the
  // credit had never landed the meter would read 0 instead, since banked seconds
  // are all that is left once co_away_since clears.
  // Tolerates one second of drift, because the rendered open portion floors a
  // client clock while the credit is an integer from the server's - but an
  // interval still open would have grown by two or three by now.
  await new Promise((r) => setTimeout(r, 2_500));
  const settled = await nutrients(A.page);
  check(
    'the credit is banked and the interval closed (the figure stops moving)',
    // The >= 3 matters: without it a meter stuck at zero satisfies "unchanged"
    // and this check passes while nothing works at all. It did, once.
    settled >= 3 && settled >= banked && settled - banked <= 1,
    `${banked}s then ${settled}s`
  );

  // Assert B's meter BEFORE letting B come back: still away, so the only way it
  // can know the figure is the realtime rooms UPDATE. Unhiding first would let
  // the return-to-tab refetch answer instead, and the realtime path would go
  // untested.
  const bBanked = await waitFor(
    () => nutrients(B.page),
    (v) => v >= 3,
    20_000,
    'the credit to reach the other screen over realtime'
  );
  check('the credit reaches the other screen over realtime', bBanked >= 3, `${bBanked}s`);
  await setHidden(B.page, false);

  // The trigger bumps last_interaction_at when it banks — a different writer
  // from touch_room(), so it gets its own check.
  if (!canRead) {
    check('banking the credit also bumps last_interaction_at', false, 'no db access');
  } else {
    const row = await roomRow(tokenA, 'id,last_interaction_at,nutrient_seconds,co_away_since');
    check(
      'banking the credit also bumps last_interaction_at',
      row?.last_interaction_at !== idleBeforeAway,
      `${idleBeforeAway} -> ${row?.last_interaction_at}`
    );
    check(
      'the ledger really is banked server-side, not just rendered',
      (row?.nutrient_seconds ?? 0) >= 3 && row?.co_away_since === null,
      JSON.stringify(row)
    );
  }

  console.log('\n=== 5g. Hold a memo to retract it, tap still sends a heart');
  // Baselines BEFORE sending, and the wait is for an INCREASE.
  //
  // Waiting for `bubbles >= 1` instead was satisfied instantly by the memo still
  // drifting from 5c, so the press landed on that one and retracted the wrong
  // memo — while the counts stayed at 1 and read as "nothing happened". The app
  // was right; the assertion was aiming at whatever happened to be on screen.
  const baseB = (await fx(B.page)).bubbles;
  const baseA = (await fx(A.page)).bubbles;

  const retractText = `retract me ${Date.now() % 100000}`;
  await A.page.getByLabel(/leave a small memo/i).fill(retractText);
  await A.page.getByLabel(/leave a small memo/i).press('Enter');

  const bubblesBeforeB = await waitFor(
    async () => (await fx(B.page)).bubbles,
    (v) => v > baseB,
    15_000,
    "the new memo to reach B so B can retract A's memo"
  );
  check(
    "A's new memo reached B (so the press aims at the newest bubble)",
    bubblesBeforeB > baseB,
    `${baseB} -> ${bubblesBeforeB}`
  );
  const bubblesBeforeA = await waitFor(
    async () => (await fx(A.page)).bubbles,
    (v) => v > baseA,
    15_000,
    "the new memo to render on its author's screen"
  );

  // B retracts A's memo: the policy allows either participant to retract either
  // person's memo, and the gesture is offered to both.
  const bBox = await B.page.locator('canvas').first().getAttribute('data-kibo-bubble');
  const bCanvasBox = await B.page.locator('canvas').first().boundingBox();
  check('B has a bubble hit box to aim at', Boolean(bBox), String(bBox));

  if (bBox) {
    const [bx, by, bw, bh] = bBox.split(',').map(Number);
    // 900ms: comfortably past RETRACT_HOLD_MS (700) without being so long that a
    // passing test tells us nothing about the threshold.
    await longPress(
      B.page,
      bCanvasBox.x + bx + bw / 2,
      bCanvasBox.y + by + bh / 2,
      900
    );

    const bubblesAfterB = await waitFor(
      async () => (await fx(B.page)).bubbles,
      (v) => v < bubblesBeforeB,
      15_000,
      'the retracted bubble to leave B'
    );
    check(
      'holding a memo retracts it on the retracting screen',
      bubblesAfterB < bubblesBeforeB,
      `${bubblesBeforeB} -> ${bubblesAfterB}`
    );

    const bubblesAfterA = await waitFor(
      async () => (await fx(A.page)).bubbles,
      (v) => v < bubblesBeforeA,
      15_000,
      'the retraction to reach the author'
    );
    check(
      'the retraction reaches the other screen',
      bubblesAfterA < bubblesBeforeA,
      `${bubblesBeforeA} -> ${bubblesAfterA}`
    );

    if (!canRead) {
      check('the memo is soft-deleted, not just hidden locally', false, 'no db access');
    } else {
      // The read policy hides retracted memos, so a member's own SELECT is the
      // honest test: exactly one of this run's two memos should remain.
      const { rows } = await dbRead('memos?select=id,body', tokenA);
      const bodies = Array.isArray(rows) ? rows.map((m) => m.body) : [];
      check(
        'the retracted memo is gone from the room for good',
        !bodies.includes(retractText) && bodies.length >= 1,
        JSON.stringify(bodies)
      );
    }

    // A reload is the real proof it was persisted rather than removed on screen.
    // Assert the exact backlog size, not ">= 1": a surviving memo satisfies
    // ">= 1" even if the retracted one comes back alongside it, which is the one
    // failure this check exists to catch.
    const { rows: liveMemos } = canRead
      ? await dbRead('memos?select=id', tokenA)
      : { rows: null };
    const expected = Array.isArray(liveMemos) ? Math.min(liveMemos.length, 5) : null;

    await B.page.reload({ waitUntil: 'domcontentloaded' });
    await B.page.locator('canvas').first().waitFor({ timeout: 30_000 });
    const afterReload = await waitFor(
      async () => (await fx(B.page)).bubbles,
      (v) => (expected === null ? v >= 1 : v === expected),
      25_000,
      'the backlog to reload without the retracted memo'
    );
    check(
      'the retracted memo does not come back on reload, the surviving one does',
      expected === null ? afterReload >= 1 : afterReload === expected,
      `bubbles=${afterReload}, live memos=${expected}`
    );
  }

  console.log('\n=== 6. B leaves: no fish is stranded');
  // B is visible here, so this is a departure with no preceding hidden report —
  // exactly the case the pagehide beacon exists for.
  const uidB = tokenA
    ? await sessionToken(B.page).then((t) => (t ? userIdFromToken(t) : null))
    : null;

  // page.close(), NOT context.close(). Closing the context tears down the
  // browsing context's network stack along with the page, so a keepalive fetch
  // has nowhere to complete and the beacon is lost — which looks exactly like a
  // broken beacon. Closing the page leaves the context alive to finish the
  // request, and is also the more faithful model of a person closing one tab.
  await B.page.close();
  // Presence empties, then the remaining client claims anything held by the
  // departed partner (3s debounce in Aquarium.tsx).
  const reclaimed = await waitFor(
    () => fishCount(A.page),
    (v) => v === 2,
    30_000,
    'A to reclaim all fish'
  );
  check('A reclaims the stranded fish (all 2 back)', reclaimed === 2, String(reclaimed));
  const aloneAgain = await waitFor(
    () => A.page.getByText('on your own').count(),
    (v) => v === 1,
    20_000,
    'A to show alone again'
  );
  check('A shows "on your own" after B leaves', aloneAgain === 1);

  // The unload beacon: B was visible when its page closed, so the ONLY way
  // hidden_since can be set is the pagehide keepalive fetch. A plain
  // supabase-js call is cancelled by the browser during unload.
  if (!canRead || !uidB) {
    check("the unload beacon recorded B's departure", false, 'no db access');
  } else {
    const bRow = await waitFor(
      () => participantRow(tokenA, uidB, 'user_id,hidden_since'),
      (r) => Boolean(r?.hidden_since),
      15_000,
      "B's hidden_since to be set by the beacon"
    );
    check(
      "the unload beacon recorded B's departure",
      Boolean(bRow?.hidden_since),
      JSON.stringify(bRow)
    );
  }

  console.log('\n=== 7. Solo: fish reflect instead of vanishing');
  await A.page.bringToFront();
  await new Promise((r) => setTimeout(r, 20_000));
  const soloFish = await fishCount(A.page);
  check(
    'both fish still present after 20s alone (reflecting off the edges)',
    soloFish === 2,
    String(soloFish)
  );

  console.log('\n=== 8. Reload is non-destructive');
  await A.page.reload({ waitUntil: 'domcontentloaded' });
  const afterReload = await waitFor(
    () => fishCount(A.page),
    (v) => v === 2,
    30_000,
    'fish to come back after reload'
  );
  check('fish recovered after a page reload', afterReload === 2, String(afterReload));

  await A.context.close();
} catch (e) {
  console.log(`\n[ABORTED] ${e.message}`);
  fail += 1;
} finally {
  await browser.close();
}

if (errors.length) {
  console.log('\n--- browser errors observed:');
  for (const e of [...new Set(errors)].slice(0, 15)) console.log(`    ${e}`);
}

console.log('\n======================================');
console.log(`PASS: ${pass}   FAIL: ${fail}`);
console.log(
  fail > 0
    ? 'RESULT: problems found'
    : 'RESULT: handoff, ambient interactions and phone-off continuity verified'
);
process.exit(fail > 0 ? 1 : 0);
