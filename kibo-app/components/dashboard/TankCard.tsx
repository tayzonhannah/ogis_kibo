'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ROOM_CAPACITY,
  TANK_MOOD_GRADIENT,
  TANK_MOOD_LABELS,
  type TankMood,
} from '@/lib/constants';
import { formatNutrientSeconds, liveNutrientSeconds } from '@/lib/nutrients';
import type { TankSummary } from '@/lib/types';

interface TankCardProps {
  tank: TankSummary;
  currentUserId?: string | null;
  onEnter?: (code: string) => void;
}

function formatRelativeTime(isoString: string): string {
  try {
    const timeMs = new Date(isoString).getTime();
    if (Number.isNaN(timeMs)) return 'Recently';
    const diffSec = Math.floor((Date.now() - timeMs) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDays = Math.floor(diffHour / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return new Date(isoString).toLocaleDateString();
  } catch {
    return 'Recently';
  }
}

const MOOD_ACCENT_CLASSES: Record<TankMood, { border: string; glow: string; text: string; bg: string }> = {
  calm: {
    border: 'border-teal-500/25 hover:border-teal-400/50',
    glow: 'from-teal-900/30 via-slate-900/40 to-cyan-950/30',
    text: 'text-teal-300',
    bg: 'bg-teal-400/10',
  },
  deep: {
    border: 'border-blue-500/25 hover:border-blue-400/50',
    glow: 'from-blue-950/40 via-indigo-950/40 to-slate-900/40',
    text: 'text-blue-300',
    bg: 'bg-blue-400/10',
  },
  bright: {
    border: 'border-cyan-400/30 hover:border-cyan-300/60',
    glow: 'from-cyan-900/30 via-sky-900/40 to-teal-950/30',
    text: 'text-cyan-300',
    bg: 'bg-cyan-400/10',
  },
  murky: {
    border: 'border-emerald-500/25 hover:border-emerald-400/50',
    glow: 'from-emerald-950/40 via-zinc-900/40 to-slate-950/40',
    text: 'text-emerald-300',
    bg: 'bg-emerald-400/10',
  },
  warm: {
    border: 'border-amber-500/25 hover:border-amber-400/50',
    glow: 'from-amber-950/30 via-orange-950/30 to-stone-900/40',
    text: 'text-amber-300',
    bg: 'bg-amber-400/10',
  },
};

export default function TankCard({ tank, currentUserId, onEnter }: TankCardProps) {
  const [copied, setCopied] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const mood = (tank.tank_mood || 'calm') as TankMood;
  const moodTheme = MOOD_ACCENT_CLASSES[mood] || MOOD_ACCENT_CLASSES.calm;
  const isCreator = currentUserId && tank.created_by === currentUserId;

  // Live nutrient ticking when co-away is active
  useEffect(() => {
    if (!tank.co_away_since) return;
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [tank.co_away_since]);

  const totalNutrients = liveNutrientSeconds(
    tank.nutrient_seconds || 0,
    tank.co_away_since,
    nowMs
  );

  const handleCopyCode = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(tank.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const gradient = TANK_MOOD_GRADIENT[mood] || TANK_MOOD_GRADIENT.calm;

  return (
    <div
      className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border bg-gradient-to-b ${moodTheme.glow} ${moodTheme.border} p-6 shadow-xl backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl`}
      style={{
        background: `linear-gradient(170deg, ${gradient[0]}33 0%, rgba(13, 27, 42, 0.7) 60%, ${gradient[1]}55 100%)`,
      }}
    >
      {/* Top Bar: Mood Badge, Creator Tag & Code Chip */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Mood Pill */}
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider ${moodTheme.bg} ${moodTheme.text} border border-white/10`}
          >
            <span
              className="h-1.5 w-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: gradient[0] }}
            />
            {TANK_MOOD_LABELS[mood]}
          </span>

          {/* Creator Badge */}
          {isCreator && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
              Host
            </span>
          )}
        </div>

        {/* Room Code Badge */}
        <button
          type="button"
          onClick={handleCopyCode}
          className="group/code flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-3 py-1 font-mono text-xs uppercase tracking-widest text-white/80 transition hover:border-white/30 hover:bg-black/50 hover:text-white"
          title="Click to copy room code"
        >
          <span>{tank.code}</span>
          <svg
            className="h-3 w-3 text-white/40 group-hover/code:text-white/80"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {copied ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Tank Title & Meta */}
      <div className="my-5">
        <h3
          className="text-xl font-light tracking-wide text-white/95 truncate"
          title={tank.name}
        >
          {tank.name}
        </h3>
        <p className="mt-1 text-xs text-white/45">
          Active {formatRelativeTime(tank.last_interaction_at)}
        </p>
      </div>

      {/* Metrics Row: Member Count & Banked Rest Time */}
      <div className="mb-6 grid grid-cols-2 gap-3 border-y border-white/10 py-3.5 text-xs">
        {/* Members */}
        <div className="flex flex-col">
          <span className="text-[11px] uppercase tracking-wider text-white/40">Occupancy</span>
          <div className="mt-1 flex items-center gap-1.5 font-medium text-white/90">
            <svg
              className="h-3.5 w-3.5 text-teal-300/70"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span>
              {tank.member_count} / {ROOM_CAPACITY}
            </span>
          </div>
        </div>

        {/* Banked Rest / Nutrients */}
        <div className="flex flex-col">
          <span className="text-[11px] uppercase tracking-wider text-white/40">Banked Rest</span>
          <div className="mt-1 flex items-center gap-1.5 font-medium text-white/90">
            <span className="text-teal-300">✦</span>
            <span>{totalNutrients > 0 ? formatNutrientSeconds(totalNutrients) : '0s'}</span>
          </div>
        </div>
      </div>

      {/* Action: Enter Tank */}
      {onEnter ? (
        <button
          type="button"
          onClick={() => onEnter(tank.code)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white shadow-md backdrop-blur-sm transition-all group-hover:border-white/40 group-hover:bg-white/15 active:scale-[0.98]"
        >
          <span>Enter Tank</span>
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </button>
      ) : (
        <Link
          href={`/room/${tank.code}`}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white shadow-md backdrop-blur-sm transition-all group-hover:border-white/40 group-hover:bg-white/15 active:scale-[0.98]"
        >
          <span>Enter Tank</span>
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </Link>
      )}
    </div>
  );
}
