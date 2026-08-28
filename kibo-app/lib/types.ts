import type { LoveLanguage, TankMood } from './constants';

export type UserProfile = {
  id: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  fishPoints: number;
  createdAt?: string;
  updatedAt?: string;
};

export type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  fish_points: number;
  created_at: string;
  updated_at: string;
};

export type RoomRow = {
  id: string;
  code: string;
  name: string;
  created_at: string;
  created_by: string | null;
  tank_mood: TankMood;
  nutrient_seconds: number;
  co_away_since: string | null;
  active_away_count?: number;
  last_interaction_at: string;
  last_nudged_at: string | null;
  /** Written only by app/api/nudge — no client update grant. See 0006. */
  nudge_text: string | null;
};

export type ParticipantRow = {
  room_id: string;
  user_id: string;
  joined_at: string;
  last_seen_at: string;
  hidden_since: string | null;
  /**
   * Constrained to LOVE_LANGUAGES by 0006. Typed as the union rather than
   * `string` so a stray value has to be narrowed deliberately — this is the one
   * client-writable field that reaches the model.
   */
  love_language: LoveLanguage | null;
  profile?: UserProfile;
};

/** Direction is 1 (rightward) or -1 (leftward). */
export type FishDirection = 1 | -1;

export type FishRow = {
  id: string;
  room_id: string;
  holder: string | null;
  owner_id?: string | null;
  y_frac: number;
  speed_px_s: number;
  direction: FishDirection;
  color: string;
  fin_style?: string;
  updated_at: string;
};

export type MemoRow = {
  id: string;
  room_id: string;
  author: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
};

export type TimeCapsuleRow = {
  id: string;
  room_id: string;
  created_by: string;
  title: string;
  memory_text: string;
  media_url: string | null;
  unlock_at: string;
  unlocked: boolean;
  created_at: string;
};

export type VoucherCategory =
  | 'coffee'
  | 'dining'
  | 'wellness'
  | 'culture'
  | 'retail'
  | 'general';

export type VoucherRow = {
  id: string;
  partner_name: string;
  title: string;
  description: string;
  points_cost: number;
  discount_code: string;
  category: VoucherCategory;
  image_url?: string | null;
  is_active: boolean;
  created_at: string;
};

export type VoucherRedemptionRow = {
  id: string;
  user_id: string;
  voucher_id: string;
  points_spent: number;
  redeemed_at: string;
  voucher?: VoucherRow;
};

export type CreateRoomResult = {
  room_id: string;
  room_code: string;
};

export type TankSummary = {
  id: string;
  code: string;
  name: string;
  tank_mood: TankMood;
  member_count: number;
  nutrient_seconds: number;
  co_away_since: string | null;
  last_interaction_at: string;
  created_by: string | null;
};

/**
 * Broadcast payload for a fish crossing a screen boundary. This is the fast
 * path only — never authoritative. The matching `fish.holder` write in
 * Postgres is what actually transfers ownership.
 */
export type FishCrossPayload = {
  fishId: string;
  y_frac: number;
  speed_px_s: number;
  direction: FishDirection;
  color: string;
  finStyle?: string;
  fromUser?: string;
  toUser: string;
};

/**
 * join_room() returns a status row rather than raising, because RAISE
 * EXCEPTION would roll back the join_attempts insert that backs the rate
 * limiter. See supabase/migrations/0002_join_room_returns_status.sql.
 */
export type JoinStatus =
  | 'ok'
  | 'room_not_found'
  | 'room_full'
  | 'too_many_attempts';

/**
 * The id field is `joined_room`, not `room_id`. An OUT parameter named
 * `room_id` collides with room_participants.room_id and makes the function
 * fail at runtime with 42702 — see migration 0002.
 */
export type JoinRoomRow = { status: JoinStatus; joined_room: string | null };

/**
 * Phase 3 broadcast payloads.
 *
 * Warmth and hearts are broadcast-only and intentionally lossy: a gesture
 * nobody was present for is a missed moment, not lost state. Memos are the
 * opposite — they persist in `memos` and broadcast only as the fast path, the
 * same split as fish handoff.
 *
 * Positions travel as fractions of the viewport so they land in the same
 * relative place on a phone and a laptop.
 */
export type WarmthPayload = { id: string; xFrac: number };

export type MemoPayload = {
  id: string;
  body: string;
  xFrac: number;
  yFrac: number;
};

export type HeartPayload = { id: string; xFrac: number; yFrac: number };

/**
 * A retraction, which must travel by broadcast rather than postgres_changes.
 *
 * Retracting is an UPDATE that sets `deleted_at`, and the memos SELECT policy is
 * `is_member(room_id) and deleted_at is null` — so the updated row no longer
 * satisfies the policy the subscription reads through, and realtime does not
 * deliver it. Unlike the fish and memo paths, there is no truth-path fallback
 * available here, so this broadcast is the only live delivery.
 */
export type MemoRetractedPayload = { id: string };

/** Errors from the room lifecycle RPCs, surfaced as distinct UI states. */
export type RoomError =
  | 'room_not_found'
  | 'room_full'
  | 'too_many_attempts'
  | 'not_authenticated'
  | 'timeout'
  | 'unknown';

const KNOWN_ROOM_ERRORS: RoomError[] = [
  'room_not_found',
  'room_full',
  'too_many_attempts',
  'not_authenticated',
];

/** Postgres raises these as message text; map them back to a typed union. */
export function toRoomError(message: string | undefined): RoomError {
  const match = KNOWN_ROOM_ERRORS.find((code) => message?.includes(code));
  return match ?? 'unknown';
}

/** Map a non-ok join status onto the error union. */
export function joinStatusToError(status: string | undefined): RoomError {
  const match = KNOWN_ROOM_ERRORS.find((code) => code === status);
  return match ?? 'unknown';
}

export const ROOM_ERROR_COPY: Record<RoomError, string> = {
  room_not_found: 'No tank with that code. Check the characters and try again.',
  room_full: 'That tank has reached its maximum capacity of 5 members.',
  too_many_attempts: 'Too many tries. Wait a few minutes before trying again.',
  not_authenticated: 'Please sign in with Google to enter this tank.',
  timeout:
    "The tank didn't answer. Check your connection or verify that Supabase services are reachable.",
  unknown: 'Something went wrong reaching the tank.',
};

/**
 * Connect Moment session & broadcast contracts.
 */
export type ConnectMomentCategory =
  | 'meals'
  | 'study'
  | 'walks'
  | 'conversation'
  | 'rest';

export type ConnectMomentSession = {
  id: string;
  category: ConnectMomentCategory;
  targetDurationMinutes: number;
  multiplier: number;
  active: boolean;
  startedAt: number;
  initiatorId: string;
  initiatorName?: string;
};

export type ConnectMomentStartPayload = {
  id: string;
  category: ConnectMomentCategory;
  targetDurationMinutes: number;
  multiplier: number;
  startedAt: number;
  initiatorId: string;
  initiatorName?: string;
};

export type ConnectMomentEndPayload = {
  id: string;
  completed: boolean;
  actualDurationMinutes: number;
  pointsEarned: number;
};

