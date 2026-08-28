'use client';

import { useEffect, useState, useRef } from 'react';
import {
  CONNECT_MOMENT_CATEGORY_CONFIG,
  type ConnectMomentCategory,
} from '@/lib/constants';
import type { ConnectMomentSession } from '@/lib/types';

interface ParticipantInfo {
  id: string;
  displayName?: string;
  avatarUrl?: string;
}

interface ConnectMomentHUDProps {
  session: ConnectMomentSession;
  onCompleteSession: () => void;
  onCancelSession: () => void;
  participants?: ParticipantInfo[];
  currentUserId: string;
  mood?: string;
}

export default function ConnectMomentHUD({
  session,
  onCompleteSession,
  onCancelSession,
  participants = [],
  mood = 'Calm',
}: ConnectMomentHUDProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    const targetMs =
      session.startedAt + session.targetDurationMinutes * 60 * 1000;
    const diff = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
    return diff;
  });
  const [celebrating, setCelebrating] = useState(false);
  const [aiRitual, setAiRitual] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const completedRef = useRef(false);

  const fetchAiRitual = async () => {
    if (loadingAi) return;
    setLoadingAi(true);
    try {
      const res = await fetch('/api/ai/ritual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood, loveLanguages: ['words of affirmation', 'quality time'] }),
      });
      const data = (await res.json()) as { ritual: string };
      setAiRitual(data.ritual);
    } catch (err) {
      console.warn('[kibo] Failed to fetch AI ritual:', err);
      setAiRitual('Put your phones down together and share one highlight from your day.');
    } finally {
      setLoadingAi(false);
    }
  };

  const totalSeconds = Math.max(session.targetDurationMinutes * 60, 1);
  const categoryConfig =
    CONNECT_MOMENT_CATEGORY_CONFIG[session.category as ConnectMomentCategory] ||
    CONNECT_MOMENT_CATEGORY_CONFIG.study;

  useEffect(() => {
    completedRef.current = false;
    const interval = setInterval(() => {
      const targetMs =
        session.startedAt + session.targetDurationMinutes * 60 * 1000;
      const remaining = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
      setSecondsRemaining(remaining);

      if (remaining <= 0 && !completedRef.current) {
        completedRef.current = true;
        setCelebrating(true);
        setTimeout(() => {
          onCompleteSession();
        }, 3000);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session, onCompleteSession]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(
    seconds
  ).padStart(2, '0')}`;

  const progressPercent = Math.min(
    100,
    Math.max(0, ((totalSeconds - secondsRemaining) / totalSeconds) * 100)
  );

  const bonusPoints = Math.round(
    session.targetDurationMinutes * session.multiplier * 2
  );

  if (celebrating) {
    return (
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md">
        <div className="kibo-fade-in pointer-events-auto flex flex-col items-center gap-3 rounded-3xl border border-teal-400/60 bg-slate-950/95 p-8 text-center shadow-2xl shadow-teal-500/20 backdrop-blur-2xl">
          <div className="flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-gradient-to-tr from-teal-400 to-emerald-300 text-3xl text-slate-950 shadow-lg shadow-teal-400/40">
            🎉
          </div>
          <h2 className="text-xl font-bold text-white">Connect Moment Completed!</h2>
          <p className="max-w-xs text-xs text-teal-200/80">
            You shared {session.targetDurationMinutes} minutes of focused presence together.
          </p>
          <div className="mt-2 flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-1.5 text-sm font-semibold text-amber-200">
            <span>✦ +{bonusPoints} Fish Points Earned</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <aside
      aria-label="Connect Moment Focus Session"
      className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center px-4"
    >
      <div className="kibo-fade-in pointer-events-auto relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-teal-400/40 bg-slate-950/85 p-3.5 shadow-2xl shadow-teal-500/10 backdrop-blur-xl sm:p-4">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-teal-500/20 text-lg border border-teal-400/30">
              {categoryConfig.icon}
            </span>
            <div className="min-w-0">
              <span className="block truncate text-xs font-semibold text-white">
                {categoryConfig.label}
              </span>
              <span className="block text-[10px] text-teal-300/80">
                Shared Focus Mode
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-black/40 px-3 py-1 border border-white/10">
            <span className="h-2 w-2 animate-ping rounded-full bg-teal-400" />
            <span className="font-mono text-base font-bold tracking-wider text-teal-100 sm:text-lg">
              {timeFormatted}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void fetchAiRitual()}
              disabled={loadingAi}
              className="rounded-full border border-teal-400/30 bg-teal-500/15 px-2.5 py-1 text-[11px] font-medium text-teal-200 transition hover:bg-teal-500/25 disabled:opacity-50"
            >
              {loadingAi ? 'Asking AI…' : '✨ AI Ritual'}
            </button>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-200 border border-amber-400/30">
              ⚡ {session.multiplier.toFixed(1)}x
            </span>
            <button
              type="button"
              onClick={onCancelSession}
              aria-label="End session early"
              className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/60 transition hover:bg-white/15 hover:text-white"
            >
              End
            </button>
          </div>
        </div>

        {/* AI Prompt Surface */}
        {aiRitual && (
          <div className="mt-2.5 rounded-xl border border-teal-400/30 bg-teal-950/40 p-2.5 text-xs text-teal-100">
            <span className="font-semibold text-teal-300">✨ Shared Ritual: </span>
            <span>{aiRitual}</span>
          </div>
        )}

        {/* Participants */}
        {participants.length > 0 && (
          <div className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2 text-[11px] text-white/60">
            <span className="text-[10px] uppercase tracking-wider text-teal-300/70">
              Participants in sync:
            </span>
            <div className="flex -space-x-1.5 overflow-hidden">
              {participants.map((p) => {
                const name = p.displayName || 'Member';
                const initial = name.charAt(0).toUpperCase();
                return p.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={p.id}
                    src={p.avatarUrl}
                    alt={name}
                    title={name}
                    className="inline-block h-5 w-5 rounded-full ring-1 ring-slate-950 object-cover"
                  />
                ) : (
                  <div
                    key={p.id}
                    title={name}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-teal-500/30 text-[9px] font-bold text-teal-200 ring-1 ring-slate-950"
                  >
                    {initial}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Progress bar */}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 transition-all duration-1000"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </aside>
  );
}
