import { MAX_AWAY_CREDIT_SECONDS } from './constants';

/**
 * Pure reference calculation for K/N continuous co-away engine.
 * Computes exact nutrient accumulation for given elapsed seconds, total members N (>=2), and away members K.
 * Formula: delta_nutrients = elapsedSeconds * (K / N) clamped to maxCreditSeconds.
 * If N < 2 or K <= 0, accrual is 0.
 */
export function computeCoAwayAccrual(
  elapsedSeconds: number,
  kAway: number,
  nTotal: number,
  options: { maxCreditSeconds?: number } = {}
): number {
  const { maxCreditSeconds = MAX_AWAY_CREDIT_SECONDS } = options;
  if (nTotal < 2) return 0;
  if (kAway <= 0) return 0;
  if (kAway > nTotal) {
    throw new Error(`kAway (${kAway}) cannot exceed nTotal (${nTotal})`);
  }

  const effectiveElapsed = Math.min(Math.max(0, elapsedSeconds), maxCreditSeconds);
  const rate = kAway / nTotal;
  return effectiveElapsed * rate;
}

/**
 * Returns the active co-away accrual rate (K / N) as a fraction between 0.0 and 1.0.
 * Returns 0 if total members N < 2 or away members K <= 0.
 */
export function getCoAwayRate(kAway: number, nTotal: number): number {
  if (nTotal < 2 || kAway <= 0) return 0;
  return Math.min(kAway / nTotal, 1);
}

/**
 * Banked seconds plus the interval currently open with continuous K/N rate scaling,
 * clamped to the same cap sync_co_away() applies when it banks.
 *
 * Supports flexible parameters:
 * - liveNutrientSeconds(bankedSeconds, coAwaySince, nowMs)
 * - liveNutrientSeconds(bankedSeconds, coAwaySince, nowMs, maxCreditSeconds)
 * - liveNutrientSeconds(bankedSeconds, coAwaySince, nowMs, kAway, nTotal, maxCreditSeconds)
 */
export function liveNutrientSeconds(
  bankedSeconds: number,
  coAwaySince: string | null,
  nowMs: number,
  kAwayOrMaxCap?: number,
  nTotal?: number,
  maxCreditSeconds: number = MAX_AWAY_CREDIT_SECONDS
): number {
  if (!coAwaySince) return bankedSeconds;
  const openedMs = Date.parse(coAwaySince);
  if (Number.isNaN(openedMs)) return bankedSeconds;
  const open = Math.max(0, Math.floor((nowMs - openedMs) / 1000));

  let maxCap = maxCreditSeconds;
  let rate = 1;

  if (kAwayOrMaxCap !== undefined && nTotal !== undefined) {
    rate = getCoAwayRate(kAwayOrMaxCap, nTotal);
  } else if (kAwayOrMaxCap !== undefined && kAwayOrMaxCap > 1 && nTotal === undefined) {
    maxCap = kAwayOrMaxCap;
  }

  const effectiveOpen = Math.min(open, maxCap);
  return bankedSeconds + Math.floor(effectiveOpen * rate);
}

/**
 * "4h 12m", "12m", "40s". Deliberately coarse and never zero-padded: this is
 * weather, not a stopwatch, and a precise ticking figure would invite exactly
 * the score-watching the mechanic is trying not to be.
 */
export function formatNutrientSeconds(total: number): string {
  const seconds = Math.max(0, Math.floor(total));
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/**
 * Piecewise continuous co-away simulator across dynamic intervals with variable K and N.
 */
export function simulatePiecewiseCoAway(
  intervals: Array<{ elapsedSeconds: number; kAway: number; nTotal: number }>,
  initialBanked = 0
): number {
  let banked = initialBanked;
  for (const interval of intervals) {
    const { elapsedSeconds, kAway, nTotal } = interval;
    const gained = computeCoAwayAccrual(elapsedSeconds, kAway, nTotal);
    banked += gained;
  }
  return banked;
}
