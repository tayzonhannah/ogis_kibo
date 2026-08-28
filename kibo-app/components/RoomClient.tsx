'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { RealtimeChannel } from '@supabase/supabase-js';
import Aquarium from '@/components/Aquarium';
import LoveLanguagePicker from '@/components/LoveLanguagePicker';
import NudgeBanner from '@/components/NudgeBanner';
import NutrientMeter from '@/components/NutrientMeter';
import TankControls from '@/components/TankControls';
import TankSwitcher from '@/components/TankSwitcher';
import ConnectMomentModal from '@/components/ConnectMomentModal';
import ConnectMomentHUD from '@/components/ConnectMomentHUD';
import TimeCapsulesDrawer from '@/components/TimeCapsulesDrawer';
import { AmbientAudioListener } from '@/components/AmbientAudioListener';
import { NotificationManager, triggerPushNotification } from '@/components/NotificationManager';
import { useAuth } from '@/components/AuthProvider';
import { useCoAway } from '@/lib/useCoAway';
import { useHeartbeat } from '@/lib/useHeartbeat';
import { normalizeCode, type TankMood } from '@/lib/constants';
import {
  ROOM_ERROR_COPY,
  joinStatusToError,
  toRoomError,
  type ConnectMomentCategory,
  type ConnectMomentSession,
  type ConnectMomentStartPayload,
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
  const { supabase, userId, profile, status, error: authError, refreshProfile } =
    useAuth();
  const [join, setJoin] = useState<JoinState>({ phase: 'waiting' });
  const [peerPresent, setPeerPresent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mood, setMood] = useState<TankMood>('calm');
  const [roomName, setRoomName] = useState<string>('Shared Tank');
  // Kept separate from mood rather than holding the whole RoomRow: the mood
  // pick is optimistic and has to apply before the initial fetch resolves,
  // which a single nullable row object cannot express.
  const [nutrients, setNutrients] = useState<{
    seconds: number;
    coAwaySince: string | null;
  }>({ seconds: 0, coAwaySince: null });
  // Both halves travel together: the text is what to say, the timestamp is the
  // identity the banner dedupes on. One without the other cannot be rendered.
  const [nudge, setNudge] = useState<{
    text: string | null;
    at: string | null;
  }>({ text: null, at: null });
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const joinedRef = useRef(false);

  // Milestone 4 Features State
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [activeSession, setActiveSession] =
    useState<ConnectMomentSession | null>(null);
  const [timeCapsulesOpen, setTimeCapsulesOpen] = useState(false);
  const [participants, setParticipants] = useState<
    Array<{ id: string; displayName?: string; avatarUrl?: string }>
  >([]);

  const normalized = normalizeCode(code);

  useEffect(() => {
    if (!supabase || status !== 'ready' || !userId) return;
    if (joinedRef.current) return;
    joinedRef.current = true;

    setJoin({ phase: 'joining' });

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) setJoin({ phase: 'error', error: 'timeout' });
    }, 15_000);

    void (async () => {
      try {
        const { data, error } = await supabase.rpc('join_room', {
          room_code: normalized,
        });

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
  useCoAway(supabase, roomId, userId);

  // Initial room state. Live changes arrive via Aquarium's rooms listener below.
  useEffect(() => {
    if (!supabase || !roomId) return;

    let active = true;

    const load = async () => {
      const { data } = await supabase
        .from('rooms')
        .select(
<<<<<<< Updated upstream
          'tank_mood, nutrient_seconds, co_away_since, nudge_text, last_nudged_at'
=======
          'name, tank_mood, nutrient_seconds, co_away_since, nudge_text, last_nudged_at'
>>>>>>> Stashed changes
        )
        .eq('id', roomId)
        .single();
      if (!active || !data) return;
      const row = data as Pick<
        RoomRow,
<<<<<<< Updated upstream
=======
        | 'name'
>>>>>>> Stashed changes
        | 'tank_mood'
        | 'nutrient_seconds'
        | 'co_away_since'
        | 'nudge_text'
        | 'last_nudged_at'
      >;
      if (row.name) setRoomName(row.name);
      if (row.tank_mood) setMood(row.tank_mood);
      setNutrients({
        seconds: row.nutrient_seconds,
        coAwaySince: row.co_away_since,
      });
<<<<<<< Updated upstream
      // This read is the nudge's entire delivery path until Web Push lands, and
      // the reason it works is that the effect below also re-runs on
      // visibilitychange: a cron job that writes at 04:00 has nobody watching,
      // so "on next open" is literally when this fires.
=======
>>>>>>> Stashed changes
      setNudge({ text: row.nudge_text, at: row.last_nudged_at });
    };

    void load();

    // Fetch room participants for avatars and HUD
    const loadParticipants = async () => {
      const { data } = await supabase
        .from('room_participants')
        .select('user_id')
        .eq('room_id', roomId);
      if (data && active) {
        const uids = data.map((d: { user_id: string }) => d.user_id);
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', uids);
        if (profs && active) {
          setParticipants(
            profs.map((p) => ({
              id: p.id,
              displayName: p.display_name ?? undefined,
              avatarUrl: p.avatar_url ?? undefined,
            }))
          );
        }
      }
    };
    void loadParticipants();

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void load();
        void loadParticipants();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [supabase, roomId]);

  // Channel broadcast listeners for Connect Moment
  useEffect(() => {
    if (!channel) return;

    channel
      .on('broadcast', { event: 'CONNECT_MOMENT_START' }, ({ payload }) => {
        const p = payload as ConnectMomentStartPayload;
        setActiveSession({
          id: p.id,
          category: p.category,
          targetDurationMinutes: p.targetDurationMinutes,
          multiplier: p.multiplier,
          active: true,
          startedAt: p.startedAt,
          initiatorId: p.initiatorId,
          initiatorName: p.initiatorName,
        });
      })
      .on('broadcast', { event: 'CONNECT_MOMENT_END' }, () => {
        setActiveSession(null);
      });
  }, [channel]);

  // Connect Moment Handlers
  const handleStartConnectMoment = (
    category: ConnectMomentCategory,
    durationMinutes: number,
    multiplier: number
  ) => {
    if (!channel || !userId) return;
    const sessionId = `cm_${Date.now()}_${userId.slice(0, 6)}`;
    const startedAt = Date.now();
    const sessionData: ConnectMomentSession = {
      id: sessionId,
      category,
      targetDurationMinutes: durationMinutes,
      multiplier,
      active: true,
      startedAt,
      initiatorId: userId,
      initiatorName: profile?.displayName || 'Aquanaut',
    };

    setActiveSession(sessionData);

    void channel.send({
      type: 'broadcast',
      event: 'CONNECT_MOMENT_START',
      payload: sessionData,
    });
  };

  const handleCancelConnectMoment = () => {
    if (channel && activeSession) {
      void channel.send({
        type: 'broadcast',
        event: 'CONNECT_MOMENT_END',
        payload: {
          id: activeSession.id,
          completed: false,
          actualDurationMinutes: 0,
          pointsEarned: 0,
        },
      });
    }
    setActiveSession(null);
  };

  const handleCompleteConnectMoment = async () => {
    if (!activeSession) return;
    const bonusPoints = Math.round(
      activeSession.targetDurationMinutes * activeSession.multiplier * 2
    );

    if (supabase && userId) {
      const currentPoints = profile?.fishPoints ?? 0;
      await supabase
        .from('profiles')
        .update({
          fish_points: currentPoints + bonusPoints,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
      void refreshProfile();
    }

    if (channel) {
      void channel.send({
        type: 'broadcast',
        event: 'CONNECT_MOMENT_END',
        payload: {
          id: activeSession.id,
          completed: true,
          actualDurationMinutes: activeSession.targetDurationMinutes,
          pointsEarned: bonusPoints,
        },
      });
    }

    setActiveSession(null);
    setTimeCapsulesOpen(true);
  };

  const handlePeerChange = useCallback((present: boolean) => {
    setPeerPresent(present);
  }, []);

  const handleChannelReady = useCallback((next: RealtimeChannel | null) => {
    setChannel(next);
  }, []);

  const handleRoomUpdate = useCallback((row: RoomRow) => {
    if (row.name) setRoomName(row.name);
    if (row.tank_mood) setMood(row.tank_mood);
    setNutrients({
      seconds: row.nutrient_seconds,
      coAwaySince: row.co_away_since,
    });
    setNudge({ text: row.nudge_text, at: row.last_nudged_at });
  }, []);

  const leave = async () => {
    if (supabase && roomId)
      await supabase.rpc('leave_room', { target_room: roomId });
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
          <p className="text-sm text-white/50">
            {status === 'loading' ? 'Connecting...' : 'Filling the tank...'}
          </p>
        </div>
      )}

<<<<<<< Updated upstream
=======
      {/* Floating Active Connect Moment HUD */}
      {activeSession && userId ? (
        <ConnectMomentHUD
          session={activeSession}
          onCompleteSession={() => void handleCompleteConnectMoment()}
          onCancelSession={handleCancelConnectMoment}
          participants={participants}
          currentUserId={userId}
        />
      ) : null}

>>>>>>> Stashed changes
      {roomId ? (
        <NudgeBanner roomId={roomId} text={nudge.text} at={nudge.at} />
      ) : null}

<<<<<<< Updated upstream
=======
      {roomId ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center px-4">
          <div className="pointer-events-auto w-full max-w-sm">
            <AmbientAudioListener />
          </div>
        </div>
      ) : null}

>>>>>>> Stashed changes
      {roomId && supabase && userId ? (
        <LoveLanguagePicker
          supabase={supabase}
          roomId={roomId}
          userId={userId}
        />
      ) : null}

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

      {/* Connect Moment Session Modal */}
      <ConnectMomentModal
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        onStartSession={handleStartConnectMoment}
        initiatorName={profile?.displayName}
      />

      {/* Activity Milestones & Time Capsules Slide-Over Drawer */}
      {roomId && supabase && userId ? (
        <TimeCapsulesDrawer
          isOpen={timeCapsulesOpen}
          onClose={() => setTimeCapsulesOpen(false)}
          roomId={roomId}
          userId={userId}
          supabase={supabase}
        />
      ) : null}

      {/* Top Glassmorphic Navigation HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4 sm:p-5 z-40">
        <div className="kibo-fade-in pointer-events-auto flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <TankSwitcher
              currentRoomCode={normalized}
              currentRoomId={roomId}
              currentMood={mood}
              currentName={roomName}
            />
            <button
              type="button"
              onClick={copyLink}
              className="rounded-full bg-black/25 px-3.5 py-1.5 font-mono text-xs tracking-[0.2em] text-white/80 backdrop-blur-sm transition hover:text-white"
              title="Copy the invite link"
            >
              {copied ? 'link copied' : normalized}
            </button>
          </div>
          <NutrientMeter
            bankedSeconds={nutrients.seconds}
            coAwaySince={nutrients.coAwaySince}
          />
        </div>

        <div className="kibo-fade-in pointer-events-auto flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          {/* Connect Moment Trigger Button */}
          <button
            type="button"
            onClick={() => setConnectModalOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-teal-400/40 bg-teal-500/15 px-3 py-1.5 text-xs font-medium text-teal-200 backdrop-blur-sm transition hover:border-teal-400/70 hover:bg-teal-500/25 shadow-sm shadow-teal-500/10"
            title="Start a synchronous presence focus session"
          >
            <span className="text-teal-300">✦</span>
            <span>Focus</span>
          </button>

          {/* Time Capsules & Milestones Trigger Button */}
          <button
            type="button"
            onClick={() => setTimeCapsulesOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-xs text-white/80 backdrop-blur-sm transition hover:border-white/30 hover:text-white"
            title="View activity milestones and time capsules"
          >
            <span>📜</span>
            <span>Memories</span>
          </button>

          <NotificationManager />

          <Link
            href="/dashboard"
            className="flex items-center gap-1 rounded-full bg-black/25 px-3 py-1.5 text-xs text-white/60 backdrop-blur-sm transition hover:text-white"
            title="Go to User Dashboard"
          >
            <span className="text-[10px] text-teal-300">✦</span>
            <span>Dashboard</span>
          </Link>
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
