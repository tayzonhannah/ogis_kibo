'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { FISH_MARGIN, TANK_MOOD_GRADIENT, type TankMood } from '@/lib/constants';
import type { FishCrossPayload, FishDirection, FishRow } from '@/lib/types';

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

/** How long presence must report an empty room before we claim its fish. */
const ALONE_CLAIM_DELAY_MS = 3_000;

/** Stable per-fish bob offset, so two fish never swim in lockstep. */
function bobPhaseFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 6283;
  return hash / 1000;
}

function drawFish(
  ctx: CanvasRenderingContext2D,
  fish: LocalFish,
  height: number,
  seconds: number
) {
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

export default function Aquarium({
  supabase,
  roomId,
  userId,
  mood = 'calm',
  onPeerChange,
}: {
  supabase: SupabaseClient;
  roomId: string;
  userId: string;
  mood?: TankMood;
  onPeerChange?: (peerPresent: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fishRef = useRef<LocalFish[]>([]);
  /** Ids to drop on the next frame: handoff confirmed, or ownership revoked. */
  const pendingRemovalRef = useRef<Set<string>>(new Set());
  const peersRef = useRef<string[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const moodRef = useRef<TankMood>(mood);
  const [fishCount, setFishCount] = useState(0);

  // The render loop reads the mood from a ref so a mood change doesn't tear
  // down and restart the loop.
  useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

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
      setFishCount(fishRef.current.length);
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
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;

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
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        void (async () => {
          await channel.track({ at: Date.now() });
          await recover();
        })();
      });

    return () => {
      active = false;
      if (aloneTimer) clearTimeout(aloneTimer);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [supabase, roomId, userId, onPeerChange]);

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

  // ------------------------------------------------------- render + handoff
  useEffect(() => {
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
     */
    const handOff = async (fish: LocalFish, peer: string) => {
      fish.handingOff = true;

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
        return;
      }
      pendingRemovalRef.current.add(fish.id);
    };

    const paintBackground = (width: number, height: number) => {
      const [top, bottom] = TANK_MOOD_GRADIENT[moodRef.current];
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, top);
      gradient.addColorStop(1, bottom);
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

      paintBackground(width, height);

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

      if (removed) setFishCount(fishRef.current.length);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [supabase, roomId, userId]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
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
