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
"[project]/app/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Home
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$AuthProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/AuthProvider.tsx [app-client] (ecmascript)");
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
function Home() {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const { supabase, status, error: authError } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$AuthProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"])();
    const [code, setCode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [busy, setBusy] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [message, setMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const ready = status === 'ready' && supabase !== null;
    const openTank = async ()=>{
        if (!ready || busy) return;
        setBusy(true);
        setMessage(null);
        const { data, error } = await supabase.rpc('create_room');
        if (error) {
            setMessage(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ROOM_ERROR_COPY"][(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toRoomError"])(error.message)]);
            setBusy(false);
            return;
        }
        router.push(`/room/${data}`);
    };
    const enterTank = (event)=>{
        event.preventDefault();
        const normalized = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeCode"])(code);
        // Validate the shape here so a typo doesn't spend one of the ten join
        // attempts the database allows per fifteen minutes.
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isPlausibleCode"])(normalized)) {
            setMessage(`A tank code is ${__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CODE_LENGTH"]} letters and numbers.`);
            return;
        }
        setMessage(null);
        router.push(`/room/${normalized}`);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "flex min-h-dvh items-center justify-center p-8",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "kibo-fade-in w-full max-w-sm",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                    className: "text-3xl font-light tracking-[0.35em] text-white/90",
                    children: "KIBO"
                }, void 0, false, {
                    fileName: "[project]/app/page.tsx",
                    lineNumber: 47,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "mt-4 text-sm leading-relaxed text-white/55",
                    children: "A shared tank for two. Leave it be and it keeps going — the fish swim between your screens whether or not anyone says anything."
                }, void 0, false, {
                    fileName: "[project]/app/page.tsx",
                    lineNumber: 50,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    type: "button",
                    onClick: ()=>void openTank(),
                    disabled: !ready || busy,
                    className: "mt-10 w-full rounded-full bg-white/10 px-5 py-3 text-sm text-white/90 backdrop-blur-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40",
                    children: busy ? 'Filling a tank…' : 'Open a new tank'
                }, void 0, false, {
                    fileName: "[project]/app/page.tsx",
                    lineNumber: 55,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                    onSubmit: enterTank,
                    className: "mt-8",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                            htmlFor: "code",
                            className: "block text-xs uppercase tracking-[0.2em] text-white/40",
                            children: "or join one"
                        }, void 0, false, {
                            fileName: "[project]/app/page.tsx",
                            lineNumber: 65,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mt-3 flex gap-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    id: "code",
                                    value: code,
                                    onChange: (event)=>setCode(event.target.value),
                                    placeholder: "ABCD2345",
                                    autoCapitalize: "characters",
                                    autoComplete: "off",
                                    spellCheck: false,
                                    maxLength: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CODE_LENGTH"],
                                    className: "min-w-0 flex-1 rounded-full border border-white/15 bg-transparent px-4 py-3 font-mono text-sm uppercase tracking-[0.2em] text-white/90 placeholder:text-white/25 focus:border-white/40 focus:outline-none"
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 72,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "submit",
                                    disabled: !ready,
                                    className: "rounded-full border border-white/20 px-5 text-sm text-white/80 transition hover:border-white/50 disabled:cursor-not-allowed disabled:opacity-40",
                                    children: "Enter"
                                }, void 0, false, {
                                    fileName: "[project]/app/page.tsx",
                                    lineNumber: 83,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/page.tsx",
                            lineNumber: 71,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/page.tsx",
                    lineNumber: 64,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    "aria-live": "polite",
                    className: "mt-5 min-h-10 text-xs leading-relaxed text-amber-200/70",
                    children: [
                        message ?? (status === 'error' ? authError : null),
                        status === 'loading' && !message ? 'Connecting…' : null
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/page.tsx",
                    lineNumber: 93,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/page.tsx",
            lineNumber: 46,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/page.tsx",
        lineNumber: 45,
        columnNumber: 5
    }, this);
}
_s(Home, "qWGbnysIhPvlR6CKuV88HCaP2Pc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$AuthProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"]
    ];
});
_c = Home;
var _c;
__turbopack_context__.k.register(_c, "Home");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/node_modules/next/navigation.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {

module.exports = __turbopack_context__.r("[project]/node_modules/next/dist/client/components/navigation.js [app-client] (ecmascript)");
}),
]);

//# sourceMappingURL=_0vlfclo._.js.map