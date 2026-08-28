'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import TankCard from '@/components/dashboard/TankCard';
import CreateTankModal from '@/components/dashboard/CreateTankModal';
import JoinTankModal from '@/components/dashboard/JoinTankModal';
import type { CreateRoomResult, JoinRoomRow, RoomRow, TankSummary } from '@/lib/types';

export default function DashboardPage() {
  const router = useRouter();
  const { status, profile, userId, supabase, signOut, refreshProfile } = useAuth();

  const [tanks, setTanks] = useState<TankSummary[]>([]);
  const [loadingTanks, setLoadingTanks] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [activeModal, setActiveModal] = useState<'create' | 'join' | null>(null);

  // Fetch helper for manual refresh / realtime events
  const fetchTanksData = useCallback(async () => {
    if (!supabase || !userId) return;

    try {
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select(
          'id, code, name, tank_mood, nutrient_seconds, co_away_since, last_interaction_at, created_by, created_at'
        )
        .order('last_interaction_at', { ascending: false });

      if (roomsError) throw roomsError;

      if (!roomsData || roomsData.length === 0) {
        setTanks([]);
        setFetchError(null);
        return;
      }

      const roomIds = roomsData.map((r) => r.id);
      const { data: participantsData } = await supabase
        .from('room_participants')
        .select('room_id, user_id')
        .in('room_id', roomIds);

      const countMap: Record<string, number> = {};
      if (participantsData) {
        for (const p of participantsData) {
          countMap[p.room_id] = (countMap[p.room_id] || 0) + 1;
        }
      }

      const summaries: TankSummary[] = (roomsData as RoomRow[]).map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name || 'Shared Tank',
        tank_mood: r.tank_mood,
        member_count: countMap[r.id] || 1,
        nutrient_seconds: r.nutrient_seconds || 0,
        co_away_since: r.co_away_since,
        last_interaction_at: r.last_interaction_at || r.created_at,
        created_by: r.created_by,
      }));

      setTanks(summaries);
      setFetchError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load tanks.';
      setFetchError(msg);
    } finally {
      setLoadingTanks(false);
      setRefreshing(false);
    }
  }, [supabase, userId]);

  // Initial load
  useEffect(() => {
    if (status === 'unauthenticated') {
      return;
    }
    if (!supabase || status !== 'ready' || !userId) {
      return;
    }

    let active = true;

    const load = async () => {
      try {
        const { data: roomsData, error: roomsError } = await supabase
          .from('rooms')
          .select(
            'id, code, name, tank_mood, nutrient_seconds, co_away_since, last_interaction_at, created_by, created_at'
          )
          .order('last_interaction_at', { ascending: false });

        if (!active) return;
        if (roomsError) throw roomsError;

        if (!roomsData || roomsData.length === 0) {
          setTanks([]);
          setLoadingTanks(false);
          return;
        }

        const roomIds = roomsData.map((r) => r.id);
        const { data: participantsData } = await supabase
          .from('room_participants')
          .select('room_id, user_id')
          .in('room_id', roomIds);

        if (!active) return;

        const countMap: Record<string, number> = {};
        if (participantsData) {
          for (const p of participantsData) {
            countMap[p.room_id] = (countMap[p.room_id] || 0) + 1;
          }
        }

        const summaries: TankSummary[] = (roomsData as RoomRow[]).map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name || 'Shared Tank',
          tank_mood: r.tank_mood,
          member_count: countMap[r.id] || 1,
          nutrient_seconds: r.nutrient_seconds || 0,
          co_away_since: r.co_away_since,
          last_interaction_at: r.last_interaction_at || r.created_at,
          created_by: r.created_by,
        }));

        setTanks(summaries);
      } catch (err) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'Failed to load tanks.';
        setFetchError(msg);
      } finally {
        if (active) setLoadingTanks(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [supabase, status, userId]);

  // Realtime subscription for dynamic tank & participant updates
  useEffect(() => {
    if (!supabase || status !== 'ready' || !userId) return;

    const channel = supabase
      .channel('kibo-dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        () => {
          void fetchTanksData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_participants' },
        () => {
          void fetchTanksData();
        }
      )
      .subscribe();

    const onFocus = () => {
      void fetchTanksData();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
    };
  }, [supabase, status, userId, fetchTanksData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchTanksData(), refreshProfile()]);
  };

  const handleCreateRoom = async (name: string): Promise<CreateRoomResult | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('create_room', {
      room_name: name,
    });
    if (error) throw error;

    const result = (data as CreateRoomResult[] | null)?.[0];
    if (result && result.room_code) {
      setActiveModal(null);
      router.push(`/room/${result.room_code}`);
      return result;
    }
    return null;
  };

  const handleJoinRoom = async (code: string): Promise<JoinRoomRow | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('join_room', {
      room_code: code,
    });
    if (error) throw error;

    const row = (data as JoinRoomRow[] | null)?.[0];
    if (row && row.status === 'ok') {
      setActiveModal(null);
      router.push(`/room/${code}`);
      return row;
    }
    return row || null;
  };

  const handleEnterTank = (code: string) => {
    router.push(`/room/${code}`);
  };

  // Filter tanks by search term if provided
  const filteredTanks = tanks.filter((tank) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      tank.name.toLowerCase().includes(q) ||
      tank.code.toLowerCase().includes(q) ||
      tank.tank_mood.toLowerCase().includes(q)
    );
  });

  // Not authenticated view
  if (status === 'unauthenticated') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center p-6 text-center">
        <div className="kibo-fade-in max-w-md rounded-3xl border border-white/10 bg-black/40 p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-300 mx-auto">
            ✦
          </div>
          <h1 className="mt-4 text-2xl font-light tracking-wide text-white">
            Welcome to KIBO Dashboard
          </h1>
          <p className="mt-3 text-sm text-white/60">
            Please sign in with Google to view and manage your ambient aquarium tanks.
          </p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-teal-400/40 bg-teal-500/20 px-6 py-3 text-sm font-medium text-teal-200 shadow-lg transition hover:bg-teal-500/30"
          >
            Sign In with Google
          </button>
        </div>
      </main>
    );
  }

  const showLoading = loadingTanks && status === 'loading';

  return (
    <div className="flex min-h-dvh flex-col bg-[#081a26] text-white">
      {/* Top Header */}
      <DashboardHeader
        profile={profile}
        onOpenCreate={() => setActiveModal('create')}
        onOpenJoin={() => setActiveModal('join')}
        onSignOut={signOut}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />

      {/* Main Dashboard Content */}
      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Error banner if network retry needed */}
        {fetchError && (
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{fetchError}</span>
            </div>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs text-amber-100 hover:bg-amber-400/20"
            >
              Retry
            </button>
          </div>
        )}

        {/* Dashboard Title & Filter Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-light tracking-wide text-white/95 sm:text-3xl">
              My Shared Tanks
            </h1>
            <p className="mt-1 text-xs text-white/50">
              Select an ambient aquarium to enter, relax with your group, and collect reciprocity rest.
            </p>
          </div>

          {/* Search bar when user has multiple tanks */}
          {tanks.length > 2 && (
            <div className="relative max-w-xs w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tanks by name or code…"
                className="w-full rounded-full border border-white/15 bg-black/30 px-4 py-2 pl-9 text-xs text-white placeholder:text-white/30 focus:border-teal-400 focus:outline-none"
              />
              <svg
                className="absolute left-3 top-2.5 h-4 w-4 text-white/30"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Loading State */}
        {showLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="h-64 animate-pulse rounded-3xl border border-white/10 bg-white/5 p-6"
              >
                <div className="h-6 w-24 rounded-full bg-white/10" />
                <div className="mt-6 h-8 w-3/4 rounded-xl bg-white/10" />
                <div className="mt-8 h-12 w-full rounded-2xl bg-white/10" />
              </div>
            ))}
          </div>
        ) : tanks.length === 0 ? (
          /* Empty State CTA (TC-F4-05, TC-F4-B16) */
          <div className="kibo-fade-in flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-black/20 p-10 text-center sm:p-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-teal-300/30 bg-gradient-to-br from-teal-500/20 to-blue-500/20 text-2xl text-teal-300 shadow-inner">
              ✦
            </div>
            <h2 className="mt-6 text-xl font-light tracking-wide text-white/95 sm:text-2xl">
              Welcome to Your Aquarium Hub
            </h2>
            <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-white/55">
              You aren&apos;t a member of any tanks yet. Create a dedicated sanctuary for your
              partner, friends, or study group, or join an existing tank with an invite code.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setActiveModal('create')}
                className="flex items-center gap-2 rounded-full border border-teal-400/50 bg-teal-500/25 px-6 py-3 text-sm font-medium text-teal-100 shadow-lg shadow-teal-500/10 transition hover:border-teal-300 hover:bg-teal-500/35 active:scale-95"
              >
                <span className="text-base font-bold leading-none">+</span>
                <span>Open Your First Tank</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModal('join')}
                className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-medium text-white shadow-md transition hover:border-white/40 hover:bg-white/15 active:scale-95"
              >
                <span className="font-mono text-blue-300">#</span>
                <span>Join with Code</span>
              </button>
            </div>
          </div>
        ) : filteredTanks.length === 0 ? (
          /* No search results */
          <div className="rounded-3xl border border-white/10 bg-black/20 p-12 text-center">
            <p className="text-sm text-white/50">
              No tanks matching &ldquo;{searchQuery}&rdquo;.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-3 text-xs text-teal-300 hover:underline"
            >
              Clear search
            </button>
          </div>
        ) : (
          /* Responsive Tanks Grid (TC-F4-01, TC-F4-B17) */
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTanks.map((tank) => (
              <TankCard
                key={tank.id}
                tank={tank}
                currentUserId={userId}
                onEnter={handleEnterTank}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      <CreateTankModal
        isOpen={activeModal === 'create'}
        onClose={() => setActiveModal(null)}
        onCreate={handleCreateRoom}
      />

      <JoinTankModal
        isOpen={activeModal === 'join'}
        onClose={() => setActiveModal(null)}
        onJoin={handleJoinRoom}
      />
    </div>
  );
}
