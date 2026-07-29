'use client';

import { useEffect, useState } from 'react';
import { formatNutrientSeconds, liveNutrientSeconds } from '@/lib/nutrients';

/**
 * What the tank gained while nobody was watching.
 *
 * Its own component, with its own ticking state, so a once-per-second render
 * while an interval is open does not re-render the canvas above it.
 *
 * Silent at zero. A fresh tank has nothing to say about rest yet, and an empty
 * meter would read as a target to fill.
 */
export default function NutrientMeter({
  bankedSeconds,
  coAwaySince,
}: {
  bankedSeconds: number;
  coAwaySince: string | null;
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

  const total = liveNutrientSeconds(bankedSeconds, coAwaySince, nowMs);
  if (total <= 0) return null;

  return (
    <p
      // The rendered string is coarse by design; tests and future tuning want
      // the exact figure, and prose is a bad place to read it from.
      data-kibo-nutrients={total}
      title="Time the tank spent resting while you were both away"
      className="kibo-fade-in mt-2 flex items-center gap-2 pl-4 text-[11px] text-white/40"
    >
      <span aria-hidden className="text-teal-200/50">
        ✦
      </span>
      {formatNutrientSeconds(total)} of rest
    </p>
  );
}
