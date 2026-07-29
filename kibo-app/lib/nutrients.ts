import { MAX_AWAY_CREDIT_SECONDS } from './constants';

/**
 * Banked seconds plus the interval currently open, clamped to the same cap
 * sync_co_away() applies when it banks.
 *
 * The open portion is rendered and never written — only the trigger may bank
 * it, and it does so when someone comes back. Applying the cap here as well is
 * what makes the number continuous across that moment: a client that reads the
 * room just before the credit lands shows the same total as the realtime echo
 * that arrives just after, so the counter never visibly jumps.
 */
export function liveNutrientSeconds(
  bankedSeconds: number,
  coAwaySince: string | null,
  nowMs: number
): number {
  if (!coAwaySince) return bankedSeconds;
  const openedMs = Date.parse(coAwaySince);
  if (Number.isNaN(openedMs)) return bankedSeconds;
  const open = Math.max(0, Math.floor((nowMs - openedMs) / 1000));
  return bankedSeconds + Math.min(open, MAX_AWAY_CREDIT_SECONDS);
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
