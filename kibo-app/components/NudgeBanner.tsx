'use client';

import { useEffect, useMemo, useState } from 'react';
import { NUDGE_BANNER_MS } from '@/lib/constants';

/**
 * The nudge, delivered.
 *
 * Web Push is deferred (VAPID keys, per-participant subscriptions, and an iOS
 * home-screen requirement — see Agent.md), so the sentence the cron job wrote
 * surfaces on next open instead. That is a weaker delivery guarantee and a
 * better fit for the app: a tank that treats silence as a design material has no
 * business buzzing a phone at 4am.
 *
 * "Seen" is local. The client has no update grant on `nudge_text` or
 * `last_nudged_at` — deliberately, since a client that can clear the idempotency
 * ledger can re-arm a job that spends money on someone else's key — so the
 * dismissal record is the `last_nudged_at` value this device has already shown.
 * A newer timestamp is a new nudge; the same one is history.
 */
export default function NudgeBanner({
  roomId,
  text,
  at,
}: {
  roomId: string;
  text: string | null;
  at: string | null;
}) {
  // The `at` value whose banner has already faded. Only ever set from the timer
  // callback below — visibility is otherwise derived, not stored, because
  // setState in an effect body is a cascading render and the lint rule that says
  // so is right.
  const [fadedFor, setFadedFor] = useState<string | null>(null);

  const seenKey = `kibo:nudge-seen:${roomId}`;

  const alreadySeen = useMemo(() => {
    // Returns before touching localStorage when there is no nudge, which is also
    // what makes this safe to evaluate during a server render: `at` is null until
    // RoomClient's client-side read resolves, so the storage access only ever
    // happens after hydration.
    if (!at) return true;
    try {
      return localStorage.getItem(seenKey) === at;
    } catch {
      // Private-mode Safari throws. Showing a nudge twice is an acceptable
      // failure; throwing inside the tank is not.
      return false;
    }
  }, [at, seenKey]);

  const visible = Boolean(text) && Boolean(at) && !alreadySeen && fadedFor !== at;

  useEffect(() => {
    if (!visible || !at) return;

    // Recorded on display rather than on dismissal. The alternative loses the
    // nudge entirely when the tab is closed mid-fade, and re-showing a stale
    // "it's been quiet" line days later is worse than dropping one.
    //
    // This deliberately does not invalidate `alreadySeen` — the memo is keyed on
    // `at`, so it keeps its false for the nudge currently on screen and the
    // banner does not vanish the instant it is recorded.
    try {
      localStorage.setItem(seenKey, at);
    } catch {
      /* see above */
    }

    // Fades on its own. Nothing in this app waits to be dismissed.
    const timer = setTimeout(() => setFadedFor(at), NUDGE_BANNER_MS);
    return () => clearTimeout(timer);
  }, [visible, at, seenKey]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 flex justify-center px-6">
      <p
        // polite, not assertive: this is weather, not an alert.
        aria-live="polite"
        className="kibo-fade-in max-w-xs rounded-2xl bg-amber-100/10 px-4 py-3 text-center text-xs leading-relaxed text-amber-100/85 backdrop-blur-sm"
      >
        {text}
      </p>
    </div>
  );
}
