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
    const canvasRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const fishRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])([]);
    /** Ids to drop on the next frame: handoff confirmed, or ownership revoked. */ const pendingRemovalRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(new Set());
    const peersRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])([]);
    const channelRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const moodRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(mood);
    const [fishCount, setFishCount] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(0);
    // The render loop reads the mood from a ref so a mood change doesn't tear
    // down and restart the loop.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        moodRef.current = mood;
    }, [
        mood
    ]);
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
            setFishCount(fishRef.current.length);
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
            config: {
                presence: {
                    key: userId
                }
            }
        });
        channelRef.current = channel;
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
        }).subscribe((status)=>{
            if (status !== 'SUBSCRIBED') return;
            void (async ()=>{
                await channel.track({
                    at: Date.now()
                });
                await recover();
            })();
        });
        return ()=>{
            active = false;
            if (aloneTimer) clearTimeout(aloneTimer);
            channelRef.current = null;
            void supabase.removeChannel(channel);
        };
    }, [
        supabase,
        roomId,
        userId,
        onPeerChange
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
    // ------------------------------------------------------- render + handoff
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
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
     */ const handOff = async (fish, peer)=>{
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
        };
        const paintBackground = (width, height)=>{
            const [top, bottom] = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TANK_MOOD_GRADIENT"][moodRef.current];
            const gradient = ctx.createLinearGradient(0, 0, 0, height);
            gradient.addColorStop(0, top);
            gradient.addColorStop(1, bottom);
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
            paintBackground(width, height);
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
            if (removed) setFishCount(fishRef.current.length);
            raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
        return ()=>cancelAnimationFrame(raf);
    }, [
        supabase,
        roomId,
        userId
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("canvas", {
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
function RoomClient({ code }) {
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRouter"])();
    const { supabase, userId, status, error: authError } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$AuthProvider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuth"])();
    const [join, setJoin] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({
        phase: 'waiting'
    });
    const [peerPresent, setPeerPresent] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [copied, setCopied] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
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
    // Stable identity: Aquarium re-subscribes its channel if this changes.
    const handlePeerChange = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((present)=>{
        setPeerPresent(present);
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
            lineNumber: 110,
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "relative h-dvh w-full overflow-hidden",
        children: [
            roomId && supabase && userId ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$Aquarium$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                supabase: supabase,
                roomId: roomId,
                userId: userId,
                onPeerChange: handlePeerChange
            }, void 0, false, {
                fileName: "[project]/components/RoomClient.tsx",
                lineNumber: 130,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex h-full items-center justify-center",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
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
                            lineNumber: 148,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/RoomClient.tsx",
                        lineNumber: 147,
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
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
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
                    lineNumber: 191,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
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
}),
];

//# sourceMappingURL=_1r5893g._.js.map