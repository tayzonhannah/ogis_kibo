'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { RealtimeChannel } from '@supabase/supabase-js';
import Aquarium from '@/components/Aquarium';
import TankControls from '@/components/TankControls';
import { useAuth } from '@/components/AuthProvider';
import { useHeartbeat } from '@/lib/useHeartbeat';
import { normalizeCode, type TankMood } from '@/lib/constants';
import {
  ROOM_ERROR_COPY,
  joinStatusToError,
  toRoomError,
  type JoinRoomRow,
  type RoomError,
  type RoomRow,
} from '@/lib/types';

type JoinState =
  | { phase: 'waiting' }
  | { phase: 'joining' }
  | { phase: 'ready'; roomId: string }
  | { phase: 'error'; error: RoomError };

export default function RoomClient({ code }: { code: string }) {
  const router = useRouter();
  const { supabase, userId, status, error: authError } = useAuth();
  const [join, setJoin] = useState<JoinState>({ phase: 'waiting' });
  const [peerPresent, setPeerPresent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mood, setMood] = useState<TankMood>('calm');
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const joinedRef = useRef(false);

  const normalized = normalizeCode(code);

  useEffect(() => {
    if (!supabase || status !== 'ready' || !userId) return;
    // join_room is idempotent, but there is no reason to fire two RPCs per
    // mount in dev. As in AuthProvider, this run-once guard must NOT be paired
    // with an abort-on-cleanup flag: under StrictMode the guard blocks the
    // retry while the flag discards the first result, and the join never
    // resolves.
    if (joinedRef.current) return;
    joinedRef.current = true;

    setJoin({ phase: 'joining' });

    // Never hang silently. Without this, any rejection or stalled request
    // leaves the page on "Filling the tank..." forever with nothing to go on.
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) setJoin({ phase: 'error', error: 'timeout' });
    }, 15_000);

    void (async () => {
      try {
        const { data, error } = await supabase.rpc('join_room', {
          room_code: normalized,
        });

        // A raised error means no session at all. Everything else — unknown
        // code, full room, throttled — comes back as a status row, so that the
        // rate-limiter's ledger write survives the transaction.
        if (error) {
          setJoin({ phase: 'error', error: toRoomError(error.message) });
          return;
        }
        const row = (data as JoinRoomRow[] | null)?.[0];
        if (!row || row.status !== 'ok' || !row.joined_room) {
          setJoin({ phase: 'error', error: joinStatusToError(row?.status) });
          return;
        }
        setJoin({ phase: 'ready', roomId: row.joined_room });
      } catch (cause) {
        // supabase-js normally resolves with {error}, but a network-level
        // failure rejects. Surface it instead of stalling.
        console.error('join_room failed', cause);
        setJoin({ phase: 'error', error: 'unknown' });
      } finally {
        settled = true;
        clearTimeout(timer);
      }
    })();
  }, [supabase, status, userId, normalized]);

  const roomId = join.phase === 'ready' ? join.roomId : null;
  useHeartbeat(supabase, roomId, userId);

  // Initial mood. Live changes arrive via Aquarium's rooms listener below.
  useEffect(() => {
    if (!supabase || !roomId) return;
    void (async () => {
      const { data } = await supabase
        .from('rooms')
        .select('tank_mood')
        .eq('id', roomId)
        .single();
      const next = (data as Pick<RoomRow, 'tank_mood'> | null)?.tank_mood;
      if (next) setMood(next);
    })();
  }, [supabase, roomId]);

  // These three must be referentially stable: they are dependencies of
  // Aquarium's channel effect, and a new identity would tear down and re-open
  // the realtime subscription on every render.
  const handlePeerChange = useCallback((present: boolean) => {
    setPeerPresent(present);
  }, []);

  const handleChannelReady = useCallback((next: RealtimeChannel | null) => {
    setChannel(next);
  }, []);

  const handleRoomUpdate = useCallback((row: RoomRow) => {
    if (row.tank_mood) setMood(row.tank_mood);
  }, []);

  const leave = async () => {
    if (supabase && roomId) await supabase.rpc('leave_room', { target_room: roomId });
    router.push('/');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/room/${normalized}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (status === 'error') {
    return <Notice title="Can't reach the tank">{authError}</Notice>;
  }

  if (join.phase === 'error') {
    return (
      <Notice title="This tank didn't open">
        {ROOM_ERROR_COPY[join.error]}
        <Link
          href="/"
          className="mt-6 inline-block rounded-full border border-white/25 px-5 py-2 text-sm transition hover:border-white/50"
        >
          Back to the surface
        </Link>
      </Notice>
    );
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      {roomId && supabase && userId ? (
        <Aquarium
          supabase={supabase}
          roomId={roomId}
          userId={userId}
          mood={mood}
          onPeerChange={handlePeerChange}
          onChannelReady={handleChannelReady}
          onRoomUpdate={handleRoomUpdate}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          {/* Distinct copy per stage, so a stall says which step it stalled on. */}
          <p className="text-sm text-white/50">
            {status === 'loading' ? 'Connecting…' : 'Filling the tank…'}
          </p>
        </div>
      )}

      {roomId && supabase && userId ? (
        <TankControls
          supabase={supabase}
          roomId={roomId}
          userId={userId}
          channel={channel}
          mood={mood}
          onMoodPicked={setMood}
        />
      ) : null}

      {/* Overlay. Deliberately quiet: presence is ambient, not a status feed. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-5">
        <div className="kibo-fade-in pointer-events-auto">
          <button
            type="button"
            onClick={copyLink}
            className="rounded-full bg-black/25 px-4 py-2 font-mono text-sm tracking-[0.2em] text-white/80 backdrop-blur-sm transition hover:text-white"
            title="Copy the invite link"
          >
            {copied ? 'link copied' : normalized}
          </button>
        </div>

        <div className="kibo-fade-in pointer-events-auto flex items-center gap-4">
          <span className="flex items-center gap-2 text-xs text-white/55">
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full transition-colors duration-1000 ${
                peerPresent ? 'bg-teal-300' : 'bg-white/25'
              }`}
            />
            {peerPresent ? 'together' : 'on your own'}
          </span>
          <button
            type="button"
            onClick={() => void leave()}
            className="text-xs text-white/40 transition hover:text-white/80"
          >
            leave
          </button>
        </div>
      </div>
    </main>
  );
}

function Notice({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex h-dvh items-center justify-center p-8">
      <div className="kibo-fade-in max-w-sm text-center">
        <h1 className="text-lg font-medium">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/60">{children}</p>
      </div>
    </main>
  );
}
