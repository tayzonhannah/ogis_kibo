'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import {
  TANK_MOOD_GRADIENT,
  TANK_MOOD_LABELS,
  type TankMood,
} from '@/lib/constants';
import type { RoomRow, TankSummary } from '@/lib/types';

interface TankSwitcherProps {
  currentRoomCode: string;
  currentRoomId?: string | null;
  currentMood?: TankMood;
  currentName?: string;
}

function truncate(str: string, max = 22): string {
  if (!str) return '';
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

export default function TankSwitcher({
  currentRoomCode,
  currentRoomId,
  currentMood = 'calm',
  currentName,
}: TankSwitcherProps) {
  const router = useRouter();
  const { supabase, userId, status } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [tanks, setTanks] = useState<TankSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch active user tanks
  const fetchTanks = useCallback(async () => {
    if (!supabase || status !== 'ready' || !userId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rooms')
        .select(
          'id, code, name, tank_mood, nutrient_seconds, co_away_since, last_interaction_at, created_by, created_at'
        )
        .order('last_interaction_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const summaries: TankSummary[] = (data as RoomRow[]).map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name || 'Shared Tank',
          tank_mood: r.tank_mood,
          member_count: 1,
          nutrient_seconds: r.nutrient_seconds || 0,
          co_away_since: r.co_away_since,
          last_interaction_at: r.last_interaction_at || r.created_at,
          created_by: r.created_by,
        }));

        setTanks(summaries);
      }
    } catch (err) {
      console.warn('Could not load user tanks for switcher:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, status, userId]);

  useEffect(() => {
    if (!supabase || status !== 'ready' || !userId) return;
    let active = true;

    const loadInitial = async () => {
      try {
        const { data, error } = await supabase
          .from('rooms')
          .select(
            'id, code, name, tank_mood, nutrient_seconds, co_away_since, last_interaction_at, created_by, created_at'
          )
          .order('last_interaction_at', { ascending: false });

        if (!active || error || !data) return;

        const summaries: TankSummary[] = (data as RoomRow[]).map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name || 'Shared Tank',
          tank_mood: r.tank_mood,
          member_count: 1,
          nutrient_seconds: r.nutrient_seconds || 0,
          co_away_since: r.co_away_since,
          last_interaction_at: r.last_interaction_at || r.created_at,
          created_by: r.created_by,
        }));

        if (active) {
          setTanks(summaries);
        }
      } catch (err) {
        console.warn('Could not load initial user tanks:', err);
      }
    };

    void loadInitial();

    return () => {
      active = false;
    };
  }, [supabase, status, userId]);

  // Derived active tank name
  const currentInList = tanks.find(
    (t) =>
      (currentRoomId && t.id === currentRoomId) ||
      t.code.toUpperCase() === currentRoomCode.toUpperCase()
  );
  const activeName = currentName || currentInList?.name || 'Shared Tank';

  // Handle click outside and Escape key to close dropdown (TC-F5-B23)
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const toggleDropdown = () => {
    if (!isOpen) {
      void fetchTanks();
    }
    setIsOpen((prev) => !prev);
  };

  // Alternate tanks excluding current room (TC-F5-01, TC-F5-B24)
  const alternateTanks = tanks.filter(
    (t) =>
      (currentRoomId ? t.id !== currentRoomId : true) &&
      t.code.toUpperCase() !== currentRoomCode.toUpperCase()
  );

  // Navigate to another tank (TC-F5-02, TC-F5-B22)
  const handleSelectTank = (tank: TankSummary) => {
    const isCurrent =
      (currentRoomId && tank.id === currentRoomId) ||
      tank.code.toUpperCase() === currentRoomCode.toUpperCase();

    if (isCurrent) {
      setIsOpen(false);
      return; // Avoid redundant navigation
    }

    setIsOpen(false);
    router.push(`/room/${tank.code}`);
  };

  const moodGradient = TANK_MOOD_GRADIENT[currentMood] || TANK_MOOD_GRADIENT.calm;

  return (
    <div ref={containerRef} className="relative z-50 inline-block text-left">
      {/* Switcher Trigger Button (TC-F5-03, TC-F5-B25) */}
      <button
        type="button"
        onClick={toggleDropdown}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title={`Current Tank: ${activeName} (${currentRoomCode})`}
        className="group flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3.5 py-1.5 text-xs text-white shadow-lg backdrop-blur-md transition-all hover:border-white/40 hover:bg-black/60 active:scale-95"
      >
        {/* Mood Indicator Dot */}
        <span
          className="h-2 w-2 rounded-full ring-2 ring-white/20"
          style={{ backgroundColor: moodGradient[0] }}
          aria-hidden
        />

        {/* Tank Name truncated */}
        <span className="font-medium tracking-wide text-white/95">
          {truncate(activeName, 18)}
        </span>

        {/* Chevron */}
        <svg
          className={`h-3 w-3 text-white/50 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-white' : 'group-hover:text-white/80'
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Floating Panel (TC-F5-B21: z-50 over canvas & overlays) */}
      {isOpen && (
        <div className="kibo-fade-in absolute left-0 mt-2 w-72 origin-top-left rounded-2xl border border-white/15 bg-[#0a1824]/95 p-3 shadow-2xl backdrop-blur-xl ring-1 ring-black/50 z-50">
          {/* Header */}
          <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2 px-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-300/80">
              Switch Tank
            </span>
            <span className="text-[10px] text-white/40">
              {tanks.length} {tanks.length === 1 ? 'tank' : 'tanks'} total
            </span>
          </div>

          {/* Current Tank Row */}
          <div className="mb-2 rounded-xl border border-teal-500/30 bg-teal-500/10 p-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: moodGradient[0] }}
                />
                <span className="font-medium text-white/95 truncate max-w-[140px]" title={activeName}>
                  {truncate(activeName, 20)}
                </span>
              </div>
              <span className="rounded bg-teal-400/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-teal-200">
                Current
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between pl-4 text-[10px] text-white/50">
              <span className="font-mono">{currentRoomCode}</span>
              <span>{TANK_MOOD_LABELS[currentMood]}</span>
            </div>
          </div>

          {/* Alternate Tanks List (TC-F5-01, TC-F5-05) */}
          <div className="max-h-52 overflow-y-auto space-y-1 py-1 pr-0.5">
            {loading && tanks.length === 0 ? (
              <div className="py-4 text-center text-xs text-white/40">
                Loading tanks…
              </div>
            ) : alternateTanks.length === 0 ? (
              /* Single-Tank User Notice (TC-F5-05) */
              <div className="py-3 px-2 text-center text-xs text-white/45">
                <p>No other active tanks.</p>
                <p className="mt-1 text-[11px] text-white/35">
                  Create or join more tanks from your Dashboard.
                </p>
              </div>
            ) : (
              alternateTanks.map((tank) => {
                const itemMood = (tank.tank_mood || 'calm') as TankMood;
                const itemGradient =
                  TANK_MOOD_GRADIENT[itemMood] || TANK_MOOD_GRADIENT.calm;

                return (
                  <button
                    key={tank.id}
                    type="button"
                    onClick={() => handleSelectTank(tank)}
                    className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition hover:bg-white/10 active:bg-white/15"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: itemGradient[0] }}
                      />
                      <span
                        className="truncate text-white/90 font-medium"
                        title={tank.name}
                      >
                        {truncate(tank.name, 19)}
                      </span>
                    </div>

                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-white/40 bg-black/30 rounded px-1.5 py-0.5">
                      {tank.code}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Quick Dashboard Shortcut (TC-F5-04) */}
          <div className="mt-2 border-t border-white/10 pt-2 flex flex-col gap-1">
            <Link
              href="/dashboard"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs text-teal-300/90 transition hover:bg-white/10 hover:text-teal-200"
            >
              <span className="flex items-center gap-1.5">
                <span>✦</span>
                <span>User Dashboard</span>
              </span>
              <span className="text-[11px]">→</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
