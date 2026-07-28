'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Aquarium from '@/components/Aquarium';
import { useAuth } from '@/components/AuthProvider';
import { useHeartbeat } from '@/lib/useHeartbeat';
import { normalizeCode } from '@/lib/constants';
import { ROOM_ERROR_COPY, toRoomError, type RoomError } from '@/lib/types';

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
  const joinedRef = useRef(false);

  const normalized = normalizeCode(code);

  useEffect(() => {
    if (!supabase || status !== 'ready' || !userId) return;
    // join_room is idempotent, but StrictMode's double-invoke would otherwise
    // fire two RPCs on every mount in dev.
    if (joinedRef.current) return;
    joinedRef.current = true;

    let active = true;
    setJoin({ phase: 'joining' });

    void (async () => {
      const { data, error } = await supabase.rpc('join_room', {
        room_code: normalized,
      });
      if (!active) return;
      if (error) {
        setJoin({ phase: 'error', error: toRoomError(error.message) });
        return;
      }
      setJoin({ phase: 'ready', roomId: data as string });
    })();

    return () => {
      active = false;
    };
  }, [supabase, status, userId, normalized]);

  const roomId = join.phase === 'ready' ? join.roomId : null;
  useHeartbeat(supabase, roomId, userId);

  // Stable identity: Aquarium re-subscribes its channel if this changes.
  const handlePeerChange = useCallback((present: boolean) => {
    setPeerPresent(present);
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
          onPeerChange={handlePeerChange}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-white/50">Filling the tank…</p>
        </div>
      )}

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
