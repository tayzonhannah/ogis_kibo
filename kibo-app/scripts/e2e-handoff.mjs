// Phase 2 verification: two independent clients, one shared tank.
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

import { chromium } from 'playwright';

const BASE = process.env.KIBO_BASE_URL ?? 'http://localhost:3000';
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

  console.log('\n=== 4. Fish crosses from A to B');
  const bGot = await waitFor(
    () => fishCount(B.page),
    (v) => typeof v === 'number' && v >= 1,
    45_000,
    'a fish to arrive on B'
  );
  check('a fish arrived on B', typeof bGot === 'number' && bGot >= 1, String(bGot));

  const aAfter = await fishCount(A.page);
  check(
    'the fish left A rather than being duplicated',
    typeof aAfter === 'number' && aAfter < 2,
    `A=${aAfter} B=${bGot}`
  );
  const total = (aAfter ?? 0) + (bGot ?? 0);
  check('no fish were lost or cloned (A + B == 2)', total === 2, `A+B=${total}`);

  console.log('\n=== 5. Fish crosses back to A');
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

  console.log('\n=== 6. B leaves: no fish is stranded');
  await B.context.close();
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

  console.log('\n=== 7. Solo: fish reflect instead of vanishing');
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
console.log(fail > 0 ? 'RESULT: problems found' : 'RESULT: Phase 2 handoff verified');
process.exit(fail > 0 ? 1 : 0);
