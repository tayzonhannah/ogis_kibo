import type { TankMood } from './constants';

export type RoomRow = {
  id: string;
  code: string;
  created_at: string;
  tank_mood: TankMood;
  nutrient_seconds: number;
  co_away_since: string | null;
  last_interaction_at: string;
  last_nudged_at: string | null;
};

export type ParticipantRow = {
  room_id: string;
  user_id: string;
  joined_at: string;
  last_seen_at: string;
  hidden_since: string | null;
  love_language: string | null;
};

/** Direction is 1 (rightward) or -1 (leftward). */
export type FishDirection = 1 | -1;

export type FishRow = {
  id: string;
  room_id: string;
  holder: string | null;
  y_frac: number;
  speed_px_s: number;
  direction: FishDirection;
  color: string;
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

/** Errors from the room lifecycle RPCs, surfaced as distinct UI states. */
export type RoomError =
  | 'room_not_found'
  | 'room_full'
  | 'too_many_attempts'
  | 'not_authenticated'
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
  room_not_found: "No tank with that code. Check the characters and try again.",
  room_full: 'That tank already has two people in it.',
  too_many_attempts: 'Too many tries. Wait a few minutes before trying again.',
  not_authenticated: 'Still connecting. Give it a second and try again.',
  unknown: 'Something went wrong reaching the tank.',
};
