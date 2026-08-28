/**
 * Contract models, schemas, and validators derived strictly from
 * ORIGINAL_REQUEST.md, PROJECT.md, and TEST_INFRA.md specifications.
 */

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 8;
export const ROOM_CAPACITY = 5;
export const MAX_AWAY_CREDIT_SECONDS = 28_800; // 8 hours

export const TANK_MOODS = ['calm', 'deep', 'bright', 'murky', 'warm'];
export const VOUCHER_CATEGORIES = ['coffee', 'bookstore', 'wellness', 'dining', 'culture'];
export const CONNECT_MOMENT_CATEGORIES = ['meals', 'study', 'walks', 'conversation', 'rest'];

/**
 * Validates a room code against the 8-character, unambiguous alphabet spec.
 */
export function isValidRoomCode(code) {
  if (typeof code !== 'string' || code.length !== CODE_LENGTH) return false;
  const normalized = code.toUpperCase();
  for (const char of normalized) {
    if (!CODE_ALPHABET.includes(char)) return false;
  }
  return true;
}

/**
 * Validates a Google OAuth Profile object.
 */
export function validateUserProfile(profile) {
  const errors = [];
  if (!profile || typeof profile !== 'object') {
    return { valid: false, errors: ['Profile must be an object'] };
  }
  if (!profile.id || typeof profile.id !== 'string') {
    errors.push('profile.id must be a non-empty string UUID');
  }
  if (profile.email !== undefined && typeof profile.email !== 'string') {
    errors.push('profile.email must be a string if provided');
  }
  if (profile.displayName !== undefined && typeof profile.displayName !== 'string') {
    errors.push('profile.displayName must be a string if provided');
  }
  if (profile.avatarUrl !== undefined && typeof profile.avatarUrl !== 'string') {
    errors.push('profile.avatarUrl must be a string if provided');
  }
  if (typeof profile.fishPoints !== 'number' || profile.fishPoints < 0 || !Number.isInteger(profile.fishPoints)) {
    errors.push('profile.fishPoints must be a non-negative integer');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validates a Tank/Room schema object.
 */
export function validateTankRoom(room) {
  const errors = [];
  if (!room || typeof room !== 'object') {
    return { valid: false, errors: ['Room must be an object'] };
  }
  if (!room.id || typeof room.id !== 'string') errors.push('room.id required');
  if (!isValidRoomCode(room.code)) errors.push(`Invalid room code: ${room.code}`);
  if (!room.name || typeof room.name !== 'string') errors.push('room.name must be non-empty string');
  if (!TANK_MOODS.includes(room.tank_mood)) errors.push(`Invalid tank mood: ${room.tank_mood}`);
  if (typeof room.nutrient_seconds !== 'number' || room.nutrient_seconds < 0) {
    errors.push('nutrient_seconds must be non-negative number');
  }
  if (typeof room.active_away_count !== 'number' || room.active_away_count < 0) {
    errors.push('active_away_count must be non-negative integer');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Pure reference calculation for K/N continuous co-away engine.
 * Computes exact nutrient accumulation for given elapsed seconds, total members N, and away members K.
 */
export function computeCoAwayAccrual(elapsedSeconds, kAway, nTotal, options = {}) {
  const { maxCreditSeconds = MAX_AWAY_CREDIT_SECONDS } = options;
  if (nTotal < 2) return 0;
  if (kAway <= 0) return 0;
  if (kAway > nTotal) throw new Error(`kAway (${kAway}) cannot exceed nTotal (${nTotal})`);

  const effectiveElapsed = Math.min(Math.max(0, elapsedSeconds), maxCreditSeconds);
  const rate = kAway / nTotal;
  return effectiveElapsed * rate;
}

/**
 * Continuous live nutrient calculation matching lib/nutrients.ts contract.
 */
export function liveNutrientSeconds(bankedSeconds, coAwaySince, nowMs, maxCreditSeconds = MAX_AWAY_CREDIT_SECONDS) {
  if (!coAwaySince) return bankedSeconds;
  const openedMs = Date.parse(coAwaySince);
  if (Number.isNaN(openedMs)) return bankedSeconds;
  const open = Math.max(0, Math.floor((nowMs - openedMs) / 1000));
  return bankedSeconds + Math.min(open, maxCreditSeconds);
}

/**
 * Formats nutrient seconds into coarse user-friendly units ("45s", "12m", "1h 15m").
 */
export function formatNutrientSeconds(total) {
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
export function simulatePiecewiseCoAway(intervals, initialBanked = 0) {
  let banked = initialBanked;
  for (const interval of intervals) {
    const { elapsedSeconds, kAway, nTotal } = interval;
    const gained = computeCoAwayAccrual(elapsedSeconds, kAway, nTotal);
    banked += gained;
  }
  return banked;
}

/**
 * Procedural fish generator contract validator.
 */
export function validateFishMorphology(fish) {
  const errors = [];
  if (!fish || typeof fish !== 'object') return { valid: false, errors: ['Fish must be an object'] };
  if (!fish.id) errors.push('fish.id is required');
  if (!fish.owner_id) errors.push('fish.owner_id is required');
  if (typeof fish.color !== 'string' || !fish.color.startsWith('#')) errors.push('fish.color must be a hex color');
  if (!['standard', 'veil', 'plakat', 'crown', 'butterfly'].includes(fish.fin_style)) {
    errors.push(`Invalid fin_style: ${fish.fin_style}`);
  }
  if (typeof fish.y_frac !== 'number' || fish.y_frac < 0 || fish.y_frac > 1) {
    errors.push('fish.y_frac must be in range [0, 1]');
  }
  if (typeof fish.speed !== 'number' || fish.speed <= 0) {
    errors.push('fish.speed must be positive number');
  }
  if (fish.direction !== 1 && fish.direction !== -1) {
    errors.push('fish.direction must be 1 or -1');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Ring topology screen crossing router.
 * For N ordered active users [u0, u1, ..., u_{N-1}], rightward (+1) routes to (i+1)%N,
 * leftward (-1) routes to (i-1+N)%N.
 */
export function routeScreenCrossing(fromUser, direction, activeUsers) {
  if (!activeUsers.includes(fromUser)) {
    throw new Error(`Sender ${fromUser} is not an active member`);
  }
  if (activeUsers.length <= 1) {
    return fromUser; // bounce locally if sole participant
  }
  const idx = activeUsers.indexOf(fromUser);
  const nextIdx = direction === 1 
    ? (idx + 1) % activeUsers.length 
    : (idx - 1 + activeUsers.length) % activeUsers.length;
  return activeUsers[nextIdx];
}
