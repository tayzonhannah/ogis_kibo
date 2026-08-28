'use client';

import { useEffect, useState } from 'react';
import { formatNutrientSeconds, liveNutrientSeconds } from '@/lib/nutrients';

/**
 * What the tank gained while nobody was watching (K/N continuous co-away).
 *
 * Its own component, with its own ticking state, so a once-per-second render
 * while an interval is open does not re-render the canvas above it.
 *
 * Silent at zero (unless interval is actively accumulating).
 */
export default function NutrientMeter({
  bankedSeconds,
  coAwaySince,
  kAway,
  nTotal,
}: {
  bankedSeconds: number;
  coAwaySince: string | null;
  kAway?: number;
  nTotal?: number;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    // Nothing moves unless an interval is open, so there is nothing to tick for
    // the rest of the time. The first tick lands a second in, which is why
    // liveNutrientSeconds floors a stale clock at the banked total rather than
    // letting the counter briefly run backwards.
    if (!coAwaySince) return;
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [coAwaySince]);

  const total = liveNutrientSeconds(bankedSeconds, coAwaySince, nowMs, kAway, nTotal);
  if (total <= 0 && !coAwaySince) return null;

  const hasRate = kAway !== undefined && nTotal !== undefined && nTotal >= 2;
  const rateFraction = hasRate ? `${kAway}/${nTotal}` : null;

  return (
    <div
      data-kibo-nutrients={total}
      data-kibo-rate={rateFraction ?? undefined}
      title="Time the tank spent resting while members were away"
      className="kibo-fade-in mt-2 flex items-center gap-2 pl-4 text-[11px] text-white/50"
    >
      <span aria-hidden className="text-teal-200/60">
        ✦
      </span>
      <span className="text-white/70">{formatNutrientSeconds(total)} of rest</span>
      {rateFraction && (
        <span
          className="rounded-full bg-teal-400/10 px-2 py-0.5 text-[10px] font-mono text-teal-300 border border-teal-400/20"
          title={`Co-away rate: ${rateFraction} group members resting`}
        >
          {rateFraction} rate
        </span>
      )}
    </div>
  );
}
