'use client';

import { useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { HEARTBEAT_MS } from './constants';

/**
 * Refreshes last_seen_at while the tab is visible.
 *
 * This deliberately does NOT beat while hidden. A hidden tab that keeps
 * reporting itself alive is indistinguishable from a present one, which would
 * break the phone-off mechanic in Phase 4. It is also what gives
 * join_room()'s stale-participant eviction something real to measure.
 */
export function useHeartbeat(
  supabase: SupabaseClient | null,
  roomId: string | null,
  userId: string | null
) {
  useEffect(() => {
    if (!supabase || !roomId || !userId) return;

    const beat = () => {
      if (document.visibilityState !== 'visible') return;
      void supabase
        .from('room_participants')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('room_id', roomId)
        .eq('user_id', userId);
    };

    beat();
    const interval = setInterval(beat, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', beat);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [supabase, roomId, userId]);
}
