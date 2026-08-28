/**
 * Tuning knobs. These mirror values enforced in
 * supabase/migrations/0007_google_auth_multi_tank.sql — change both together.
 */

/** Enforced in join_room() and multi-tank capacity. */
export const ROOM_CAPACITY = 5;

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

/** Phase 3 timings. Nothing snaps; the tank is weather, not a notification. */
export const WARMTH_LIFETIME_MS = 5_000;
export const MEMO_LIFETIME_MS = 40_000;
export const HEART_LIFETIME_MS = 2_200;
export const MOOD_FADE_MS = 2_000;

/** Client-side gesture throttles. The DB enforces the memo limit for real. */
export const WARMTH_COOLDOWN_MS = 3_000;

/**
 * Hold a memo bubble this long to retract it; a shorter press is a tap, which
 * sends a heart. The bubble dims as the hold progresses, so the gesture shows
 * its own progress and needs no confirmation dialog.
 */
export const RETRACT_HOLD_MS = 700;

/** Move further than this mid-press and it was a drag, so neither fires. */
export const PRESS_CANCEL_PX = 12;

/** Caps so a fast sender cannot grow these arrays without bound. */
export const MAX_CORALS = 12;
export const MAX_BUBBLES = 6;
export const MAX_HEARTS = 20;

/** How many recent memos to show as bubbles when you open the tank. */
export const MEMO_BACKLOG = 5;

/** Fish Fin Styles */
export const FIN_STYLES = ['classic', 'fan', 'ribbon', 'dragon', 'spiky'] as const;
export type FinStyle = (typeof FIN_STYLES)[number];

export const FISH_COLORS = [
  '#F5B041',
  '#7FB3D5',
  '#E74C3C',
  '#48C9B0',
  '#AF7AC5',
  '#F39C12',
  '#5DADE2',
  '#58D68D',
] as const;

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

/**
 * Must match the room_participants.love_language check constraint (0006).
 *
 * This is a closed vocabulary rather than free text because the value is the
 * only client-written field that reaches the model and comes back out on the
 * *other* participant's screen. See the migration for the whole argument.
 */
export const LOVE_LANGUAGES = [
  'words',
  'time',
  'touch',
  'acts',
  'symbols',
] as const;
export type LoveLanguage = (typeof LOVE_LANGUAGES)[number];

export function isLoveLanguage(value: unknown): value is LoveLanguage {
  return LOVE_LANGUAGES.includes(value as LoveLanguage);
}

/** Picker copy. Phrased as what you like receiving, not as a personality test. */
export const LOVE_LANGUAGE_LABELS: Record<LoveLanguage, string> = {
  words: 'A few words',
  time: 'Time together',
  touch: 'Warmth I can feel',
  acts: 'Something done for me',
  symbols: 'A small token',
};

/** Given to the model as the phrase to design a nudge around. */
export const LOVE_LANGUAGE_HINTS: Record<LoveLanguage, string> = {
  words: 'being told something kind',
  time: 'unhurried shared presence',
  touch: 'physical warmth and closeness',
  acts: 'small practical gestures',
  symbols: 'small tokens that mean something',
};

/**
 * How long a nudge banner stays before fading on its own. Longer than the
 * ambient gestures — this one is meant to be read, not glimpsed.
 */
export const NUDGE_BANNER_MS = 12_000;

/** Quiet for this long and the room becomes a nudge candidate. Mirrors the cron route. */
export const NUDGE_IDLE_DAYS = 3;

/**
 * Hard ceiling on rooms touched by one cron run. The model is billed per call,
 * so an unbounded batch is an unbounded invoice; the route logs how many
 * candidates it left behind rather than pretending it drained the queue.
 */
export const NUDGE_BATCH_LIMIT = 25;

/** Matches the rooms.nudge_text check constraint (0006). */
export const NUDGE_MAX_LEN = 200;

<<<<<<< Updated upstream
=======
/** Voucher Categories and Labels */
export const VOUCHER_CATEGORIES = [
  'all',
  'coffee',
  'dining',
  'wellness',
  'culture',
  'retail',
  'general',
] as const;

export const VOUCHER_CATEGORY_LABELS: Record<string, string> = {
  all: 'All Vouchers',
  coffee: 'Coffee & Tea',
  dining: 'Dining & Sweets',
  wellness: 'Wellness & Spa',
  culture: 'Culture & Books',
  retail: 'Shops & Crafts',
  general: 'General Rewards',
};

/** Connect Moment Categories and Labels */
export const CONNECT_MOMENT_CATEGORIES = [
  'meals',
  'study',
  'walks',
  'conversation',
  'rest',
] as const;
export type ConnectMomentCategory = (typeof CONNECT_MOMENT_CATEGORIES)[number];

export const CONNECT_MOMENT_CATEGORY_CONFIG: Record<
  ConnectMomentCategory,
  {
    label: string;
    icon: string;
    description: string;
    defaultMinutes: number;
    multiplier: number;
    ambientColor: string;
  }
> = {
  meals: {
    label: 'Mindful Meal',
    icon: '🍲',
    description: 'Savor your meal without screen distractions together.',
    defaultMinutes: 30,
    multiplier: 1.5,
    ambientColor: '#F5B041',
  },
  study: {
    label: 'Deep Focus & Study',
    icon: '📖',
    description: 'Shared immersion for reading, deep work, or study.',
    defaultMinutes: 45,
    multiplier: 2.0,
    ambientColor: '#4ECDC4',
  },
  walks: {
    label: 'Nature Stroll & Walk',
    icon: '🌿',
    description: 'Step outside together and enjoy the fresh open air.',
    defaultMinutes: 20,
    multiplier: 1.5,
    ambientColor: '#58D68D',
  },
  conversation: {
    label: 'Heart-to-Heart Chat',
    icon: '💬',
    description: 'Undivided presence for meaningful dialogue.',
    defaultMinutes: 25,
    multiplier: 1.75,
    ambientColor: '#AF7AC5',
  },
  rest: {
    label: 'Ambient Rest & Nap',
    icon: '🌙',
    description: 'Wind down and restore energy in peaceful quiet.',
    defaultMinutes: 15,
    multiplier: 1.25,
    ambientColor: '#5DADE2',
  },
};

>>>>>>> Stashed changes
export function normalizeCode(input: string): string {
  return input.trim().toUpperCase();
}

export function isPlausibleCode(input: string): boolean {
  const code = normalizeCode(input);
  if (code.length !== CODE_LENGTH) return false;
  return [...code].every((char) => CODE_ALPHABET.includes(char));
}

