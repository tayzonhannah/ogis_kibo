'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import {
  FISH_MARGIN,
  HEART_LIFETIME_MS,
  MAX_BUBBLES,
  MAX_CORALS,
  MAX_HEARTS,
  MEMO_BACKLOG,
  MEMO_LIFETIME_MS,
  MOOD_FADE_MS,
  PRESS_CANCEL_PX,
  RETRACT_HOLD_MS,
  TANK_MOOD_GRADIENT,
  WARMTH_LIFETIME_MS,
  type TankMood,
} from '@/lib/constants';
import type {
  FishCrossPayload,
  FishDirection,
  FishRow,
  HeartPayload,
  MemoPayload,
  MemoRetractedPayload,
  MemoRow,
  RoomRow,
  WarmthPayload,
} from '@/lib/types';

/**
 * A fish as this screen sees it. `x` is local CSS pixels and is never
 * persisted — a fish always enters at the edge it crossed into, so only the
 * vertical fraction and speed have to travel.
 */
type LocalFish = {
  id: string;
  x: number;
  yFrac: number;
  speedPxS: number;
  direction: FishDirection;
  color: string;
  bobPhase: number;
  /** True between "exited the screen" and "the holder write came back". */
  handingOff: boolean;
};

/** Warmth: a glow near the tank floor that swells and fades. Ephemeral. */
type Coral = { id: string; xFrac: number; bornAt: number };

/** A memo drifting upward. Persisted in `memos`; this is just its rendering. */
type Bubble = {
  id: string;
  body: string;
  xFrac: number;
  yFrac: number;
  bornAt: number;
  swayPhase: number;
  /** Last drawn bounds in CSS px, for click hit-testing. */
  hit: { x: number; y: number; w: number; h: number } | null;
};

/** A heart sent back in reply to a memo. Ephemeral. */
type Heart = { id: string; xFrac: number; yFrac: number; bornAt: number };

/** How long presence must report an empty room before we claim its fish. */
const ALONE_CLAIM_DELAY_MS = 3_000;

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const v = hex.replace('#', '');
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpRgb = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];
const rgbCss = ([r, g, b]: RGB) =>
  `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;

const moodStops = (mood: TankMood): [RGB, RGB] => {
  const [top, bottom] = TANK_MOOD_GRADIENT[mood];
  return [hexToRgb(top), hexToRgb(bottom)];
};

/** Stable pseudo-random in [0,1) from an id, so placement survives a reload. */
function hashUnit(id: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

const bobPhaseFor = (id: string) => hashUnit(id, 7) * 6.283;

/** Eased 0->1->0 envelope: fade in, hold, fade out. */
function envelope(age: number, life: number, fadeIn = 0.15, fadeOut = 0.3) {
  const t = age / life;
  if (t <= 0) return 0;
  if (t >= 1) return 0;
  if (t < fadeIn) return t / fadeIn;
  if (t > 1 - fadeOut) return (1 - t) / fadeOut;
  return 1;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
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

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFish(
  ctx: CanvasRenderingContext2D,
  fish: LocalFish,
  height: number,
  seconds: number
) {
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

function drawCoral(
  ctx: CanvasRenderingContext2D,
  coral: Coral,
  width: number,
  height: number,
  now: number,
  seconds: number
) {
  const alpha = envelope(now - coral.bornAt, WARMTH_LIFETIME_MS, 0.2, 0.45);
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
  for (let i = -1; i <= 1; i += 1) {
    const sway = Math.sin(seconds * 1.4 + i) * 6;
    ctx.lineWidth = 3.5 - Math.abs(i);
    ctx.beginPath();
    ctx.moveTo(x + i * 11, base);
    ctx.quadraticCurveTo(x + i * 14 + sway, base - 26, x + i * 9 + sway, base - 46);
    ctx.stroke();
  }

  ctx.restore();
}

function drawBubble(
  ctx: CanvasRenderingContext2D,
  bubble: Bubble,
  width: number,
  height: number,
  now: number,
  seconds: number,
  /** 0..1 progress of a retract hold on this bubble. Fades it as you hold. */
  pressT = 0
) {
  const age = now - bubble.bornAt;
  // The hold takes it most of the way out, so the removal at the end lands on an
  // already-faint bubble rather than snapping something solid out of existence.
  const alpha = envelope(age, MEMO_LIFETIME_MS, 0.04, 0.25) * (1 - 0.8 * pressT);
  if (alpha <= 0) {
    bubble.hit = null;
    return;
  }

  // Drifts upward over its life, with a slow sway.
  const rise = (age / MEMO_LIFETIME_MS) * height * 0.28;
  const sway = Math.sin(seconds * 0.6 + bubble.swayPhase) * 10;
  const cx = bubble.xFrac * width + sway;
  const cy = bubble.yFrac * height - rise;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '13px system-ui, sans-serif';
  ctx.textBaseline = 'top';

  const maxW = Math.min(width * 0.62, 230);
  const lines = wrapText(ctx, bubble.body, maxW - 24);
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
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
  lines.forEach((line, i) => ctx.fillText(line, x + 12, y + 9 + i * 18));

  ctx.restore();
  bubble.hit = { x, y, w, h };
}

function drawHeart(
  ctx: CanvasRenderingContext2D,
  heart: Heart,
  width: number,
  height: number,
  now: number
) {
  const age = now - heart.bornAt;
  const alpha = envelope(age, HEART_LIFETIME_MS, 0.1, 0.55);
  if (alpha <= 0) return;
  const x = heart.xFrac * width;
  const y = heart.yFrac * height - (age / HEART_LIFETIME_MS) * 70;
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

export default function Aquarium({
  supabase,
  roomId,
  userId,
  mood = 'calm',
  onPeerChange,
  onChannelReady,
  onRoomUpdate,
}: {
  supabase: SupabaseClient;
  roomId: string;
  userId: string;
  mood?: TankMood;
  onPeerChange?: (peerPresent: boolean) => void;
  /** Hands the shared channel up so the controls overlay can send on it. */
  onChannelReady?: (channel: RealtimeChannel | null) => void;
  /**
   * Room-level state that isn't drawn on the canvas. Aquarium owns the single
   * channel — Supabase requires every .on() before .subscribe() — so listeners
   * live here and forward upward rather than each component opening its own.
   */
  onRoomUpdate?: (row: RoomRow) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fishRef = useRef<LocalFish[]>([]);
  const coralsRef = useRef<Coral[]>([]);
  const bubblesRef = useRef<Bubble[]>([]);
  const heartsRef = useRef<Heart[]>([]);
  /** Ids to drop on the next frame: handoff confirmed, or ownership revoked. */
  const pendingRemovalRef = useRef<Set<string>>(new Set());
  const peersRef = useRef<string[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  /**
   * The in-flight press on a memo bubble, if any. A ref rather than state: the
   * render loop reads it every frame to fade the bubble, and one re-render per
   * frame is exactly what the canvas exists to avoid.
   */
  const pressRef = useRef<{
    bubbleId: string;
    startedAt: number;
    x: number;
    y: number;
    fired: boolean;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const moodFadeRef = useRef<{ from: [RGB, RGB]; to: [RGB, RGB]; startedAt: number }>(
    { from: moodStops(mood), to: moodStops(mood), startedAt: 0 }
  );
  const paintedRef = useRef<[RGB, RGB]>(moodStops(mood));
  const [fishCount, setFishCount] = useState(0);
  /**
   * "corals:bubbles:hearts" — the only readable signal for the ambient layer,
   * which is otherwise pure canvas pixels. Surfaced as a data attribute so the
   * E2E suite can assert that one client's warmth actually reaches the other.
   * Throttled, because it changes inside the render loop.
   */
  const [fx, setFx] = useState('0:0:0');
  const fxRef = useRef('0:0:0');
  /**
   * "x,y,w,h" of the topmost tappable memo bubble, in CSS px. Bubbles drift, so
   * without this a test (or any automation) has to guess where to click.
   */
  const [bubbleBox, setBubbleBox] = useState('');
  const bubbleBoxRef = useRef('');

  // Cross-fade from whatever is on screen right now, so a mood change during
  // an earlier fade does not snap.
  useEffect(() => {
    moodFadeRef.current = {
      from: [paintedRef.current[0], paintedRef.current[1]],
      to: moodStops(mood),
      startedAt: performance.now(),
    };
  }, [mood]);

  /**
   * Count of fish this screen is actually drawing — excludes any mid-handoff.
   * A fish in flight has already stopped being rendered here but stays in the
   * array until its holder write is confirmed, so counting it would claim the
   * fish is on two screens at once during that window.
   *
   * Called at every mutation point rather than from the render loop, because a
   * backgrounded tab still adopts fish (realtime callbacks keep firing) even
   * though requestAnimationFrame is paused.
   */
  const syncFishCount = useCallback(() => {
    setFishCount(fishRef.current.filter((fish) => !fish.handingOff).length);
  }, []);

  // ------------------------------------------------ realtime + reconciliation
  useEffect(() => {
    let active = true;
    let aloneTimer: ReturnType<typeof setTimeout> | null = null;

    const adopt = (fish: {
      id: string;
      y_frac: number;
      speed_px_s: number;
      direction: FishDirection;
      color: string;
    }) => {
      // Dedupe across broadcast / postgres_changes / recovery. adopt() pushes
      // synchronously and JS is single-threaded, so whichever signal lands
      // first always wins and the others see it here.
      if (fishRef.current.some((existing) => existing.id === fish.id)) return;
      pendingRemovalRef.current.delete(fish.id);

      const width = canvasRef.current?.clientWidth ?? 0;
      fishRef.current.push({
        id: fish.id,
        x: fish.direction === 1 ? -FISH_MARGIN : width + FISH_MARGIN,
        yFrac: fish.y_frac,
        speedPxS: fish.speed_px_s,
        direction: fish.direction,
        color: fish.color,
        bobPhase: bobPhaseFor(fish.id),
        handingOff: false,
      });
      syncFishCount();
    };

    const addCoral = (id: string, xFrac: number) => {
      if (coralsRef.current.some((c) => c.id === id)) return;
      coralsRef.current.push({ id, xFrac, bornAt: performance.now() });
      if (coralsRef.current.length > MAX_CORALS) coralsRef.current.shift();
    };

    const addBubble = (id: string, body: string, xFrac: number, yFrac: number) => {
      if (bubblesRef.current.some((b) => b.id === id)) return;
      bubblesRef.current.push({
        id,
        body,
        xFrac,
        yFrac,
        bornAt: performance.now(),
        swayPhase: hashUnit(id, 3) * 6.283,
        hit: null,
      });
      if (bubblesRef.current.length > MAX_BUBBLES) bubblesRef.current.shift();
    };

    const addHeart = (id: string, xFrac: number, yFrac: number) => {
      if (heartsRef.current.some((h) => h.id === id)) return;
      heartsRef.current.push({ id, xFrac, yFrac, bornAt: performance.now() });
      if (heartsRef.current.length > MAX_HEARTS) heartsRef.current.shift();
    };

    /**
     * Pick up anything released by a departed participant, then load
     * everything we hold. This is what makes a refresh non-destructive.
     */
    const recover = async () => {
      await supabase
        .from('fish')
        .update({ holder: userId })
        .eq('room_id', roomId)
        .is('holder', null);

      const { data } = await supabase
        .from('fish')
        .select('*')
        .eq('room_id', roomId)
        .eq('holder', userId);

      if (!active) return;
      (data as FishRow[] | null)?.forEach(adopt);
    };

    /** Recent memos become bubbles, so arriving later still shows you them. */
    const loadMemos = async () => {
      const { data } = await supabase
        .from('memos')
        .select('id, body, created_at')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(MEMO_BACKLOG);
      if (!active) return;
      const rows = (data as Pick<MemoRow, 'id' | 'body' | 'created_at'>[]) ?? [];
      // Oldest first, so the newest ends up nearest the bottom.
      [...rows].reverse().forEach((m) => {
        addBubble(m.id, m.body, 0.25 + hashUnit(m.id) * 0.5, 0.55 + hashUnit(m.id, 1) * 0.3);
      });
    };

    /**
     * Presence says we are alone, so any fish still assigned to the absent
     * partner would be stranded — nobody is simulating it. Claim the room.
     * Debounced, because a momentary websocket blip also empties presence.
     */
    const claimStranded = async () => {
      if (peersRef.current.length > 0) return;
      await supabase
        .from('fish')
        .update({ holder: userId })
        .eq('room_id', roomId)
        .or(`holder.is.null,holder.neq.${userId}`);
      if (active) await recover();
    };

    const channel = supabase.channel(`room:${roomId}`, {
      // self: true so a sender also sees its own warmth / memo / heart. The
      // FISH_CROSS handler filters on toUser, so it is unaffected.
      config: { presence: { key: userId }, broadcast: { self: true } },
    });
    channelRef.current = channel;
    onChannelReady?.(channel);

    channel
      .on('presence', { event: 'sync' }, () => {
        const peers = Object.keys(channel.presenceState()).filter(
          (id) => id !== userId
        );
        peersRef.current = peers;
        onPeerChange?.(peers.length > 0);

        if (aloneTimer) {
          clearTimeout(aloneTimer);
          aloneTimer = null;
        }
        if (peers.length === 0) {
          aloneTimer = setTimeout(() => void claimStranded(), ALONE_CLAIM_DELAY_MS);
        }
      })
      .on('broadcast', { event: 'FISH_CROSS' }, ({ payload }) => {
        const crossing = payload as FishCrossPayload;
        if (crossing.toUser !== userId) return;
        adopt({
          id: crossing.fishId,
          y_frac: crossing.y_frac,
          speed_px_s: crossing.speed_px_s,
          direction: crossing.direction,
          color: crossing.color,
        });
      })
      .on('broadcast', { event: 'WARMTH_SENT' }, ({ payload }) => {
        const warmth = payload as WarmthPayload;
        addCoral(warmth.id, warmth.xFrac);
      })
      .on('broadcast', { event: 'MEMO_SENT' }, ({ payload }) => {
        const memo = payload as MemoPayload;
        addBubble(memo.id, memo.body, memo.xFrac, memo.yFrac);
      })
      .on('broadcast', { event: 'HEART_SENT' }, ({ payload }) => {
        const heart = payload as HeartPayload;
        addHeart(heart.id, heart.xFrac, heart.yFrac);
      })
      .on('broadcast', { event: 'MEMO_RETRACTED' }, ({ payload }) => {
        // The only live path for a retraction: the soft-deleted row stops
        // satisfying the memos SELECT policy, so postgres_changes cannot carry
        // it. See MemoRetractedPayload. Self-delivery is harmless — the sender
        // has already removed it.
        const { id } = payload as MemoRetractedPayload;
        bubblesRef.current = bubblesRef.current.filter((b) => b.id !== id);
      })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'fish',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as FishRow;
          if (row.holder === userId) {
            adopt(row);
            return;
          }
          // Postgres is authoritative in both directions: if a fish is no
          // longer ours, stop drawing it. Without this, a claim by the other
          // side would leave the same fish rendered on both screens.
          if (fishRef.current.some((fish) => fish.id === row.id)) {
            pendingRemovalRef.current.add(row.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          onRoomUpdate?.(payload.new as RoomRow);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'memos',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          // Safety net for a dropped MEMO_SENT broadcast, same split as fish.
          const row = payload.new as MemoRow;
          addBubble(
            row.id,
            row.body,
            0.25 + hashUnit(row.id) * 0.5,
            0.55 + hashUnit(row.id, 1) * 0.3
          );
        }
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        void (async () => {
          await channel.track({ at: Date.now() });
          await recover();
          await loadMemos();
        })();
      });

    return () => {
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
    syncFishCount,
  ]);

  // ------------------------------------------------------------ canvas sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
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
    return () => observer.disconnect();
  }, []);

  // ------------------------------- tap a memo for a heart, hold to retract it
  //
  // One pointer, two gestures, resolved by duration. Tap fires on pointerup so
  // that a press which becomes a hold does not also send a heart, and a drag
  // across the tank sends neither.

  const clearPress = useCallback(() => {
    const press = pressRef.current;
    if (press) clearTimeout(press.timer);
    pressRef.current = null;
  }, []);

  const retract = useCallback(
    async (memoId: string) => {
      // Awaited, not fired: the bubble should only disappear once the row really
      // is retracted. Retraction goes through the RPC because a client UPDATE
      // cannot soft-delete a row the SELECT policy then hides — see migration
      // 0004.
      const { error } = await supabase.rpc('retract_memo', {
        target_memo: memoId,
      });

      if (error) {
        console.warn(`[kibo] retract_memo failed: ${error.message}`);
        pressRef.current = null; // lets the bubble fade back in
        return;
      }

      bubblesRef.current = bubblesRef.current.filter((b) => b.id !== memoId);
      pressRef.current = null;

      const payload: MemoRetractedPayload = { id: memoId };
      void channelRef.current?.send({
        type: 'broadcast',
        event: 'MEMO_RETRACTED',
        payload,
      });
    },
    [supabase]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;

      // Topmost (most recently added) bubble wins.
      for (let i = bubblesRef.current.length - 1; i >= 0; i -= 1) {
        const b = bubblesRef.current[i];
        const hit = b.hit;
        if (!hit) continue;
        if (px >= hit.x && px <= hit.x + hit.w && py >= hit.y && py <= hit.y + hit.h) {
          // Keep receiving move/up even if the finger slides off the bubble, or
          // off the canvas entirely. Bubbles drift while you hold one.
          try {
            canvas.setPointerCapture(event.pointerId);
          } catch {
            // Not fatal: without capture the gesture still works as long as the
            // pointer stays over the canvas, which fills the viewport.
          }
          const id = b.id;
          pressRef.current = {
            bubbleId: id,
            startedAt: performance.now(),
            x: event.clientX,
            y: event.clientY,
            fired: false,
            timer: setTimeout(() => {
              const press = pressRef.current;
              if (!press || press.bubbleId !== id) return;
              press.fired = true;
              void retract(id);
            }, RETRACT_HOLD_MS),
          };
          return;
        }
      }
    },
    [retract]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const press = pressRef.current;
      if (!press || press.fired) return;
      const dx = event.clientX - press.x;
      const dy = event.clientY - press.y;
      if (Math.hypot(dx, dy) > PRESS_CANCEL_PX) clearPress();
    },
    [clearPress]
  );

  const handlePointerUp = useCallback(() => {
    const press = pressRef.current;
    if (!press) return;
    // The hold already fired; releasing must not also send a heart.
    if (press.fired) return;

    const bubble = bubblesRef.current.find((b) => b.id === press.bubbleId);
    clearPress();

    const canvas = canvasRef.current;
    const hit = bubble?.hit;
    if (!canvas || !hit) return;
    const rect = canvas.getBoundingClientRect();

    const payload: HeartPayload = {
      id: `${bubble.id}:${Date.now()}`,
      xFrac: (hit.x + hit.w / 2) / rect.width,
      yFrac: hit.y / rect.height,
    };
    void channelRef.current?.send({
      type: 'broadcast',
      event: 'HEART_SENT',
      payload,
    });
  }, [clearPress]);

  // ------------------------------------------------------- render + handoff
  useEffect(() => {
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
     */
    const handOff = async (fish: LocalFish, peer: string) => {
      fish.handingOff = true;
      // We have stopped drawing it as of now, so stop counting it as of now.
      syncFishCount();

      const payload: FishCrossPayload = {
        fishId: fish.id,
        y_frac: fish.yFrac,
        speed_px_s: fish.speedPxS,
        direction: fish.direction,
        color: fish.color,
        toUser: peer,
      };
      // Fast path. Lossy by design; the write below is the truth.
      void channelRef.current?.send({
        type: 'broadcast',
        event: 'FISH_CROSS',
        payload,
      });

      const { error } = await supabase
        .from('fish')
        .update({
          holder: peer,
          direction: fish.direction,
          y_frac: fish.yFrac,
        })
        .eq('id', fish.id);

      if (error) {
        // Keep the fish, turn it around, try again on the next lap.
        fish.handingOff = false;
        fish.direction = (fish.direction * -1) as FishDirection;
        syncFishCount();
        return;
      }
      pendingRemovalRef.current.add(fish.id);
    };

    const paintBackground = (width: number, height: number, now: number) => {
      const fade = moodFadeRef.current;
      const t = fade.startedAt
        ? Math.min(1, (now - fade.startedAt) / MOOD_FADE_MS)
        : 1;
      const top = lerpRgb(fade.from[0], fade.to[0], t);
      const bottom = lerpRgb(fade.from[1], fade.to[1], t);
      paintedRef.current = [top, bottom];

      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, rgbCss(top));
      gradient.addColorStop(1, rgbCss(bottom));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    };

    const frame = (now: number) => {
      // Clamp so a backgrounded tab doesn't teleport every fish on return.
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const seconds = (now - start) / 1000;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      paintBackground(width, height, now);

      // Warmth sits behind the fish, near the floor.
      coralsRef.current = coralsRef.current.filter(
        (c) => now - c.bornAt < WARMTH_LIFETIME_MS
      );
      for (const coral of coralsRef.current) {
        drawCoral(ctx, coral, width, height, now, seconds);
      }

      const pending = pendingRemovalRef.current;
      let removed = false;

      fishRef.current = fishRef.current.filter((fish) => {
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

        const exitedRight = fish.direction === 1 && fish.x > width + FISH_MARGIN;
        const exitedLeft = fish.direction === -1 && fish.x < -FISH_MARGIN;
        if (!exitedRight && !exitedLeft) return true;

        const peer = peersRef.current[0];
        if (!peer) {
          // Nobody to receive it — reflect rather than lose the fish.
          fish.direction = (fish.direction * -1) as FishDirection;
          return true;
        }
        void handOff(fish, peer);
        return true;
      });

      // Memos and hearts read in front of the fish.
      bubblesRef.current = bubblesRef.current.filter(
        (b) => now - b.bornAt < MEMO_LIFETIME_MS
      );
      const press = pressRef.current;
      for (const bubble of bubblesRef.current) {
        const pressT =
          press && press.bubbleId === bubble.id
            ? Math.min(1, (now - press.startedAt) / RETRACT_HOLD_MS)
            : 0;
        drawBubble(ctx, bubble, width, height, now, seconds, pressT);
      }

      heartsRef.current = heartsRef.current.filter(
        (h) => now - h.bornAt < HEART_LIFETIME_MS
      );
      for (const heart of heartsRef.current) {
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

        let topHit: Bubble['hit'] = null;
        for (let i = bubblesRef.current.length - 1; i >= 0; i -= 1) {
          if (bubblesRef.current[i].hit) {
            topHit = bubblesRef.current[i].hit;
            break;
          }
        }
        const boxNext = topHit
          ? `${Math.round(topHit.x)},${Math.round(topHit.y)},${Math.round(topHit.w)},${Math.round(topHit.h)}`
          : '';
        if (boxNext !== bubbleBoxRef.current) {
          bubbleBoxRef.current = boxNext;
          setBubbleBox(boxNext);
        }
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [supabase, roomId, userId, syncFishCount]);

  return (
    <>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={clearPress}
        className="block h-full w-full touch-none"
        data-kibo-fx={fx}
        data-kibo-bubble={bubbleBox}
        role="img"
        aria-label={
          fishCount === 0
            ? 'Shared aquarium. No fish on this screen right now.'
            : `Shared aquarium. ${fishCount} fish on this screen.`
        }
      />
      {/* Deliberately not aria-live: fish cross every few seconds, and a live
          region would turn that into constant screen-reader chatter. */}
    </>
  );
}
