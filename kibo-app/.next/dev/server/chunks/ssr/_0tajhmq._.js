module.exports = [
"[project]/lib/constants.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Tuning knobs. These mirror values enforced in
 * supabase/migrations/0001_phase1_rooms_and_fish.sql — change both together.
 */ /** Enforced in join_room(). The handoff code assumes exactly one peer. */ __turbopack_context__.s([
    "CODE_ALPHABET",
    ()=>CODE_ALPHABET,
    "CODE_LENGTH",
    ()=>CODE_LENGTH,
    "FISH_MARGIN",
    ()=>FISH_MARGIN,
    "HEARTBEAT_MS",
    ()=>HEARTBEAT_MS,
    "HEART_LIFETIME_MS",
    ()=>HEART_LIFETIME_MS,
    "MAX_AWAY_CREDIT_SECONDS",
    ()=>MAX_AWAY_CREDIT_SECONDS,
    "MAX_BUBBLES",
    ()=>MAX_BUBBLES,
    "MAX_CORALS",
    ()=>MAX_CORALS,
    "MAX_HEARTS",
    ()=>MAX_HEARTS,
    "MEMO_BACKLOG",
    ()=>MEMO_BACKLOG,
    "MEMO_LIFETIME_MS",
    ()=>MEMO_LIFETIME_MS,
    "MEMO_MAX_LEN",
    ()=>MEMO_MAX_LEN,
    "MOOD_FADE_MS",
    ()=>MOOD_FADE_MS,
    "ROOM_CAPACITY",
    ()=>ROOM_CAPACITY,
    "TANK_MOODS",
    ()=>TANK_MOODS,
    "TANK_MOOD_GRADIENT",
    ()=>TANK_MOOD_GRADIENT,
    "TANK_MOOD_LABELS",
    ()=>TANK_MOOD_LABELS,
    "WARMTH_COOLDOWN_MS",
    ()=>WARMTH_COOLDOWN_MS,
    "WARMTH_LIFETIME_MS",
    ()=>WARMTH_LIFETIME_MS,
    "isPlausibleCode",
    ()=>isPlausibleCode,
    "normalizeCode",
    ()=>normalizeCode
]);
const ROOM_CAPACITY = 2;
const CODE_LENGTH = 8;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const HEARTBEAT_MS = 60_000;
const MEMO_MAX_LEN = 140;
const MAX_AWAY_CREDIT_SECONDS = 28_800;
const FISH_MARGIN = 40;
const WARMTH_LIFETIME_MS = 5_000;
const MEMO_LIFETIME_MS = 40_000;
const HEART_LIFETIME_MS = 2_200;
const MOOD_FADE_MS = 2_000;
const WARMTH_COOLDOWN_MS = 3_000;
const MAX_CORALS = 12;
const MAX_BUBBLES = 6;
const MAX_HEARTS = 20;
const MEMO_BACKLOG = 5;
const TANK_MOODS = [
    'calm',
    'deep',
    'bright',
    'murky',
    'warm'
];
const TANK_MOOD_LABELS = {
    calm: 'Calm',
    deep: 'Deep Sea Blue',
    bright: 'Bright Shallows',
    murky: 'Murky',
    warm: 'Warm Current'
};
const TANK_MOOD_GRADIENT = {
    calm: [
        '#0f2c3f',
        '#081a26'
    ],
    deep: [
        '#0a1b3d',
        '#04091a'
    ],
    bright: [
        '#1c5570',
        '#0d3247'
    ],
    murky: [
        '#243528',
        '#0e1711'
    ],
    warm: [
        '#3d2a1f',
        '#1a0f0a'
    ]
};
function normalizeCode(input) {
    return input.trim().toUpperCase();
}
function isPlausibleCode(input) {
    const code = normalizeCode(input);
    if (code.length !== CODE_LENGTH) return false;
    return [
        ...code
    ].every((char)=>CODE_ALPHABET.includes(char));
}
}),
"[project]/components/Aquarium.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Aquarium
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/constants.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
/** How long presence must report an empty room before we claim its fish. */ const ALONE_CLAIM_DELAY_MS = 3_000;
function hexToRgb(hex) {
    const v = hex.replace('#', '');
    return [
        parseInt(v.slice(0, 2), 16),
        parseInt(v.slice(2, 4), 16),
        parseInt(v.slice(4, 6), 16)
    ];
}
const lerp = (a, b, t)=>a + (b - a) * t;
const lerpRgb = (a, b, t)=>[
        lerp(a[0], b[0], t),
        lerp(a[1], b[1], t),
        lerp(a[2], b[2], t)
    ];
const rgbCss = ([r, g, b])=>`rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
const moodStops = (mood)=>{
    const [top, bottom] = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TANK_MOOD_GRADIENT"][mood];
    return [
        hexToRgb(top),
        hexToRgb(bottom)
    ];
};
/** Stable pseudo-random in [0,1) from an id, so placement survives a reload. */ function hashUnit(id, salt = 0) {
    let h = 2166136261 ^ salt;
    for(let i = 0; i < id.length; i += 1){
        h ^= id.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % 10000 / 10000;
}
const bobPhaseFor = (id)=>hashUnit(id, 7) * 6.283;
/** Eased 0->1->0 envelope: fade in, hold, fade out. */ function envelope(age, life, fadeIn = 0.15, fadeOut = 0.3) {
    const t = age / life;
    if (t <= 0) return 0;
    if (t >= 1) return 0;
    if (t < fadeIn) return t / fadeIn;
    if (t > 1 - fadeOut) return (1 - t) / fadeOut;
    return 1;
}
function wrapText(ctx, text, maxWidth) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    for (const word of words){
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > maxWidth && line) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }
    }
    if (line) lines.push(line);
    return lines.slice(0, 5);
}
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
function drawFish(ctx, fish, height, seconds) {
    const bob = Math.sin(seconds * 1.1 + fish.bobPhase) * 5;
    const y = fish.yFrac * height + bob;
    ctx.save();
    ctx.translate(fish.x, y);
    ctx.scale(fish.direction, 1);
    const sweep = Math.sin(seconds * 5 + fish.bobPhase) * 4;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(-30, -9 + sweep);
    ctx.lineTo(-30, 9 + sweep);
    ctx.closePath();
    ctx.fillStyle = fish.color;
    ctx.globalAlpha = 0.75;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = fish.color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10, -2.5, 1.9, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8, 26, 38, 0.85)';
    ctx.fill();
    ctx.restore();
}
function drawCoral(ctx, coral, width, height, now, seconds) {
    const alpha = envelope(now - coral.bornAt, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["WARMTH_LIFETIME_MS"], 0.2, 0.45);
    if (alpha <= 0) return;
    const x = coral.xFrac * width;
    const base = height - 6;
    ctx.save();
    ctx.globalAlpha = alpha;
    const glow = ctx.createRadialGradient(x, base, 2, x, base, 90);
    glow.addColorStop(0, 'rgba(255, 196, 140, 0.55)');
    glow.addColorStop(1, 'rgba(255, 196, 140, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 90, base - 90, 180, 96);
    // A few fronds, swaying gently.
    ctx.strokeStyle = 'rgba(255, 210, 165, 0.85)';
    ctx.lineCap = 'round';
    for(let i = -1; i <= 1; i += 1){
        const sway = Math.sin(seconds * 1.4 + i) * 6;
        ctx.lineWidth = 3.5 - Math.abs(i);
        ctx.beginPath();
        ctx.moveTo(x + i * 11, base);
        ctx.quadraticCurveTo(x + i * 14 + sway, base - 26, x + i * 9 + sway, base - 46);
        ctx.stroke();
    }
    ctx.restore();
}
function drawBubble(ctx, bubble, width, height, now, seconds) {
    const age = now - bubble.bornAt;
    const alpha = envelope(age, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MEMO_LIFETIME_MS"], 0.04, 0.25);
    if (alpha <= 0) {
        bubble.hit = null;
        return;
    }
    // Drifts upward over its life, with a slow sway.
    const rise = age / __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MEMO_LIFETIME_MS"] * height * 0.28;
    const sway = Math.sin(seconds * 0.6 + bubble.swayPhase) * 10;
    const cx = bubble.xFrac * width + sway;
    const cy = bubble.yFrac * height - rise;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '13px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    const maxW = Math.min(width * 0.62, 230);
    const lines = wrapText(ctx, bubble.body, maxW - 24);
    const textW = Math.max(...lines.map((l)=>ctx.measureText(l).width));
    const w = Math.min(maxW, textW + 24);
    const h = lines.length * 18 + 18;
    const x = Math.max(8, Math.min(width - w - 8, cx - w / 2));
    const y = Math.max(8, cy - h / 2);
    roundRect(ctx, x, y, w, h, 14);
    ctx.fillStyle = 'rgba(233, 244, 248, 0.93)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(10, 32, 45, 0.92)';
    lines.forEach((line, i)=>ctx.fillText(line, x + 12, y + 9 + i * 18));
    ctx.restore();
    bubble.hit = {
        x,
        y,
        w,
        h
    };
}
function drawHeart(ctx, heart, width, height, now) {
    const age = now - heart.bornAt;
    const alpha = envelope(age, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["HEART_LIFETIME_MS"], 0.1, 0.55);
    if (alpha <= 0) return;
    const x = heart.xFrac * width;
    const y = heart.yFrac * height - age / __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["HEART_LIFETIME_MS"] * 70;
    const s = 9;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(255, 140, 160, 0.95)';
    ctx.beginPath();
    ctx.moveTo(0, s * 0.75);
    ctx.bezierCurveTo(-s, -s * 0.2, -s * 0.5, -s, 0, -s * 0.4);
    ctx.bezierCurveTo(s * 0.5, -s, s, -s * 0.2, 0, s * 0.75);
    ctx.fill();
    ctx.restore();
}
function Aquarium({ supabase, roomId, userId, mood = 'calm', onPeerChange, onChannelReady, onRoomUpdate }) {
    const canvasRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const fishRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])([]);
    const coralsRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])([]);
    const bubblesRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])([]);
    const heartsRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])([]);
    /** Ids to drop on the next frame: handoff confirmed, or ownership revoked. */ const pendingRemovalRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(new Set());
    const peersRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])([]);
    const channelRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const moodFadeRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])({
        from: moodStops(mood),
        to: moodStops(mood),
        startedAt: 0
    });
    const paintedRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(moodStops(mood));
    const [fishCount, setFishCount] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(0);
    /**
   * "corals:bubbles:hearts" — the only readable signal for the ambient layer,
   * which is otherwise pure canvas pixels. Surfaced as a data attribute so the
   * E2E suite can assert that one client's warmth actually reaches the other.
   * Throttled, because it changes inside the render loop.
   */ const [fx, setFx] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('0:0:0');
    const fxRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])('0:0:0');
    /**
   * "x,y,w,h" of the topmost tappable memo bubble, in CSS px. Bubbles drift, so
   * without this a test (or any automation) has to guess where to click.
   */ const [bubbleBox, setBubbleBox] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('');
    const bubbleBoxRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])('');
    // Cross-fade from whatever is on screen right now, so a mood change during
    // an earlier fade does not snap.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        moodFadeRef.current = {
            from: [
                paintedRef.current[0],
                paintedRef.current[1]
            ],
            to: moodStops(mood),
            startedAt: performance.now()
        };
    }, [
        mood
    ]);
    /**
   * Count of fish this screen is actually drawing — excludes any mid-handoff.
   * A fish in flight has already stopped being rendered here but stays in the
   * array until its holder write is confirmed, so counting it would claim the
   * fish is on two screens at once during that window.
   *
   * Called at every mutation point rather than from the render loop, because a
   * backgrounded tab still adopts fish (realtime callbacks keep firing) even
   * though requestAnimationFrame is paused.
   */ const syncFishCount = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        setFishCount(fishRef.current.filter((fish)=>!fish.handingOff).length);
    }, []);
    // ------------------------------------------------ realtime + reconciliation
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        let active = true;
        let aloneTimer = null;
        const adopt = (fish)=>{
            // Dedupe across broadcast / postgres_changes / recovery. adopt() pushes
            // synchronously and JS is single-threaded, so whichever signal lands
            // first always wins and the others see it here.
            if (fishRef.current.some((existing)=>existing.id === fish.id)) return;
            pendingRemovalRef.current.delete(fish.id);
            const width = canvasRef.current?.clientWidth ?? 0;
            fishRef.current.push({
                id: fish.id,
                x: fish.direction === 1 ? -__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["FISH_MARGIN"] : width + __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["FISH_MARGIN"],
                yFrac: fish.y_frac,
                speedPxS: fish.speed_px_s,
                direction: fish.direction,
                color: fish.color,
                bobPhase: bobPhaseFor(fish.id),
                handingOff: false
            });
            syncFishCount();
        };
        const addCoral = (id, xFrac)=>{
            if (coralsRef.current.some((c)=>c.id === id)) return;
            coralsRef.current.push({
                id,
                xFrac,
                bornAt: performance.now()
            });
            if (coralsRef.current.length > __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MAX_CORALS"]) coralsRef.current.shift();
        };
        const addBubble = (id, body, xFrac, yFrac)=>{
            if (bubblesRef.current.some((b)=>b.id === id)) return;
            bubblesRef.current.push({
                id,
                body,
                xFrac,
                yFrac,
                bornAt: performance.now(),
                swayPhase: hashUnit(id, 3) * 6.283,
                hit: null
            });
            if (bubblesRef.current.length > __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MAX_BUBBLES"]) bubblesRef.current.shift();
        };
        const addHeart = (id, xFrac, yFrac)=>{
            if (heartsRef.current.some((h)=>h.id === id)) return;
            heartsRef.current.push({
                id,
                xFrac,
                yFrac,
                bornAt: performance.now()
            });
            if (heartsRef.current.length > __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MAX_HEARTS"]) heartsRef.current.shift();
        };
        /**
     * Pick up anything released by a departed participant, then load
     * everything we hold. This is what makes a refresh non-destructive.
     */ const recover = async ()=>{
            await supabase.from('fish').update({
                holder: userId
            }).eq('room_id', roomId).is('holder', null);
            const { data } = await supabase.from('fish').select('*').eq('room_id', roomId).eq('holder', userId);
            if (!active) return;
            data?.forEach(adopt);
        };
        /** Recent memos become bubbles, so arriving later still shows you them. */ const loadMemos = async ()=>{
            const { data } = await supabase.from('memos').select('id, body, created_at').eq('room_id', roomId).order('created_at', {
                ascending: false
            }).limit(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MEMO_BACKLOG"]);
            if (!active) return;
            const rows = data ?? [];
            // Oldest first, so the newest ends up nearest the bottom.
            [
                ...rows
            ].reverse().forEach((m)=>{
                addBubble(m.id, m.body, 0.25 + hashUnit(m.id) * 0.5, 0.55 + hashUnit(m.id, 1) * 0.3);
            });
        };
        /**
     * Presence says we are alone, so any fish still assigned to the absent
     * partner would be stranded — nobody is simulating it. Claim the room.
     * Debounced, because a momentary websocket blip also empties presence.
     */ const claimStranded = async ()=>{
            if (peersRef.current.length > 0) return;
            await supabase.from('fish').update({
                holder: userId
            }).eq('room_id', roomId).or(`holder.is.null,holder.neq.${userId}`);
            if (active) await recover();
        };
        const channel = supabase.channel(`room:${roomId}`, {
            // self: true so a sender also sees its own warmth / memo / heart. The
            // FISH_CROSS handler filters on toUser, so it is unaffected.
            config: {
                presence: {
                    key: userId
                },
                broadcast: {
                    self: true
                }
            }
        });
        channelRef.current = channel;
        onChannelReady?.(channel);
        channel.on('presence', {
            event: 'sync'
        }, ()=>{
            const peers = Object.keys(channel.presenceState()).filter((id)=>id !== userId);
            peersRef.current = peers;
            onPeerChange?.(peers.length > 0);
            if (aloneTimer) {
                clearTimeout(aloneTimer);
                aloneTimer = null;
            }
            if (peers.length === 0) {
                aloneTimer = setTimeout(()=>void claimStranded(), ALONE_CLAIM_DELAY_MS);
            }
        }).on('broadcast', {
            event: 'FISH_CROSS'
        }, ({ payload })=>{
            const crossing = payload;
            if (crossing.toUser !== userId) return;
            adopt({
                id: crossing.fishId,
                y_frac: crossing.y_frac,
                speed_px_s: crossing.speed_px_s,
                direction: crossing.direction,
                color: crossing.color
            });
        }).on('broadcast', {
            event: 'WARMTH_SENT'
        }, ({ payload })=>{
            const warmth = payload;
            addCoral(warmth.id, warmth.xFrac);
        }).on('broadcast', {
            event: 'MEMO_SENT'
        }, ({ payload })=>{
            const memo = payload;
            addBubble(memo.id, memo.body, memo.xFrac, memo.yFrac);
        }).on('broadcast', {
            event: 'HEART_SENT'
        }, ({ payload })=>{
            const heart = payload;
            addHeart(heart.id, heart.xFrac, heart.yFrac);
        }).on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'fish',
            filter: `room_id=eq.${roomId}`
        }, (payload)=>{
            const row = payload.new;
            if (row.holder === userId) {
                adopt(row);
                return;
            }
            // Postgres is authoritative in both directions: if a fish is no
            // longer ours, stop drawing it. Without this, a claim by the other
            // side would leave the same fish rendered on both screens.
            if (fishRef.current.some((fish)=>fish.id === row.id)) {
                pendingRemovalRef.current.add(row.id);
            }
        }).on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'rooms',
            filter: `id=eq.${roomId}`
        }, (payload)=>{
            onRoomUpdate?.(payload.new);
        }).on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'memos',
            filter: `room_id=eq.${roomId}`
        }, (payload)=>{
            // Safety net for a dropped MEMO_SENT broadcast, same split as fish.
            const row = payload.new;
            addBubble(row.id, row.body, 0.25 + hashUnit(row.id) * 0.5, 0.55 + hashUnit(row.id, 1) * 0.3);
        }).subscribe((status)=>{
            if (status !== 'SUBSCRIBED') return;
            void (async ()=>{
                await channel.track({
                    at: Date.now()
                });
                await recover();
                await loadMemos();
            })();
        });
        return ()=>{
            active = false;
            if (aloneTimer) clearTimeout(aloneTimer);
            channelRef.current = null;
            onChannelReady?.(null);
            void supabase.removeChannel(channel);
        };
    }, [
        supabase,
        roomId,
        userId,
        onPeerChange,
        onChannelReady,
        onRoomUpdate,
        syncFishCount
    ]);
    // ------------------------------------------------------------ canvas sizing
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const canvas = canvasRef.current;
        if (!canvas) return;
        const resize = ()=>{
            const dpr = window.devicePixelRatio || 1;
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;
            if (width === 0 || height === 0) return;
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            // setTransform rather than scale: resize fires repeatedly and scale
            // would compound.
            canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(canvas);
        return ()=>observer.disconnect();
    }, []);
    // --------------------------------------------- tap a memo to send a heart
    const handlePointerDown = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((event)=>{
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const px = event.clientX - rect.left;
        const py = event.clientY - rect.top;
        // Topmost (most recently added) bubble wins.
        for(let i = bubblesRef.current.length - 1; i >= 0; i -= 1){
            const b = bubblesRef.current[i];
            const hit = b.hit;
            if (!hit) continue;
            if (px >= hit.x && px <= hit.x + hit.w && py >= hit.y && py <= hit.y + hit.h) {
                const payload = {
                    id: `${b.id}:${Date.now()}`,
                    xFrac: (hit.x + hit.w / 2) / rect.width,
                    yFrac: hit.y / rect.height
                };
                void channelRef.current?.send({
                    type: 'broadcast',
                    event: 'HEART_SENT',
                    payload
                });
                return;
            }
        }
    }, []);
    // ------------------------------------------------------- render + handoff
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        let raf = 0;
        let last = performance.now();
        const start = last;
        let lastFxAt = 0;
        /**
     * Two-phase handoff. The fish is held locally, not removed, until the
     * `holder` write lands — so a failed write turns the fish around instead
     * of dropping it into nowhere.
     */ const handOff = async (fish, peer)=>{
            fish.handingOff = true;
            // We have stopped drawing it as of now, so stop counting it as of now.
            syncFishCount();
            const payload = {
                fishId: fish.id,
                y_frac: fish.yFrac,
                speed_px_s: fish.speedPxS,
                direction: fish.direction,
                color: fish.color,
                toUser: peer
            };
            // Fast path. Lossy by design; the write below is the truth.
            void channelRef.current?.send({
                type: 'broadcast',
                event: 'FISH_CROSS',
                payload
            });
            const { error } = await supabase.from('fish').update({
                holder: peer,
                direction: fish.direction,
                y_frac: fish.yFrac
            }).eq('id', fish.id);
            if (error) {
                // Keep the fish, turn it around, try again on the next lap.
                fish.handingOff = false;
                fish.direction = fish.direction * -1;
                syncFishCount();
                return;
            }
            pendingRemovalRef.current.add(fish.id);
        };
        const paintBackground = (width, height, now)=>{
            const fade = moodFadeRef.current;
            const t = fade.startedAt ? Math.min(1, (now - fade.startedAt) / __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MOOD_FADE_MS"]) : 1;
            const top = lerpRgb(fade.from[0], fade.to[0], t);
            const bottom = lerpRgb(fade.from[1], fade.to[1], t);
            paintedRef.current = [
                top,
                bottom
            ];
            const gradient = ctx.createLinearGradient(0, 0, 0, height);
            gradient.addColorStop(0, rgbCss(top));
            gradient.addColorStop(1, rgbCss(bottom));
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
        };
        const frame = (now)=>{
            // Clamp so a backgrounded tab doesn't teleport every fish on return.
            const dt = Math.min((now - last) / 1000, 0.1);
            last = now;
            const seconds = (now - start) / 1000;
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;
            paintBackground(width, height, now);
            // Warmth sits behind the fish, near the floor.
            coralsRef.current = coralsRef.current.filter((c)=>now - c.bornAt < __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["WARMTH_LIFETIME_MS"]);
            for (const coral of coralsRef.current){
                drawCoral(ctx, coral, width, height, now, seconds);
            }
            const pending = pendingRemovalRef.current;
            let removed = false;
            fishRef.current = fishRef.current.filter((fish)=>{
                if (pending.has(fish.id)) {
                    pending.delete(fish.id);
                    removed = true;
                    return false;
                }
                // In flight: hold it, but don't advance or draw it. This is also what
                // prevents a second handoff while the first write is outstanding.
                if (fish.handingOff) return true;
                fish.x += fish.speedPxS * fish.direction * dt;
                drawFish(ctx, fish, height, seconds);
                const exitedRight = fish.direction === 1 && fish.x > width + __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["FISH_MARGIN"];
                const exitedLeft = fish.direction === -1 && fish.x < -__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["FISH_MARGIN"];
                if (!exitedRight && !exitedLeft) return true;
                const peer = peersRef.current[0];
                if (!peer) {
                    // Nobody to receive it — reflect rather than lose the fish.
                    fish.direction = fish.direction * -1;
                    return true;
                }
                void handOff(fish, peer);
                return true;
            });
            // Memos and hearts read in front of the fish.
            bubblesRef.current = bubblesRef.current.filter((b)=>now - b.bornAt < __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MEMO_LIFETIME_MS"]);
            for (const bubble of bubblesRef.current){
                drawBubble(ctx, bubble, width, height, now, seconds);
            }
            heartsRef.current = heartsRef.current.filter((h)=>now - h.bornAt < __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["HEART_LIFETIME_MS"]);
            for (const heart of heartsRef.current){
                drawHeart(ctx, heart, width, height, now);
            }
            if (removed) syncFishCount();
            if (now - lastFxAt > 250) {
                lastFxAt = now;
                const next = `${coralsRef.current.length}:${bubblesRef.current.length}:${heartsRef.current.length}`;
                if (next !== fxRef.current) {
                    fxRef.current = next;
                    setFx(next);
                }
                let topHit = null;
                for(let i = bubblesRef.current.length - 1; i >= 0; i -= 1){
                    if (bubblesRef.current[i].hit) {
                        topHit = bubblesRef.current[i].hit;
                        break;
                    }
                }
                const boxNext = topHit ? `${Math.round(topHit.x)},${Math.round(topHit.y)},${Math.round(topHit.w)},${Math.round(topHit.h)}` : '';
                if (boxNext !== bubbleBoxRef.current) {
                    bubbleBoxRef.current = boxNext;
                    setBubbleBox(boxNext);
                }
            }
            raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
        return ()=>cancelAnimationFrame(raf);
    }, [
        supabase,
        roomId,
        userId,
        syncFishCount
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("canvas", {
            ref: canvasRef,
            onPointerDown: handlePointerDown,
            className: "block h-full w-full touch-none",
            "data-kibo-fx": fx,
            "data-kibo-bubble": bubbleBox,
            role: "img",
            "aria-label": fishCount === 0 ? 'Shared aquarium. No fish on this screen right now.' : `Shared aquarium. ${fishCount} fish on this screen.`
        }, void 0, false, {
            fileName: "[project]/components/Aquarium.tsx",
            lineNumber: 832,
            columnNumber: 7
        }, this)
    }, void 0, false);
}
}),
"[project]/components/TankControls.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>TankControls
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/constants.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
function TankControls({ supabase, roomId, userId, channel, mood, onMoodPicked }) {
    const [memo, setMemo] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('');
    const [busy, setBusy] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [note, setNote] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [moodOpen, setMoodOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const lastWarmthRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(0);
    const flash = (message)=>{
        setNote(message);
        setTimeout(()=>setNote(null), 3500);
    };
    const sendWarmth = ()=>{
        if (!channel) return;
        const now = Date.now();
        if (now - lastWarmthRef.current < __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["WARMTH_COOLDOWN_MS"]) return;
        lastWarmthRef.current = now;
        const payload = {
            id: `${userId}:${now}`,
            // Spread the glows along the floor rather than stacking them.
            xFrac: 0.15 + Math.random() * 0.7
        };
        void channel.send({
            type: 'broadcast',
            event: 'WARMTH_SENT',
            payload
        });
        void supabase.rpc('touch_room', {
            target_room: roomId
        });
    };
    const pickMood = async (next)=>{
        setMoodOpen(false);
        if (next === mood) return;
        onMoodPicked(next); // optimistic; the realtime echo confirms it
        const { error } = await supabase.from('rooms').update({
            tank_mood: next
        }).eq('id', roomId);
        if (error) flash("Couldn't change the water.");
    };
    const sendMemo = async (event)=>{
        event.preventDefault();
        const body = memo.trim();
        if (!body || busy || !channel) return;
        setBusy(true);
        const { data, error } = await supabase.from('memos').insert({
            room_id: roomId,
            author: userId,
            body
        }).select('id').single();
        setBusy(false);
        if (error) {
            flash(error.message.includes('memo_rate_limited') ? 'Slow down a little — too many memos just now.' : "Couldn't leave that memo.");
            return;
        }
        setMemo('');
        const payload = {
            id: data.id,
            body,
            xFrac: 0.25 + Math.random() * 0.5,
            yFrac: 0.6 + Math.random() * 0.25
        };
        void channel.send({
            type: 'broadcast',
            event: 'MEMO_SENT',
            payload
        });
    };
    const remaining = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MEMO_MAX_LEN"] - memo.length;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "pointer-events-none absolute inset-x-0 bottom-0 p-4",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "pointer-events-auto mx-auto flex w-full max-w-md flex-col gap-3",
            children: [
                note ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    "aria-live": "polite",
                    className: "self-center rounded-full bg-black/40 px-3 py-1 text-xs text-amber-200/90 backdrop-blur-sm",
                    children: note
                }, void 0, false, {
                    fileName: "[project]/components/TankControls.tsx",
                    lineNumber: 118,
                    columnNumber: 11
                }, this) : null,
                moodOpen ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    role: "radiogroup",
                    "aria-label": "Tank mood",
                    className: "kibo-fade-in flex flex-wrap justify-center gap-2 rounded-2xl bg-black/30 p-3 backdrop-blur-sm",
                    children: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TANK_MOODS"].map((option)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            role: "radio",
                            "aria-checked": option === mood,
                            onClick: ()=>void pickMood(option),
                            className: `flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition ${option === mood ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white/90'}`,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    "aria-hidden": true,
                                    className: "h-3 w-3 rounded-full ring-1 ring-white/25",
                                    style: {
                                        background: `linear-gradient(${__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TANK_MOOD_GRADIENT"][option][0]}, ${__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TANK_MOOD_GRADIENT"][option][1]})`
                                    }
                                }, void 0, false, {
                                    fileName: "[project]/components/TankControls.tsx",
                                    lineNumber: 145,
                                    columnNumber: 17
                                }, this),
                                __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TANK_MOOD_LABELS"][option]
                            ]
                        }, option, true, {
                            fileName: "[project]/components/TankControls.tsx",
                            lineNumber: 133,
                            columnNumber: 15
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/components/TankControls.tsx",
                    lineNumber: 127,
                    columnNumber: 11
                }, this) : null,
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                    onSubmit: sendMemo,
                    className: "flex items-end gap-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: sendWarmth,
                            title: "Send warmth",
                            "aria-label": "Send warmth",
                            className: "shrink-0 rounded-full bg-amber-200/15 px-4 py-3 text-lg leading-none text-amber-100 backdrop-blur-sm transition hover:bg-amber-200/30",
                            children: "✿"
                        }, void 0, false, {
                            fileName: "[project]/components/TankControls.tsx",
                            lineNumber: 159,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "min-w-0 flex-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    htmlFor: "memo",
                                    className: "sr-only",
                                    children: "Leave a small memo"
                                }, void 0, false, {
                                    fileName: "[project]/components/TankControls.tsx",
                                    lineNumber: 170,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    id: "memo",
                                    value: memo,
                                    onChange: (e)=>setMemo(e.target.value.slice(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MEMO_MAX_LEN"])),
                                    placeholder: "a small memo…",
                                    autoComplete: "off",
                                    className: "w-full rounded-full border border-white/15 bg-black/25 px-4 py-3 text-sm text-white/90 backdrop-blur-sm placeholder:text-white/30 focus:border-white/40 focus:outline-none"
                                }, void 0, false, {
                                    fileName: "[project]/components/TankControls.tsx",
                                    lineNumber: 173,
                                    columnNumber: 13
                                }, this),
                                memo.length > __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MEMO_MAX_LEN"] - 30 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "mt-1 pl-4 text-[11px] text-white/40",
                                    children: [
                                        remaining,
                                        " left"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/TankControls.tsx",
                                    lineNumber: 182,
                                    columnNumber: 15
                                }, this) : null
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/TankControls.tsx",
                            lineNumber: 169,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: ()=>setMoodOpen((open)=>!open),
                            "aria-expanded": moodOpen,
                            "aria-label": "Change the water",
                            title: `Water: ${__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TANK_MOOD_LABELS"][mood]}`,
                            className: "shrink-0 rounded-full p-1 ring-1 ring-white/20 backdrop-blur-sm transition hover:ring-white/50",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                "aria-hidden": true,
                                className: "block h-8 w-8 rounded-full",
                                style: {
                                    background: `linear-gradient(${__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TANK_MOOD_GRADIENT"][mood][0]}, ${__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TANK_MOOD_GRADIENT"][mood][1]})`
                                }
                            }, void 0, false, {
                                fileName: "[project]/components/TankControls.tsx",
                                lineNumber: 196,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/components/TankControls.tsx",
                            lineNumber: 188,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/TankControls.tsx",
                    lineNumber: 158,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/TankControls.tsx",
            lineNumber: 116,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/TankControls.tsx",
        lineNumber: 115,
        columnNumber: 5
    }, this);
}
}),
"[project]/lib/useHeartbeat.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useHeartbeat",
    ()=>useHeartbeat
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/constants.ts [app-ssr] (ecmascript)");
'use client';
;
;
function useHeartbeat(supabase, roomId, userId) {
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!supabase || !roomId || !userId) return;
        const beat = ()=>{
            if (document.visibilityState !== 'visible') return;
            void supabase.from('room_participants').update({
                last_seen_at: new Date().toISOString()
            }).eq('room_id', roomId).eq('user_id', userId);
        };
        beat();
        const interval = setInterval(beat, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["HEARTBEAT_MS"]);
        document.addEventListener('visibilitychange', beat);
        return ()=>{
            clearInterval(interval);
            document.removeEventListener('visibilitychange', beat);
        };
    }, [
        supabase,
        roomId,
        userId
    ]);
}
}),
"[project]/lib/types.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ROOM_ERROR_COPY",
    ()=>ROOM_ERROR_COPY,
    "joinStatusToError",
    ()=>joinStatusToError,
    "toRoomError",
    ()=>toRoomError
]);
const KNOWN_ROOM_ERRORS = [
    'room_not_found',
    'room_full',
    'too_many_attempts',
    'not_authenticated'
];
function toRoomError(message) {
    const match = KNOWN_ROOM_ERRORS.find((code)=>message?.includes(code));
    return match ?? 'unknown';
}
function joinStatusToError(status) {
    const match = KNOWN_ROOM_ERRORS.find((code)=>code === status);
    return match ?? 'unknown';
}
const ROOM_ERROR_COPY = {
    room_not_found: "No tank with that code. Check the characters and try again.",
    room_full: 'That tank already has two people in it.',
    too_many_attempts: 'Too many tries. Wait a few minutes before trying again.',
    not_authenticated: 'Still connecting. Give it a second and try again.',
    timeout: "The tank didn't answer. Check that both SQL migrations have run, and that " + 'your dev server was restarted after .env.local was created.',
    unknown: 'Something went wrong reaching the tank.'
};
}),
"[project]/components/RoomClient.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>RoomClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$Aquarium$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/Aquarium.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$TankControls$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/TankControls.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$AuthProvider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/AuthProvider.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$useHeartbeat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/useHeartbeat.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/constants.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/types.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
;
;
;
;
;
;
;
function RoomClient({ code }) {
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRouter"])();
    const { supabase, userId, status, error: authError } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$AuthProvider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuth"])();
    const [join, setJoin] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({
        phase: 'waiting'
    });
    const [peerPresent, setPeerPresent] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [copied, setCopied] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [mood, setMood] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('calm');
    const [channel, setChannel] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const joinedRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(false);
    const normalized = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["normalizeCode"])(code);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!supabase || status !== 'ready' || !userId) return;
        // join_room is idempotent, but there is no reason to fire two RPCs per
        // mount in dev. As in AuthProvider, this run-once guard must NOT be paired
        // with an abort-on-cleanup flag: under StrictMode the guard blocks the
        // retry while the flag discards the first result, and the join never
        // resolves.
        if (joinedRef.current) return;
        joinedRef.current = true;
        setJoin({
            phase: 'joining'
        });
        // Never hang silently. Without this, any rejection or stalled request
        // leaves the page on "Filling the tank..." forever with nothing to go on.
        let settled = false;
        const timer = setTimeout(()=>{
            if (!settled) setJoin({
                phase: 'error',
                error: 'timeout'
            });
        }, 15_000);
        void (async ()=>{
            try {
                const { data, error } = await supabase.rpc('join_room', {
                    room_code: normalized
                });
                // A raised error means no session at all. Everything else — unknown
                // code, full room, throttled — comes back as a status row, so that the
                // rate-limiter's ledger write survives the transaction.
                if (error) {
                    setJoin({
                        phase: 'error',
                        error: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toRoomError"])(error.message)
                    });
                    return;
                }
                const row = data?.[0];
                if (!row || row.status !== 'ok' || !row.joined_room) {
                    setJoin({
                        phase: 'error',
                        error: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["joinStatusToError"])(row?.status)
                    });
                    return;
                }
                setJoin({
                    phase: 'ready',
                    roomId: row.joined_room
                });
            } catch (cause) {
                // supabase-js normally resolves with {error}, but a network-level
                // failure rejects. Surface it instead of stalling.
                console.error('join_room failed', cause);
                setJoin({
                    phase: 'error',
                    error: 'unknown'
                });
            } finally{
                settled = true;
                clearTimeout(timer);
            }
        })();
    }, [
        supabase,
        status,
        userId,
        normalized
    ]);
    const roomId = join.phase === 'ready' ? join.roomId : null;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$useHeartbeat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useHeartbeat"])(supabase, roomId, userId);
    // Initial mood. Live changes arrive via Aquarium's rooms listener below.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!supabase || !roomId) return;
        void (async ()=>{
            const { data } = await supabase.from('rooms').select('tank_mood').eq('id', roomId).single();
            const next = data?.tank_mood;
            if (next) setMood(next);
        })();
    }, [
        supabase,
        roomId
    ]);
    // These three must be referentially stable: they are dependencies of
    // Aquarium's channel effect, and a new identity would tear down and re-open
    // the realtime subscription on every render.
    const handlePeerChange = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((present)=>{
        setPeerPresent(present);
    }, []);
    const handleChannelReady = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((next)=>{
        setChannel(next);
    }, []);
    const handleRoomUpdate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((row)=>{
        if (row.tank_mood) setMood(row.tank_mood);
    }, []);
    const leave = async ()=>{
        if (supabase && roomId) await supabase.rpc('leave_room', {
            target_room: roomId
        });
        router.push('/');
    };
    const copyLink = async ()=>{
        try {
            await navigator.clipboard.writeText(`${window.location.origin}/room/${normalized}`);
            setCopied(true);
            setTimeout(()=>setCopied(false), 2000);
        } catch  {
            setCopied(false);
        }
    };
    if (status === 'error') {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Notice, {
            title: "Can't reach the tank",
            children: authError
        }, void 0, false, {
            fileName: "[project]/components/RoomClient.tsx",
            lineNumber: 139,
            columnNumber: 12
        }, this);
    }
    if (join.phase === 'error') {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Notice, {
            title: "This tank didn't open",
            children: [
                __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ROOM_ERROR_COPY"][join.error],
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                    href: "/",
                    className: "mt-6 inline-block rounded-full border border-white/25 px-5 py-2 text-sm transition hover:border-white/50",
                    children: "Back to the surface"
                }, void 0, false, {
                    fileName: "[project]/components/RoomClient.tsx",
                    lineNumber: 146,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/RoomClient.tsx",
            lineNumber: 144,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "relative h-dvh w-full overflow-hidden",
        children: [
            roomId && supabase && userId ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$Aquarium$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                supabase: supabase,
                roomId: roomId,
                userId: userId,
                mood: mood,
                onPeerChange: handlePeerChange,
                onChannelReady: handleChannelReady,
                onRoomUpdate: handleRoomUpdate
            }, void 0, false, {
                fileName: "[project]/components/RoomClient.tsx",
                lineNumber: 159,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex h-full items-center justify-center",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-sm text-white/50",
                    children: status === 'loading' ? 'Connecting…' : 'Filling the tank…'
                }, void 0, false, {
                    fileName: "[project]/components/RoomClient.tsx",
                    lineNumber: 171,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/RoomClient.tsx",
                lineNumber: 169,
                columnNumber: 9
            }, this),
            roomId && supabase && userId ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$TankControls$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                supabase: supabase,
                roomId: roomId,
                userId: userId,
                channel: channel,
                mood: mood,
                onMoodPicked: setMood
            }, void 0, false, {
                fileName: "[project]/components/RoomClient.tsx",
                lineNumber: 178,
                columnNumber: 9
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-5",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "kibo-fade-in pointer-events-auto",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: copyLink,
                            className: "rounded-full bg-black/25 px-4 py-2 font-mono text-sm tracking-[0.2em] text-white/80 backdrop-blur-sm transition hover:text-white",
                            title: "Copy the invite link",
                            children: copied ? 'link copied' : normalized
                        }, void 0, false, {
                            fileName: "[project]/components/RoomClient.tsx",
                            lineNumber: 191,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/RoomClient.tsx",
                        lineNumber: 190,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "kibo-fade-in pointer-events-auto flex items-center gap-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "flex items-center gap-2 text-xs text-white/55",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        "aria-hidden": true,
                                        className: `h-1.5 w-1.5 rounded-full transition-colors duration-1000 ${peerPresent ? 'bg-teal-300' : 'bg-white/25'}`
                                    }, void 0, false, {
                                        fileName: "[project]/components/RoomClient.tsx",
                                        lineNumber: 203,
                                        columnNumber: 13
                                    }, this),
                                    peerPresent ? 'together' : 'on your own'
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/RoomClient.tsx",
                                lineNumber: 202,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                onClick: ()=>void leave(),
                                className: "text-xs text-white/40 transition hover:text-white/80",
                                children: "leave"
                            }, void 0, false, {
                                fileName: "[project]/components/RoomClient.tsx",
                                lineNumber: 211,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/RoomClient.tsx",
                        lineNumber: 201,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/RoomClient.tsx",
                lineNumber: 189,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/RoomClient.tsx",
        lineNumber: 157,
        columnNumber: 5
    }, this);
}
function Notice({ title, children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "flex h-dvh items-center justify-center p-8",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "kibo-fade-in max-w-sm text-center",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                    className: "text-lg font-medium",
                    children: title
                }, void 0, false, {
                    fileName: "[project]/components/RoomClient.tsx",
                    lineNumber: 234,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "mt-3 text-sm leading-relaxed text-white/60",
                    children: children
                }, void 0, false, {
                    fileName: "[project]/components/RoomClient.tsx",
                    lineNumber: 235,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/RoomClient.tsx",
            lineNumber: 233,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/RoomClient.tsx",
        lineNumber: 232,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=_0tajhmq._.js.map