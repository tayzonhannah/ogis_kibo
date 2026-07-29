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
    "MAX_AWAY_CREDIT_SECONDS",
    ()=>MAX_AWAY_CREDIT_SECONDS,
    "MEMO_MAX_LEN",
    ()=>MEMO_MAX_LEN,
    "ROOM_CAPACITY",
    ()=>ROOM_CAPACITY,
    "TANK_MOODS",
    ()=>TANK_MOODS,
    "TANK_MOOD_GRADIENT",
    ()=>TANK_MOOD_GRADIENT,
    "TANK_MOOD_LABELS",
    ()=>TANK_MOOD_LABELS,
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
/** Stable per-fish bob offset, so two fish never swim in lockstep. */ function bobPhaseFor(id) {
    let hash = 0;
    for(let i = 0; i < id.length; i += 1)hash = (hash * 31 + id.charCodeAt(i)) % 6283;
    return hash / 1000;
}
function drawFish(ctx, fish, height, seconds) {
    const bob = Math.sin(seconds * 1.1 + fish.bobPhase) * 5;
    const y = fish.yFrac * height + bob;
    const facing = fish.direction;
    ctx.save();
    ctx.translate(fish.x, y);
    ctx.scale(facing, 1);
    // Tail — sweeps opposite the bob, so the fish reads as swimming.
    const sweep = Math.sin(seconds * 5 + fish.bobPhase) * 4;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(-30, -9 + sweep);
    ctx.lineTo(-30, 9 + sweep);
    ctx.closePath();
    ctx.fillStyle = fish.color;
    ctx.globalAlpha = 0.75;
    ctx.fill();
    // Body
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = fish.color;
    ctx.fill();
    // Eye
    ctx.beginPath();
    ctx.arc(10, -2.5, 1.9, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8, 26, 38, 0.85)';
    ctx.fill();
    ctx.restore();
}
function Aquarium({ supabase, roomId, userId, mood = 'calm', onPeerChange }) {
    _s();
    const canvasRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const fishRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])([]);
    /** Ids to drop on the next frame: handoff confirmed, or ownership revoked. */ const pendingRemovalRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(new Set());
    const peersRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])([]);
    const channelRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const moodRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(mood);
    const [fishCount, setFishCount] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    // The render loop reads the mood from a ref so a mood change doesn't tear
    // down and restart the loop.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Aquarium.useEffect": ()=>{
            moodRef.current = mood;
        }
    }["Aquarium.useEffect"], [
        mood
    ]);
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
                    setFishCount(fishRef.current.length);
                }
            }["Aquarium.useEffect.adopt"];
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
                config: {
                    presence: {
                        key: userId
                    }
                }
            });
            channelRef.current = channel;
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
            }["Aquarium.useEffect"]).subscribe({
                "Aquarium.useEffect": (status)=>{
                    if (status !== 'SUBSCRIBED') return;
                    void ({
                        "Aquarium.useEffect": async ()=>{
                            await channel.track({
                                at: Date.now()
                            });
                            await recover();
                        }
                    })["Aquarium.useEffect"]();
                }
            }["Aquarium.useEffect"]);
            return ({
                "Aquarium.useEffect": ()=>{
                    active = false;
                    if (aloneTimer) clearTimeout(aloneTimer);
                    channelRef.current = null;
                    void supabase.removeChannel(channel);
                }
            })["Aquarium.useEffect"];
        }
    }["Aquarium.useEffect"], [
        supabase,
        roomId,
        userId,
        onPeerChange
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
    // ------------------------------------------------------- render + handoff
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Aquarium.useEffect": ()=>{
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (!canvas || !ctx) return;
            let raf = 0;
            let last = performance.now();
            const start = last;
            /**
     * Two-phase handoff. The fish is held locally, not removed, until the
     * `holder` write lands — so a failed write turns the fish around instead
     * of dropping it into nowhere.
     */ const handOff = {
                "Aquarium.useEffect.handOff": async (fish, peer)=>{
                    fish.handingOff = true;
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
                        return;
                    }
                    pendingRemovalRef.current.add(fish.id);
                }
            }["Aquarium.useEffect.handOff"];
            const paintBackground = {
                "Aquarium.useEffect.paintBackground": (width, height)=>{
                    const [top, bottom] = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TANK_MOOD_GRADIENT"][moodRef.current];
                    const gradient = ctx.createLinearGradient(0, 0, 0, height);
                    gradient.addColorStop(0, top);
                    gradient.addColorStop(1, bottom);
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
                    paintBackground(width, height);
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
                    if (removed) setFishCount(fishRef.current.length);
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
        userId
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("canvas", {
            ref: canvasRef,
            className: "block h-full w-full",
            role: "img",
            "aria-label": fishCount === 0 ? 'Shared aquarium. No fish on this screen right now.' : `Shared aquarium. ${fishCount} fish on this screen.`
        }, void 0, false, {
            fileName: "[project]/components/Aquarium.tsx",
            lineNumber: 375,
            columnNumber: 7
        }, this)
    }, void 0, false);
}
_s(Aquarium, "yz1YKz6UwtERMZyRBShNcGLBdao=");
_c = Aquarium;
var _c;
__turbopack_context__.k.register(_c, "Aquarium");
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
function RoomClient({ code }) {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const { supabase, userId, status, error: authError } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$AuthProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"])();
    const [join, setJoin] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        phase: 'waiting'
    });
    const [peerPresent, setPeerPresent] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [copied, setCopied] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
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
    // Stable identity: Aquarium re-subscribes its channel if this changes.
    const handlePeerChange = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "RoomClient.useCallback[handlePeerChange]": (present)=>{
            setPeerPresent(present);
        }
    }["RoomClient.useCallback[handlePeerChange]"], []);
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
            lineNumber: 110,
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
                    lineNumber: 117,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/RoomClient.tsx",
            lineNumber: 115,
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
                onPeerChange: handlePeerChange
            }, void 0, false, {
                fileName: "[project]/components/RoomClient.tsx",
                lineNumber: 130,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex h-full items-center justify-center",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-sm text-white/50",
                    children: status === 'loading' ? 'Connecting…' : 'Filling the tank…'
                }, void 0, false, {
                    fileName: "[project]/components/RoomClient.tsx",
                    lineNumber: 139,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/RoomClient.tsx",
                lineNumber: 137,
                columnNumber: 9
            }, this),
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
                            lineNumber: 148,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/RoomClient.tsx",
                        lineNumber: 147,
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
                                        lineNumber: 160,
                                        columnNumber: 13
                                    }, this),
                                    peerPresent ? 'together' : 'on your own'
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/RoomClient.tsx",
                                lineNumber: 159,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                onClick: ()=>void leave(),
                                className: "text-xs text-white/40 transition hover:text-white/80",
                                children: "leave"
                            }, void 0, false, {
                                fileName: "[project]/components/RoomClient.tsx",
                                lineNumber: 168,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/RoomClient.tsx",
                        lineNumber: 158,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/RoomClient.tsx",
                lineNumber: 146,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/RoomClient.tsx",
        lineNumber: 128,
        columnNumber: 5
    }, this);
}
_s(RoomClient, "s1HofMiHgwUSLSaQHNzdmXji6R0=", false, function() {
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
                    lineNumber: 191,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "mt-3 text-sm leading-relaxed text-white/60",
                    children: children
                }, void 0, false, {
                    fileName: "[project]/components/RoomClient.tsx",
                    lineNumber: 192,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/RoomClient.tsx",
            lineNumber: 190,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/RoomClient.tsx",
        lineNumber: 189,
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

//# sourceMappingURL=_1bcz1r7._.js.map