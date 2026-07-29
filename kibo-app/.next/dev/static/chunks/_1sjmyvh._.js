(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/lib/constants.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/Aquarium.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Aquarium
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/constants.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
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
    const [top, bottom] = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TANK_MOOD_GRADIENT"][mood];
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
    const alpha = envelope(now - coral.bornAt, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["WARMTH_LIFETIME_MS"], 0.2, 0.45);
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
    const alpha = envelope(age, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MEMO_LIFETIME_MS"], 0.04, 0.25);
    if (alpha <= 0) {
        bubble.hit = null;
        return;
    }
    // Drifts upward over its life, with a slow sway.
    const rise = age / __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MEMO_LIFETIME_MS"] * height * 0.28;
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
    const alpha = envelope(age, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["HEART_LIFETIME_MS"], 0.1, 0.55);
    if (alpha <= 0) return;
    const x = heart.xFrac * width;
    const y = heart.yFrac * height - age / __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["HEART_LIFETIME_MS"] * 70;
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
    _s();
    const canvasRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const fishRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])([]);
    const coralsRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])([]);
    const bubblesRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])([]);
    const heartsRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])([]);
    /** Ids to drop on the next frame: handoff confirmed, or ownership revoked. */ const pendingRemovalRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(new Set());
    const peersRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])([]);
    const channelRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const moodFadeRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])({
        from: moodStops(mood),
        to: moodStops(mood),
        startedAt: 0
    });
    const paintedRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(moodStops(mood));
    const [fishCount, setFishCount] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    /**
   * "corals:bubbles:hearts" — the only readable signal for the ambient layer,
   * which is otherwise pure canvas pixels. Surfaced as a data attribute so the
   * E2E suite can assert that one client's warmth actually reaches the other.
   * Throttled, because it changes inside the render loop.
   */ const [fx, setFx] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('0:0:0');
    const fxRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])('0:0:0');
    /**
   * "x,y,w,h" of the topmost tappable memo bubble, in CSS px. Bubbles drift, so
   * without this a test (or any automation) has to guess where to click.
   */ const [bubbleBox, setBubbleBox] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const bubbleBoxRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])('');
    // Cross-fade from whatever is on screen right now, so a mood change during
    // an earlier fade does not snap.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Aquarium.useEffect": ()=>{
            moodFadeRef.current = {
                from: [
                    paintedRef.current[0],
                    paintedRef.current[1]
                ],
                to: moodStops(mood),
                startedAt: performance.now()
            };
        }
    }["Aquarium.useEffect"], [
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
   */ const syncFishCount = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Aquarium.useCallback[syncFishCount]": ()=>{
            setFishCount(fishRef.current.filter({
                "Aquarium.useCallback[syncFishCount]": (fish)=>!fish.handingOff
            }["Aquarium.useCallback[syncFishCount]"]).length);
        }
    }["Aquarium.useCallback[syncFishCount]"], []);
    // ------------------------------------------------ realtime + reconciliation
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Aquarium.useEffect": ()=>{
            let active = true;
            let aloneTimer = null;
            const adopt = {
                "Aquarium.useEffect.adopt": (fish)=>{
                    // Dedupe across broadcast / postgres_changes / recovery. adopt() pushes
                    // synchronously and JS is single-threaded, so whichever signal lands
                    // first always wins and the others see it here.
                    if (fishRef.current.some({
                        "Aquarium.useEffect.adopt": (existing)=>existing.id === fish.id
                    }["Aquarium.useEffect.adopt"])) return;
                    pendingRemovalRef.current.delete(fish.id);
                    const width = canvasRef.current?.clientWidth ?? 0;
                    fishRef.current.push({
                        id: fish.id,
                        x: fish.direction === 1 ? -__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FISH_MARGIN"] : width + __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FISH_MARGIN"],
                        yFrac: fish.y_frac,
                        speedPxS: fish.speed_px_s,
                        direction: fish.direction,
                        color: fish.color,
                        bobPhase: bobPhaseFor(fish.id),
                        handingOff: false
                    });
                    syncFishCount();
                }
            }["Aquarium.useEffect.adopt"];
            const addCoral = {
                "Aquarium.useEffect.addCoral": (id, xFrac)=>{
                    if (coralsRef.current.some({
                        "Aquarium.useEffect.addCoral": (c)=>c.id === id
                    }["Aquarium.useEffect.addCoral"])) return;
                    coralsRef.current.push({
                        id,
                        xFrac,
                        bornAt: performance.now()
                    });
                    if (coralsRef.current.length > __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MAX_CORALS"]) coralsRef.current.shift();
                }
            }["Aquarium.useEffect.addCoral"];
            const addBubble = {
                "Aquarium.useEffect.addBubble": (id, body, xFrac, yFrac)=>{
                    if (bubblesRef.current.some({
                        "Aquarium.useEffect.addBubble": (b)=>b.id === id
                    }["Aquarium.useEffect.addBubble"])) return;
                    bubblesRef.current.push({
                        id,
                        body,
                        xFrac,
                        yFrac,
                        bornAt: performance.now(),
                        swayPhase: hashUnit(id, 3) * 6.283,
                        hit: null
                    });
                    if (bubblesRef.current.length > __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MAX_BUBBLES"]) bubblesRef.current.shift();
                }
            }["Aquarium.useEffect.addBubble"];
            const addHeart = {
                "Aquarium.useEffect.addHeart": (id, xFrac, yFrac)=>{
                    if (heartsRef.current.some({
                        "Aquarium.useEffect.addHeart": (h)=>h.id === id
                    }["Aquarium.useEffect.addHeart"])) return;
                    heartsRef.current.push({
                        id,
                        xFrac,
                        yFrac,
                        bornAt: performance.now()
                    });
                    if (heartsRef.current.length > __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MAX_HEARTS"]) heartsRef.current.shift();
                }
            }["Aquarium.useEffect.addHeart"];
            /**
     * Pick up anything released by a departed participant, then load
     * everything we hold. This is what makes a refresh non-destructive.
     */ const recover = {
                "Aquarium.useEffect.recover": async ()=>{
                    await supabase.from('fish').update({
                        holder: userId
                    }).eq('room_id', roomId).is('holder', null);
                    const { data } = await supabase.from('fish').select('*').eq('room_id', roomId).eq('holder', userId);
                    if (!active) return;
                    data?.forEach(adopt);
                }
            }["Aquarium.useEffect.recover"];
            /** Recent memos become bubbles, so arriving later still shows you them. */ const loadMemos = {
                "Aquarium.useEffect.loadMemos": async ()=>{
                    const { data } = await supabase.from('memos').select('id, body, created_at').eq('room_id', roomId).order('created_at', {
                        ascending: false
                    }).limit(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MEMO_BACKLOG"]);
                    if (!active) return;
                    const rows = data ?? [];
                    // Oldest first, so the newest ends up nearest the bottom.
                    [
                        ...rows
                    ].reverse().forEach({
                        "Aquarium.useEffect.loadMemos": (m)=>{
                            addBubble(m.id, m.body, 0.25 + hashUnit(m.id) * 0.5, 0.55 + hashUnit(m.id, 1) * 0.3);
                        }
                    }["Aquarium.useEffect.loadMemos"]);
                }
            }["Aquarium.useEffect.loadMemos"];
            /**
     * Presence says we are alone, so any fish still assigned to the absent
     * partner would be stranded — nobody is simulating it. Claim the room.
     * Debounced, because a momentary websocket blip also empties presence.
     */ const claimStranded = {
                "Aquarium.useEffect.claimStranded": async ()=>{
                    if (peersRef.current.length > 0) return;
                    await supabase.from('fish').update({
                        holder: userId
                    }).eq('room_id', roomId).or(`holder.is.null,holder.neq.${userId}`);
                    if (active) await recover();
                }
            }["Aquarium.useEffect.claimStranded"];
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
            }, {
                "Aquarium.useEffect": ()=>{
                    const peers = Object.keys(channel.presenceState()).filter({
                        "Aquarium.useEffect.peers": (id)=>id !== userId
                    }["Aquarium.useEffect.peers"]);
                    peersRef.current = peers;
                    onPeerChange?.(peers.length > 0);
                    if (aloneTimer) {
                        clearTimeout(aloneTimer);
                        aloneTimer = null;
                    }
                    if (peers.length === 0) {
                        aloneTimer = setTimeout({
                            "Aquarium.useEffect": ()=>void claimStranded()
                        }["Aquarium.useEffect"], ALONE_CLAIM_DELAY_MS);
                    }
                }
            }["Aquarium.useEffect"]).on('broadcast', {
                event: 'FISH_CROSS'
            }, {
                "Aquarium.useEffect": ({ payload })=>{
                    const crossing = payload;
                    if (crossing.toUser !== userId) return;
                    adopt({
                        id: crossing.fishId,
                        y_frac: crossing.y_frac,
                        speed_px_s: crossing.speed_px_s,
                        direction: crossing.direction,
                        color: crossing.color
                    });
                }
            }["Aquarium.useEffect"]).on('broadcast', {
                event: 'WARMTH_SENT'
            }, {
                "Aquarium.useEffect": ({ payload })=>{
                    const warmth = payload;
                    addCoral(warmth.id, warmth.xFrac);
                }
            }["Aquarium.useEffect"]).on('broadcast', {
                event: 'MEMO_SENT'
            }, {
                "Aquarium.useEffect": ({ payload })=>{
                    const memo = payload;
                    addBubble(memo.id, memo.body, memo.xFrac, memo.yFrac);
                }
            }["Aquarium.useEffect"]).on('broadcast', {
                event: 'HEART_SENT'
            }, {
                "Aquarium.useEffect": ({ payload })=>{
                    const heart = payload;
                    addHeart(heart.id, heart.xFrac, heart.yFrac);
                }
            }["Aquarium.useEffect"]).on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'fish',
                filter: `room_id=eq.${roomId}`
            }, {
                "Aquarium.useEffect": (payload)=>{
                    const row = payload.new;
                    if (row.holder === userId) {
                        adopt(row);
                        return;
                    }
                    // Postgres is authoritative in both directions: if a fish is no
                    // longer ours, stop drawing it. Without this, a claim by the other
                    // side would leave the same fish rendered on both screens.
                    if (fishRef.current.some({
                        "Aquarium.useEffect": (fish)=>fish.id === row.id
                    }["Aquarium.useEffect"])) {
                        pendingRemovalRef.current.add(row.id);
                    }
                }
            }["Aquarium.useEffect"]).on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'rooms',
                filter: `id=eq.${roomId}`
            }, {
                "Aquarium.useEffect": (payload)=>{
                    onRoomUpdate?.(payload.new);
                }
            }["Aquarium.useEffect"]).on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'memos',
                filter: `room_id=eq.${roomId}`
            }, {
                "Aquarium.useEffect": (payload)=>{
                    // Safety net for a dropped MEMO_SENT broadcast, same split as fish.
                    const row = payload.new;
                    addBubble(row.id, row.body, 0.25 + hashUnit(row.id) * 0.5, 0.55 + hashUnit(row.id, 1) * 0.3);
                }
            }["Aquarium.useEffect"]).subscribe({
                "Aquarium.useEffect": (status)=>{
                    if (status !== 'SUBSCRIBED') return;
                    void ({
                        "Aquarium.useEffect": async ()=>{
                            await channel.track({
                                at: Date.now()
                            });
                            await recover();
                            await loadMemos();
                        }
                    })["Aquarium.useEffect"]();
                }
            }["Aquarium.useEffect"]);
            return ({
                "Aquarium.useEffect": ()=>{
                    active = false;
                    if (aloneTimer) clearTimeout(aloneTimer);
                    channelRef.current = null;
                    onChannelReady?.(null);
                    void supabase.removeChannel(channel);
                }
            })["Aquarium.useEffect"];
        }
    }["Aquarium.useEffect"], [
        supabase,
        roomId,
        userId,
        onPeerChange,
        onChannelReady,
        onRoomUpdate,
        syncFishCount
    ]);
    // ------------------------------------------------------------ canvas sizing
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Aquarium.useEffect": ()=>{
            const canvas = canvasRef.current;
            if (!canvas) return;
            const resize = {
                "Aquarium.useEffect.resize": ()=>{
                    const dpr = window.devicePixelRatio || 1;
                    const width = canvas.clientWidth;
                    const height = canvas.clientHeight;
                    if (width === 0 || height === 0) return;
                    canvas.width = Math.round(width * dpr);
                    canvas.height = Math.round(height * dpr);
                    // setTransform rather than scale: resize fires repeatedly and scale
                    // would compound.
                    canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
                }
            }["Aquarium.useEffect.resize"];
            resize();
            const observer = new ResizeObserver(resize);
            observer.observe(canvas);
            return ({
                "Aquarium.useEffect": ()=>observer.disconnect()
            })["Aquarium.useEffect"];
        }
    }["Aquarium.useEffect"], []);
    // --------------------------------------------- tap a memo to send a heart
    const handlePointerDown = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Aquarium.useCallback[handlePointerDown]": (event)=>{
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
        }
    }["Aquarium.useCallback[handlePointerDown]"], []);
    // ------------------------------------------------------- render + handoff
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Aquarium.useEffect": ()=>{
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
     */ const handOff = {
                "Aquarium.useEffect.handOff": async (fish, peer)=>{
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
                }
            }["Aquarium.useEffect.handOff"];
            const paintBackground = {
                "Aquarium.useEffect.paintBackground": (width, height, now)=>{
                    const fade = moodFadeRef.current;
                    const t = fade.startedAt ? Math.min(1, (now - fade.startedAt) / __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MOOD_FADE_MS"]) : 1;
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
                }
            }["Aquarium.useEffect.paintBackground"];
            const frame = {
                "Aquarium.useEffect.frame": (now)=>{
                    // Clamp so a backgrounded tab doesn't teleport every fish on return.
                    const dt = Math.min((now - last) / 1000, 0.1);
                    last = now;
                    const seconds = (now - start) / 1000;
                    const width = canvas.clientWidth;
                    const height = canvas.clientHeight;
                    paintBackground(width, height, now);
                    // Warmth sits behind the fish, near the floor.
                    coralsRef.current = coralsRef.current.filter({
                        "Aquarium.useEffect.frame": (c)=>now - c.bornAt < __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["WARMTH_LIFETIME_MS"]
                    }["Aquarium.useEffect.frame"]);
                    for (const coral of coralsRef.current){
                        drawCoral(ctx, coral, width, height, now, seconds);
                    }
                    const pending = pendingRemovalRef.current;
                    let removed = false;
                    fishRef.current = fishRef.current.filter({
                        "Aquarium.useEffect.frame": (fish)=>{
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
                            const exitedRight = fish.direction === 1 && fish.x > width + __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FISH_MARGIN"];
                            const exitedLeft = fish.direction === -1 && fish.x < -__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FISH_MARGIN"];
                            if (!exitedRight && !exitedLeft) return true;
                            const peer = peersRef.current[0];
                            if (!peer) {
                                // Nobody to receive it — reflect rather than lose the fish.
                                fish.direction = fish.direction * -1;
                                return true;
                            }
                            void handOff(fish, peer);
                            return true;
                        }
                    }["Aquarium.useEffect.frame"]);
                    // Memos and hearts read in front of the fish.
                    bubblesRef.current = bubblesRef.current.filter({
                        "Aquarium.useEffect.frame": (b)=>now - b.bornAt < __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MEMO_LIFETIME_MS"]
                    }["Aquarium.useEffect.frame"]);
                    for (const bubble of bubblesRef.current){
                        drawBubble(ctx, bubble, width, height, now, seconds);
                    }
                    heartsRef.current = heartsRef.current.filter({
                        "Aquarium.useEffect.frame": (h)=>now - h.bornAt < __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["HEART_LIFETIME_MS"]
                    }["Aquarium.useEffect.frame"]);
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
                }
            }["Aquarium.useEffect.frame"];
            raf = requestAnimationFrame(frame);
            return ({
                "Aquarium.useEffect": ()=>cancelAnimationFrame(raf)
            })["Aquarium.useEffect"];
        }
    }["Aquarium.useEffect"], [
        supabase,
        roomId,
        userId,
        syncFishCount
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("canvas", {
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
_s(Aquarium, "6OTEtp/XHXMyRuWMt9LeEaJkuGY=");
_c = Aquarium;
var _c;
__turbopack_context__.k.register(_c, "Aquarium");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/TankControls.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>TankControls
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/constants.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
function TankControls({ supabase, roomId, userId, channel, mood, onMoodPicked }) {
    _s();
    const [memo, setMemo] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [busy, setBusy] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [note, setNote] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [moodOpen, setMoodOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const lastWarmthRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(0);
    const flash = (message)=>{
        setNote(message);
        setTimeout(()=>setNote(null), 3500);
    };
    const sendWarmth = ()=>{
        if (!channel) return;
        const now = Date.now();
        if (now - lastWarmthRef.current < __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["WARMTH_COOLDOWN_MS"]) return;
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
    const remaining = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MEMO_MAX_LEN"] - memo.length;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "pointer-events-none absolute inset-x-0 bottom-0 p-4",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "pointer-events-auto mx-auto flex w-full max-w-md flex-col gap-3",
            children: [
                note ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    "aria-live": "polite",
                    className: "self-center rounded-full bg-black/40 px-3 py-1 text-xs text-amber-200/90 backdrop-blur-sm",
                    children: note
                }, void 0, false, {
                    fileName: "[project]/components/TankControls.tsx",
                    lineNumber: 118,
                    columnNumber: 11
                }, this) : null,
                moodOpen ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    role: "radiogroup",
                    "aria-label": "Tank mood",
                    className: "kibo-fade-in flex flex-wrap justify-center gap-2 rounded-2xl bg-black/30 p-3 backdrop-blur-sm",
                    children: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TANK_MOODS"].map((option)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            role: "radio",
                            "aria-checked": option === mood,
                            onClick: ()=>void pickMood(option),
                            className: `flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition ${option === mood ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white/90'}`,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    "aria-hidden": true,
                                    className: "h-3 w-3 rounded-full ring-1 ring-white/25",
                                    style: {
                                        background: `linear-gradient(${__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TANK_MOOD_GRADIENT"][option][0]}, ${__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TANK_MOOD_GRADIENT"][option][1]})`
                                    }
                                }, void 0, false, {
                                    fileName: "[project]/components/TankControls.tsx",
                                    lineNumber: 145,
                                    columnNumber: 17
                                }, this),
                                __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TANK_MOOD_LABELS"][option]
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
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                    onSubmit: sendMemo,
                    className: "flex items-end gap-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
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
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "min-w-0 flex-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    htmlFor: "memo",
                                    className: "sr-only",
                                    children: "Leave a small memo"
                                }, void 0, false, {
                                    fileName: "[project]/components/TankControls.tsx",
                                    lineNumber: 170,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    id: "memo",
                                    value: memo,
                                    onChange: (e)=>setMemo(e.target.value.slice(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MEMO_MAX_LEN"])),
                                    placeholder: "a small memo…",
                                    autoComplete: "off",
                                    className: "w-full rounded-full border border-white/15 bg-black/25 px-4 py-3 text-sm text-white/90 backdrop-blur-sm placeholder:text-white/30 focus:border-white/40 focus:outline-none"
                                }, void 0, false, {
                                    fileName: "[project]/components/TankControls.tsx",
                                    lineNumber: 173,
                                    columnNumber: 13
                                }, this),
                                memo.length > __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MEMO_MAX_LEN"] - 30 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
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
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: ()=>setMoodOpen((open)=>!open),
                            "aria-expanded": moodOpen,
                            "aria-label": "Change the water",
                            title: `Water: ${__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TANK_MOOD_LABELS"][mood]}`,
                            className: "shrink-0 rounded-full p-1 ring-1 ring-white/20 backdrop-blur-sm transition hover:ring-white/50",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                "aria-hidden": true,
                                className: "block h-8 w-8 rounded-full",
                                style: {
                                    background: `linear-gradient(${__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TANK_MOOD_GRADIENT"][mood][0]}, ${__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TANK_MOOD_GRADIENT"][mood][1]})`
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
_s(TankControls, "5Jjz/5rWMenU6vqjOCeo64BCA74=");
_c = TankControls;
var _c;
__turbopack_context__.k.register(_c, "TankControls");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/useHeartbeat.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useHeartbeat",
    ()=>useHeartbeat
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/constants.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
'use client';
;
;
function useHeartbeat(supabase, roomId, userId) {
    _s();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useHeartbeat.useEffect": ()=>{
            if (!supabase || !roomId || !userId) return;
            const beat = {
                "useHeartbeat.useEffect.beat": ()=>{
                    if (document.visibilityState !== 'visible') return;
                    void supabase.from('room_participants').update({
                        last_seen_at: new Date().toISOString()
                    }).eq('room_id', roomId).eq('user_id', userId);
                }
            }["useHeartbeat.useEffect.beat"];
            beat();
            const interval = setInterval(beat, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["HEARTBEAT_MS"]);
            document.addEventListener('visibilitychange', beat);
            return ({
                "useHeartbeat.useEffect": ()=>{
                    clearInterval(interval);
                    document.removeEventListener('visibilitychange', beat);
                }
            })["useHeartbeat.useEffect"];
        }
    }["useHeartbeat.useEffect"], [
        supabase,
        roomId,
        userId
    ]);
}
_s(useHeartbeat, "OD7bBpZva5O2jO+Puf00hKivP7c=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/types.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/RoomClient.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>RoomClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$Aquarium$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/Aquarium.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$TankControls$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/TankControls.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$AuthProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/AuthProvider.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$useHeartbeat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/useHeartbeat.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/constants.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/types.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
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
function RoomClient({ code }) {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const { supabase, userId, status, error: authError } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$AuthProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"])();
    const [join, setJoin] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        phase: 'waiting'
    });
    const [peerPresent, setPeerPresent] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [copied, setCopied] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [mood, setMood] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('calm');
    const [channel, setChannel] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const joinedRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    const normalized = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeCode"])(code);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "RoomClient.useEffect": ()=>{
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
            const timer = setTimeout({
                "RoomClient.useEffect.timer": ()=>{
                    if (!settled) setJoin({
                        phase: 'error',
                        error: 'timeout'
                    });
                }
            }["RoomClient.useEffect.timer"], 15_000);
            void ({
                "RoomClient.useEffect": async ()=>{
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
                                error: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toRoomError"])(error.message)
                            });
                            return;
                        }
                        const row = data?.[0];
                        if (!row || row.status !== 'ok' || !row.joined_room) {
                            setJoin({
                                phase: 'error',
                                error: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["joinStatusToError"])(row?.status)
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
                }
            })["RoomClient.useEffect"]();
        }
    }["RoomClient.useEffect"], [
        supabase,
        status,
        userId,
        normalized
    ]);
    const roomId = join.phase === 'ready' ? join.roomId : null;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$useHeartbeat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useHeartbeat"])(supabase, roomId, userId);
    // Initial mood. Live changes arrive via Aquarium's rooms listener below.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "RoomClient.useEffect": ()=>{
            if (!supabase || !roomId) return;
            void ({
                "RoomClient.useEffect": async ()=>{
                    const { data } = await supabase.from('rooms').select('tank_mood').eq('id', roomId).single();
                    const next = data?.tank_mood;
                    if (next) setMood(next);
                }
            })["RoomClient.useEffect"]();
        }
    }["RoomClient.useEffect"], [
        supabase,
        roomId
    ]);
    // These three must be referentially stable: they are dependencies of
    // Aquarium's channel effect, and a new identity would tear down and re-open
    // the realtime subscription on every render.
    const handlePeerChange = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "RoomClient.useCallback[handlePeerChange]": (present)=>{
            setPeerPresent(present);
        }
    }["RoomClient.useCallback[handlePeerChange]"], []);
    const handleChannelReady = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "RoomClient.useCallback[handleChannelReady]": (next)=>{
            setChannel(next);
        }
    }["RoomClient.useCallback[handleChannelReady]"], []);
    const handleRoomUpdate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "RoomClient.useCallback[handleRoomUpdate]": (row)=>{
            if (row.tank_mood) setMood(row.tank_mood);
        }
    }["RoomClient.useCallback[handleRoomUpdate]"], []);
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
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Notice, {
            title: "Can't reach the tank",
            children: authError
        }, void 0, false, {
            fileName: "[project]/components/RoomClient.tsx",
            lineNumber: 139,
            columnNumber: 12
        }, this);
    }
    if (join.phase === 'error') {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Notice, {
            title: "This tank didn't open",
            children: [
                __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ROOM_ERROR_COPY"][join.error],
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "relative h-dvh w-full overflow-hidden",
        children: [
            roomId && supabase && userId ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$Aquarium$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
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
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex h-full items-center justify-center",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
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
            roomId && supabase && userId ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$TankControls$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-5",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "kibo-fade-in pointer-events-auto",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
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
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "kibo-fade-in pointer-events-auto flex items-center gap-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "flex items-center gap-2 text-xs text-white/55",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
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
_s(RoomClient, "TiB+k7VGIOqMzXnsnr/XrWpGZJg=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$AuthProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"],
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$useHeartbeat$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useHeartbeat"]
    ];
});
_c = RoomClient;
function Notice({ title, children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "flex h-dvh items-center justify-center p-8",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "kibo-fade-in max-w-sm text-center",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                    className: "text-lg font-medium",
                    children: title
                }, void 0, false, {
                    fileName: "[project]/components/RoomClient.tsx",
                    lineNumber: 234,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
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
_c1 = Notice;
var _c, _c1;
__turbopack_context__.k.register(_c, "RoomClient");
__turbopack_context__.k.register(_c1, "Notice");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/node_modules/next/dist/shared/lib/router/utils/format-url.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
// Format function modified from nodejs
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    formatUrl: null,
    formatWithValidation: null,
    urlObjectKeys: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    formatUrl: function() {
        return formatUrl;
    },
    formatWithValidation: function() {
        return formatWithValidation;
    },
    urlObjectKeys: function() {
        return urlObjectKeys;
    }
});
const _interop_require_wildcard = __turbopack_context__.r("[project]/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _querystring = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_context__.r("[project]/node_modules/next/dist/shared/lib/router/utils/querystring.js [app-client] (ecmascript)"));
const slashedProtocols = /https?|ftp|gopher|file/;
function formatUrl(urlObj) {
    let { auth, hostname } = urlObj;
    let protocol = urlObj.protocol || '';
    let pathname = urlObj.pathname || '';
    let hash = urlObj.hash || '';
    let query = urlObj.query || '';
    let host = false;
    auth = auth ? encodeURIComponent(auth).replace(/%3A/i, ':') + '@' : '';
    if (urlObj.host) {
        host = auth + urlObj.host;
    } else if (hostname) {
        host = auth + (~hostname.indexOf(':') ? `[${hostname}]` : hostname);
        if (urlObj.port) {
            host += ':' + urlObj.port;
        }
    }
    if (query && typeof query === 'object') {
        query = String(_querystring.urlQueryToSearchParams(query));
    }
    let search = urlObj.search || query && `?${query}` || '';
    if (protocol && !protocol.endsWith(':')) protocol += ':';
    if (urlObj.slashes || (!protocol || slashedProtocols.test(protocol)) && host !== false) {
        host = '//' + (host || '');
        if (pathname && pathname[0] !== '/') pathname = '/' + pathname;
    } else if (!host) {
        host = '';
    }
    if (hash && hash[0] !== '#') hash = '#' + hash;
    if (search && search[0] !== '?') search = '?' + search;
    pathname = pathname.replace(/[?#]/g, encodeURIComponent);
    search = search.replace('#', '%23');
    return `${protocol}${host}${pathname}${search}${hash}`;
}
const urlObjectKeys = [
    'auth',
    'hash',
    'host',
    'hostname',
    'href',
    'path',
    'pathname',
    'port',
    'protocol',
    'query',
    'search',
    'slashes'
];
function formatWithValidation(url) {
    if ("TURBOPACK compile-time truthy", 1) {
        if (url !== null && typeof url === 'object') {
            Object.keys(url).forEach((key)=>{
                if (!urlObjectKeys.includes(key)) {
                    console.warn(`Unknown key passed via urlObject into url.format: ${key}`);
                }
            });
        }
    }
    return formatUrl(url);
}
}),
"[project]/node_modules/next/dist/client/use-merged-ref.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "useMergedRef", {
    enumerable: true,
    get: function() {
        return useMergedRef;
    }
});
const _react = __turbopack_context__.r("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
function useMergedRef(refA, refB) {
    const cleanupA = (0, _react.useRef)(null);
    const cleanupB = (0, _react.useRef)(null);
    // NOTE: In theory, we could skip the wrapping if only one of the refs is non-null.
    // (this happens often if the user doesn't pass a ref to Link/Form/Image)
    // But this can cause us to leak a cleanup-ref into user code (previously via `<Link legacyBehavior>`),
    // and the user might pass that ref into ref-merging library that doesn't support cleanup refs
    // (because it hasn't been updated for React 19)
    // which can then cause things to blow up, because a cleanup-returning ref gets called with `null`.
    // So in practice, it's safer to be defensive and always wrap the ref, even on React 19.
    return (0, _react.useCallback)((current)=>{
        if (current === null) {
            const cleanupFnA = cleanupA.current;
            if (cleanupFnA) {
                cleanupA.current = null;
                cleanupFnA();
            }
            const cleanupFnB = cleanupB.current;
            if (cleanupFnB) {
                cleanupB.current = null;
                cleanupFnB();
            }
        } else {
            if (refA) {
                cleanupA.current = applyRef(refA, current);
            }
            if (refB) {
                cleanupB.current = applyRef(refB, current);
            }
        }
    }, [
        refA,
        refB
    ]);
}
function applyRef(refA, current) {
    if (typeof refA === 'function') {
        const cleanup = refA(current);
        if (typeof cleanup === 'function') {
            return cleanup;
        } else {
            return ()=>refA(null);
        }
    } else {
        refA.current = current;
        return ()=>{
            refA.current = null;
        };
    }
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
}
}),
"[project]/node_modules/next/dist/shared/lib/router/utils/is-local-url.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "isLocalURL", {
    enumerable: true,
    get: function() {
        return isLocalURL;
    }
});
const _utils = __turbopack_context__.r("[project]/node_modules/next/dist/shared/lib/utils.js [app-client] (ecmascript)");
const _hasbasepath = __turbopack_context__.r("[project]/node_modules/next/dist/client/has-base-path.js [app-client] (ecmascript)");
function isLocalURL(url) {
    // prevent a hydration mismatch on href for url with anchor refs
    if (!(0, _utils.isAbsoluteUrl)(url)) return true;
    try {
        // absolute urls can be local if they are on the same origin
        const locationOrigin = (0, _utils.getLocationOrigin)();
        const resolved = new URL(url, locationOrigin);
        return resolved.origin === locationOrigin && (0, _hasbasepath.hasBasePath)(resolved.pathname);
    } catch (_) {
        return false;
    }
}
}),
"[project]/node_modules/next/dist/shared/lib/utils/error-once.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "errorOnce", {
    enumerable: true,
    get: function() {
        return errorOnce;
    }
});
let errorOnce = (_)=>{};
if ("TURBOPACK compile-time truthy", 1) {
    const errors = new Set();
    errorOnce = (msg)=>{
        if (!errors.has(msg)) {
            console.error(msg);
        }
        errors.add(msg);
    };
}
}),
"[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    default: null,
    useLinkStatus: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    /**
 * A React component that extends the HTML `<a>` element to provide
 * [prefetching](https://nextjs.org/docs/app/building-your-application/routing/linking-and-navigating#2-prefetching)
 * and client-side navigation. This is the primary way to navigate between routes in Next.js.
 *
 * @remarks
 * - Prefetching is only enabled in production.
 *
 * @see https://nextjs.org/docs/app/api-reference/components/link
 */ default: function() {
        return LinkComponent;
    },
    useLinkStatus: function() {
        return useLinkStatus;
    }
});
const _interop_require_wildcard = __turbopack_context__.r("[project]/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_context__.r("[project]/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_context__.r("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _formaturl = __turbopack_context__.r("[project]/node_modules/next/dist/shared/lib/router/utils/format-url.js [app-client] (ecmascript)");
const _approutercontextsharedruntime = __turbopack_context__.r("[project]/node_modules/next/dist/shared/lib/app-router-context.shared-runtime.js [app-client] (ecmascript)");
const _usemergedref = __turbopack_context__.r("[project]/node_modules/next/dist/client/use-merged-ref.js [app-client] (ecmascript)");
const _utils = __turbopack_context__.r("[project]/node_modules/next/dist/shared/lib/utils.js [app-client] (ecmascript)");
const _addbasepath = __turbopack_context__.r("[project]/node_modules/next/dist/client/add-base-path.js [app-client] (ecmascript)");
const _warnonce = __turbopack_context__.r("[project]/node_modules/next/dist/shared/lib/utils/warn-once.js [app-client] (ecmascript)");
const _routerreducertypes = __turbopack_context__.r("[project]/node_modules/next/dist/client/components/router-reducer/router-reducer-types.js [app-client] (ecmascript)");
const _links = __turbopack_context__.r("[project]/node_modules/next/dist/client/components/links.js [app-client] (ecmascript)");
const _islocalurl = __turbopack_context__.r("[project]/node_modules/next/dist/shared/lib/router/utils/is-local-url.js [app-client] (ecmascript)");
const _types = __turbopack_context__.r("[project]/node_modules/next/dist/client/components/segment-cache/types.js [app-client] (ecmascript)");
const _erroronce = __turbopack_context__.r("[project]/node_modules/next/dist/shared/lib/utils/error-once.js [app-client] (ecmascript)");
function isModifiedEvent(event) {
    const eventTarget = event.currentTarget;
    const target = eventTarget.getAttribute('target');
    return target && target !== '_self' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || // triggers resource download
    event.nativeEvent && event.nativeEvent.which === 2;
}
function linkClicked(e, href, linkInstanceRef, replace, scroll, onNavigate, transitionTypes) {
    if (typeof window !== 'undefined') {
        const { nodeName } = e.currentTarget;
        // anchors inside an svg have a lowercase nodeName
        const isAnchorNodeName = nodeName.toUpperCase() === 'A';
        if (isAnchorNodeName && isModifiedEvent(e) || e.currentTarget.hasAttribute('download')) {
            // ignore click for browser’s default behavior
            return;
        }
        if (!(0, _islocalurl.isLocalURL)(href)) {
            if (replace) {
                // browser default behavior does not replace the history state
                // so we need to do it manually
                e.preventDefault();
                location.replace(href);
            }
            // ignore click for browser’s default behavior
            return;
        }
        e.preventDefault();
        if (onNavigate) {
            let isDefaultPrevented = false;
            onNavigate({
                preventDefault: ()=>{
                    isDefaultPrevented = true;
                }
            });
            if (isDefaultPrevented) {
                return;
            }
        }
        const { dispatchNavigateAction } = __turbopack_context__.r("[project]/node_modules/next/dist/client/components/app-router-instance.js [app-client] (ecmascript)");
        _react.default.startTransition(()=>{
            dispatchNavigateAction(href, replace ? 'replace' : 'push', scroll === false ? _routerreducertypes.ScrollBehavior.NoScroll : _routerreducertypes.ScrollBehavior.Default, linkInstanceRef.current, transitionTypes);
        });
    }
}
function formatStringOrUrl(urlObjOrString) {
    if (typeof urlObjOrString === 'string') {
        return urlObjOrString;
    }
    return (0, _formaturl.formatUrl)(urlObjOrString);
}
function LinkComponent(props) {
    const [linkStatus, setOptimisticLinkStatus] = (0, _react.useOptimistic)(_links.IDLE_LINK_STATUS);
    let children;
    const linkInstanceRef = (0, _react.useRef)(null);
    const { href: hrefProp, as: asProp, children: childrenProp, prefetch: prefetchProp = null, passHref, replace, shallow, scroll, onClick, onMouseEnter: onMouseEnterProp, onTouchStart: onTouchStartProp, legacyBehavior = false, onNavigate, transitionTypes, ref: forwardedRef, unstable_dynamicOnHover, ...restProps } = props;
    children = childrenProp;
    if (legacyBehavior && (typeof children === 'string' || typeof children === 'number')) {
        children = /*#__PURE__*/ (0, _jsxruntime.jsx)("a", {
            children: children
        });
    }
    const router = _react.default.useContext(_approutercontextsharedruntime.AppRouterContext);
    const prefetchEnabled = prefetchProp !== false;
    const fetchStrategy = prefetchProp !== false ? getFetchStrategyFromPrefetchProp(prefetchProp) : _types.FetchStrategy.PPR;
    if ("TURBOPACK compile-time truthy", 1) {
        function createPropError(args) {
            return Object.defineProperty(new Error(`Failed prop type: The prop \`${args.key}\` expects a ${args.expected} in \`<Link>\`, but got \`${args.actual}\` instead.` + (typeof window !== 'undefined' ? "\nOpen your browser's console to view the Component stack trace." : '')), "__NEXT_ERROR_CODE", {
                value: "E319",
                enumerable: false,
                configurable: true
            });
        }
        // TypeScript trick for type-guarding:
        const requiredPropsGuard = {
            href: true
        };
        const requiredProps = Object.keys(requiredPropsGuard);
        requiredProps.forEach((key)=>{
            if (key === 'href') {
                if (props[key] == null || typeof props[key] !== 'string' && typeof props[key] !== 'object') {
                    throw createPropError({
                        key,
                        expected: '`string` or `object`',
                        actual: props[key] === null ? 'null' : typeof props[key]
                    });
                }
            } else {
                // TypeScript trick for type-guarding:
                const _ = key;
            }
        });
        // TypeScript trick for type-guarding:
        const optionalPropsGuard = {
            as: true,
            replace: true,
            scroll: true,
            shallow: true,
            passHref: true,
            prefetch: true,
            unstable_dynamicOnHover: true,
            onClick: true,
            onMouseEnter: true,
            onTouchStart: true,
            legacyBehavior: true,
            onNavigate: true,
            transitionTypes: true
        };
        const optionalProps = Object.keys(optionalPropsGuard);
        optionalProps.forEach((key)=>{
            const valType = typeof props[key];
            if (key === 'as') {
                if (props[key] && valType !== 'string' && valType !== 'object') {
                    throw createPropError({
                        key,
                        expected: '`string` or `object`',
                        actual: valType
                    });
                }
            } else if (key === 'onClick' || key === 'onMouseEnter' || key === 'onTouchStart' || key === 'onNavigate') {
                if (props[key] && valType !== 'function') {
                    throw createPropError({
                        key,
                        expected: '`function`',
                        actual: valType
                    });
                }
            } else if (key === 'replace' || key === 'scroll' || key === 'shallow' || key === 'passHref' || key === 'legacyBehavior' || key === 'unstable_dynamicOnHover') {
                if (props[key] != null && valType !== 'boolean') {
                    throw createPropError({
                        key,
                        expected: '`boolean`',
                        actual: valType
                    });
                }
            } else if (key === 'prefetch') {
                if (props[key] != null && valType !== 'boolean' && props[key] !== 'auto') {
                    throw createPropError({
                        key,
                        expected: '`boolean | "auto"`',
                        actual: valType
                    });
                }
            } else if (key === 'transitionTypes') {
                if (props[key] != null && !Array.isArray(props[key])) {
                    throw createPropError({
                        key,
                        expected: '`string[]`',
                        actual: valType
                    });
                }
            } else {
                // TypeScript trick for type-guarding:
                const _ = key;
            }
        });
    }
    const resolvedHref = asProp || hrefProp;
    const formattedHref = formatStringOrUrl(resolvedHref);
    if ("TURBOPACK compile-time truthy", 1) {
        if (props.locale) {
            (0, _warnonce.warnOnce)('The `locale` prop is not supported in `next/link` while using the `app` router. Read more about app router internalization: https://nextjs.org/docs/app/building-your-application/routing/internationalization');
        }
        if (!asProp) {
            let href;
            if (typeof resolvedHref === 'string') {
                href = resolvedHref;
            } else if (typeof resolvedHref === 'object' && typeof resolvedHref.pathname === 'string') {
                href = resolvedHref.pathname;
            }
            if (href) {
                const hasDynamicSegment = href.split('/').some((segment)=>segment.startsWith('[') && segment.endsWith(']'));
                if (hasDynamicSegment) {
                    throw Object.defineProperty(new Error(`Dynamic href \`${href}\` found in <Link> while using the \`/app\` router, this is not supported. Read more: https://nextjs.org/docs/messages/app-dir-dynamic-href`), "__NEXT_ERROR_CODE", {
                        value: "E267",
                        enumerable: false,
                        configurable: true
                    });
                }
            }
        }
    }
    // This will return the first child, if multiple are provided it will throw an error
    let child;
    if (legacyBehavior) {
        if (children?.$$typeof === Symbol.for('react.lazy')) {
            throw Object.defineProperty(new Error(`\`<Link legacyBehavior>\` received a direct child that is either a Server Component, or JSX that was loaded with React.lazy(). This is not supported. Either remove legacyBehavior, or make the direct child a Client Component that renders the Link's \`<a>\` tag.`), "__NEXT_ERROR_CODE", {
                value: "E863",
                enumerable: false,
                configurable: true
            });
        }
        if ("TURBOPACK compile-time truthy", 1) {
            if (onClick) {
                console.warn(`"onClick" was passed to <Link> with \`href\` of \`${formattedHref}\` but "legacyBehavior" was set. The legacy behavior requires onClick be set on the child of next/link`);
            }
            if (onMouseEnterProp) {
                console.warn(`"onMouseEnter" was passed to <Link> with \`href\` of \`${formattedHref}\` but "legacyBehavior" was set. The legacy behavior requires onMouseEnter be set on the child of next/link`);
            }
            try {
                child = _react.default.Children.only(children);
            } catch (err) {
                if (!children) {
                    throw Object.defineProperty(new Error(`No children were passed to <Link> with \`href\` of \`${formattedHref}\` but one child is required https://nextjs.org/docs/messages/link-no-children`), "__NEXT_ERROR_CODE", {
                        value: "E320",
                        enumerable: false,
                        configurable: true
                    });
                }
                throw Object.defineProperty(new Error(`Multiple children were passed to <Link> with \`href\` of \`${formattedHref}\` but only one child is supported https://nextjs.org/docs/messages/link-multiple-children` + (typeof window !== 'undefined' ? " \nOpen your browser's console to view the Component stack trace." : '')), "__NEXT_ERROR_CODE", {
                    value: "E266",
                    enumerable: false,
                    configurable: true
                });
            }
        } else //TURBOPACK unreachable
        ;
    } else {
        if ("TURBOPACK compile-time truthy", 1) {
            if (children?.type === 'a') {
                throw Object.defineProperty(new Error('Invalid <Link> with <a> child. Please remove <a> or use <Link legacyBehavior>.\nLearn more: https://nextjs.org/docs/messages/invalid-new-link-with-extra-anchor'), "__NEXT_ERROR_CODE", {
                    value: "E209",
                    enumerable: false,
                    configurable: true
                });
            }
        }
    }
    const childRef = legacyBehavior ? child && typeof child === 'object' && child.ref : forwardedRef;
    // Use a callback ref to attach an IntersectionObserver to the anchor tag on
    // mount. In the future we will also use this to keep track of all the
    // currently mounted <Link> instances, e.g. so we can re-prefetch them after
    // a revalidation or refresh.
    const observeLinkVisibilityOnMount = _react.default.useCallback({
        "LinkComponent.useCallback[observeLinkVisibilityOnMount]": (element)=>{
            if (router !== null) {
                linkInstanceRef.current = (0, _links.mountLinkInstance)(element, formattedHref, router, fetchStrategy, prefetchEnabled, setOptimisticLinkStatus);
            }
            return ({
                "LinkComponent.useCallback[observeLinkVisibilityOnMount]": ()=>{
                    if (linkInstanceRef.current) {
                        (0, _links.unmountLinkForCurrentNavigation)(linkInstanceRef.current);
                        linkInstanceRef.current = null;
                    }
                    (0, _links.unmountPrefetchableInstance)(element);
                }
            })["LinkComponent.useCallback[observeLinkVisibilityOnMount]"];
        }
    }["LinkComponent.useCallback[observeLinkVisibilityOnMount]"], [
        prefetchEnabled,
        formattedHref,
        router,
        fetchStrategy,
        setOptimisticLinkStatus
    ]);
    const mergedRef = (0, _usemergedref.useMergedRef)(observeLinkVisibilityOnMount, childRef);
    const childProps = {
        ref: mergedRef,
        onClick (e) {
            if ("TURBOPACK compile-time truthy", 1) {
                if (!e) {
                    throw Object.defineProperty(new Error(`Component rendered inside next/link has to pass click event to "onClick" prop.`), "__NEXT_ERROR_CODE", {
                        value: "E312",
                        enumerable: false,
                        configurable: true
                    });
                }
            }
            if (!legacyBehavior && typeof onClick === 'function') {
                onClick(e);
            }
            if (legacyBehavior && child.props && typeof child.props.onClick === 'function') {
                child.props.onClick(e);
            }
            if (!router) {
                return;
            }
            if (e.defaultPrevented) {
                return;
            }
            linkClicked(e, formattedHref, linkInstanceRef, replace, scroll, onNavigate, transitionTypes);
        },
        onMouseEnter (e) {
            if (!legacyBehavior && typeof onMouseEnterProp === 'function') {
                onMouseEnterProp(e);
            }
            if (legacyBehavior && child.props && typeof child.props.onMouseEnter === 'function') {
                child.props.onMouseEnter(e);
            }
            if (!router) {
                return;
            }
            if ("TURBOPACK compile-time truthy", 1) {
                return;
            }
            //TURBOPACK unreachable
            ;
            const upgradeToDynamicPrefetch = undefined;
        },
        onTouchStart: ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : function onTouchStart(e) {
            if (!legacyBehavior && typeof onTouchStartProp === 'function') {
                onTouchStartProp(e);
            }
            if (legacyBehavior && child.props && typeof child.props.onTouchStart === 'function') {
                child.props.onTouchStart(e);
            }
            if (!router) {
                return;
            }
            if (!prefetchEnabled) {
                return;
            }
            const upgradeToDynamicPrefetch = unstable_dynamicOnHover === true;
            (0, _links.onNavigationIntent)(e.currentTarget, upgradeToDynamicPrefetch);
        }
    };
    // If the url is absolute, we can bypass the logic to prepend the basePath.
    if ((0, _utils.isAbsoluteUrl)(formattedHref)) {
        childProps.href = formattedHref;
    } else if (!legacyBehavior || passHref || child.type === 'a' && !('href' in child.props)) {
        childProps.href = (0, _addbasepath.addBasePath)(formattedHref);
    }
    let link;
    if (legacyBehavior) {
        if ("TURBOPACK compile-time truthy", 1) {
            (0, _erroronce.errorOnce)('`legacyBehavior` is deprecated and will be removed in a future ' + 'release. A codemod is available to upgrade your components:\n\n' + 'npx @next/codemod@latest new-link .\n\n' + 'Learn more: https://nextjs.org/docs/app/building-your-application/upgrading/codemods#remove-a-tags-from-link-components');
        }
        link = /*#__PURE__*/ _react.default.cloneElement(child, childProps);
    } else {
        link = /*#__PURE__*/ (0, _jsxruntime.jsx)("a", {
            ...restProps,
            ...childProps,
            children: children
        });
    }
    return /*#__PURE__*/ (0, _jsxruntime.jsx)(LinkStatusContext.Provider, {
        value: linkStatus,
        children: link
    });
}
const LinkStatusContext = /*#__PURE__*/ (0, _react.createContext)(_links.IDLE_LINK_STATUS);
const useLinkStatus = ()=>{
    return (0, _react.useContext)(LinkStatusContext);
};
function getFetchStrategyFromPrefetchProp(prefetchProp) {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    else {
        return prefetchProp === null || prefetchProp === 'auto' ? _types.FetchStrategy.PPR : // (although invalid values should've been filtered out by prop validation in dev)
        _types.FetchStrategy.Full;
    }
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
}
}),
"[project]/node_modules/next/navigation.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {

module.exports = __turbopack_context__.r("[project]/node_modules/next/dist/client/components/navigation.js [app-client] (ecmascript)");
}),
]);

//# sourceMappingURL=_1sjmyvh._.js.map