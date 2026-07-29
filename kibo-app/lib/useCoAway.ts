'use client';

import { useEffect, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseRestUrl } from './supabase/client';
import { fire } from './supabase/fire';

/**
 * Reports whether this participant is looking, by writing
 * room_participants.hidden_since.
 *
 * That single column is the whole client contribution to phone-off continuity.
 * The shared away interval and the nutrient credit are derived server-side by
 * sync_co_away() (migration 0005), because two participants cannot be
 * represented by one flag and because a client must not score itself.
 *
 * Deliberately separate from useHeartbeat, which writes last_seen_at from the
 * same event: the heartbeat's rule is "never beat while hidden", and this one's
 * is "always say which way it went". Sharing one UPDATE would also make every
 * heartbeat fire the co-away trigger.
 */
export function useCoAway(
  supabase: SupabaseClient | null,
  roomId: string | null,
  userId: string | null
) {
  // Captured for the unload path, where there is no time left to await
  // getSession(). Kept fresh through onAuthStateChange, so an hour-old tab
  // still beacons with a valid token.
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!supabase || !roomId || !userId) return;

    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) tokenRef.current = data.session?.access_token ?? null;
    });
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      tokenRef.current = session?.access_token ?? null;
    });

    // The last value written. The unload beacon re-asserts it rather than
    // stamping a fresh now(), so that a beacon landing behind its own ordinary
    // write is byte-identical and the trigger can discard it without taking the
    // room's row lock. A new timestamp would be just as correct arithmetically
    // — only the count of non-null hidden_since values feeds the ledger — but it
    // would make every departure contend on the shared row for nothing.
    const reportedRef = { current: null as string | null };

    const report = (hidden: boolean) => {
      const next = hidden ? new Date().toISOString() : null;
      reportedRef.current = next;
      // fire(), not void: an un-awaited builder never sends the request.
      fire(
        supabase
          .from('room_participants')
          .update({ hidden_since: next })
          .eq('room_id', roomId)
          .eq('user_id', userId),
        'away report'
      );
    };

    /**
     * Unload path. A normal supabase-js call is cancelled when the document
     * goes away, so the departure would simply never land.
     *
     * navigator.sendBeacon cannot be used here despite being the obvious tool:
     * it sends no custom headers, so it cannot present the Authorization bearer
     * PostgREST needs, and RLS would reject it. fetch with keepalive survives
     * unload and can carry the header.
     */
    const beacon = (hiddenAt: string) => {
      const token = tokenRef.current;
      if (!token || !supabaseRestUrl || !supabaseAnonKey) return;
      void fetch(
        `${supabaseRestUrl}/room_participants` +
          `?room_id=eq.${encodeURIComponent(roomId)}` +
          `&user_id=eq.${encodeURIComponent(userId)}`,
        {
          method: 'PATCH',
          keepalive: true,
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ hidden_since: hiddenAt }),
        }
      ).catch(() => {
        // Best-effort by construction. Losing this write costs one interval's
        // credit, and the trigger's cap bounds the alternative failure too.
      });
    };

    // On mount, state the truth rather than assuming presence. A tab closed
    // while hidden left hidden_since set, so this is also the write that banks
    // the interval you were away for — coming back is what pays out.
    report(document.visibilityState !== 'visible');

    const onVisibility = () => report(document.hidden);

    const onPageHide = (event: PageTransitionEvent) => {
      // persisted === true means the page is going into the back/forward cache
      // and may be resumed; visibilitychange has already reported that. Only a
      // real teardown needs the beacon.
      if (event.persisted) return;
      // Already reported hidden? Re-assert that exact timestamp. Otherwise this
      // is a tab closed while still being looked at, which is a real transition.
      beacon(reportedRef.current ?? new Date().toISOString());
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      active = false;
      authSub.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [supabase, roomId, userId]);
}
