/**
 * Tuning knobs. These mirror values enforced in
 * supabase/migrations/0001_phase1_rooms_and_fish.sql — change both together.
 */

/** Enforced in join_room(). The handoff code assumes exactly one peer. */
export const ROOM_CAPACITY = 2;

/** Enforced in create_room(). 32^8 ~= 1.1e12. */
export const CODE_LENGTH = 8;

/** Alphabet used by create_room(): no I, O, 0 or 1, so codes can be read aloud. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** How often a visible tab refreshes last_seen_at. Never runs while hidden. */
export const HEARTBEAT_MS = 60_000;

/** Matches the memos.body check constraint. */
export const MEMO_MAX_LEN = 140;

/** Caps one co-away interval so a single long absence can't dominate (Phase 4). */
export const MAX_AWAY_CREDIT_SECONDS = 28_800;

/** Off-screen buffer, in CSS px, before a fish counts as having exited. */
export const FISH_MARGIN = 40;

/** Must match the rooms.tank_mood check constraint. */
export const TANK_MOODS = ['calm', 'deep', 'bright', 'murky', 'warm'] as const;
export type TankMood = (typeof TANK_MOODS)[number];

export const TANK_MOOD_LABELS: Record<TankMood, string> = {
  calm: 'Calm',
  deep: 'Deep Sea Blue',
  bright: 'Bright Shallows',
  murky: 'Murky',
  warm: 'Warm Current',
};

/** Canvas background per mood, as [top, bottom] of a vertical gradient. */
export const TANK_MOOD_GRADIENT: Record<TankMood, [string, string]> = {
  calm: ['#0f2c3f', '#081a26'],
  deep: ['#0a1b3d', '#04091a'],
  bright: ['#1c5570', '#0d3247'],
  murky: ['#243528', '#0e1711'],
  warm: ['#3d2a1f', '#1a0f0a'],
};

export function normalizeCode(input: string): string {
  return input.trim().toUpperCase();
}

export function isPlausibleCode(input: string): boolean {
  const code = normalizeCode(input);
  if (code.length !== CODE_LENGTH) return false;
  return [...code].every((char) => CODE_ALPHABET.includes(char));
}
