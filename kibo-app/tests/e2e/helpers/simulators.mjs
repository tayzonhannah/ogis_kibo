/**
 * Complete in-memory state engine for KIBO simulating Supabase RPCs,
 * Realtime channels, Auth lifecycle, and component interactions.
 */

import {
  ROOM_CAPACITY,
  CODE_ALPHABET,
  CODE_LENGTH,
  MAX_AWAY_CREDIT_SECONDS,
  computeCoAwayAccrual,
  routeScreenCrossing,
} from './contracts.mjs';

export function generateRoomCode() {
  let result = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    const idx = Math.floor(Math.random() * CODE_ALPHABET.length);
    result += CODE_ALPHABET[idx];
  }
  return result;
}

export class MockSupabaseEnvironment {
  constructor() {
    this.users = new Map(); // id -> user object
    this.profiles = new Map(); // id -> profile
    this.rooms = new Map(); // id -> room
    this.roomCodeMap = new Map(); // code -> room_id
    this.participants = new Map(); // room_id -> Array of participant objects
    this.fish = new Map(); // id -> fish
    this.timeCapsules = new Map(); // id -> capsule
    this.vouchers = new Map(); // id -> voucher
    this.voucherRedemptions = [];
    this.joinAttempts = []; // rate limit tracking
    this.realtimeChannels = new Map(); // room_id -> array of listener callbacks

    this.initDefaultVouchers();
  }

  initDefaultVouchers() {
    const defaults = [
      { id: 'v1', partner_name: 'Blue Bottle Coffee', title: 'Free Oat Milk Cortado', points_cost: 120, discount_code: 'KIBO-CORTADO-24', category: 'coffee' },
      { id: 'v2', partner_name: 'City Lights Booksellers', title: '$10 Off Any Paperback', points_cost: 250, discount_code: 'KIBO-READS-10', category: 'bookstore' },
      { id: 'v3', partner_name: 'Onsen Bathhouse & Spa', title: '20% Off Evening Soak Session', points_cost: 500, discount_code: 'KIBO-ONSEN-20', category: 'wellness' },
      { id: 'v4', partner_name: 'Tartine Bakery', title: 'Complimentary Morning Pastry', points_cost: 150, discount_code: 'KIBO-PASTRY-AM', category: 'dining' },
      { id: 'v5', partner_name: 'SFMOMA Contemporary', title: 'Buy-One-Get-One General Admission', points_cost: 300, discount_code: 'KIBO-SFMOMA-BOGO', category: 'culture' },
    ];
    for (const v of defaults) {
      this.vouchers.set(v.id, v);
    }
  }

  createGoogleUser(userMeta = {}) {
    const id = userMeta.id || `user_${Math.random().toString(36).slice(2, 10)}`;
    const email = userMeta.email || `${id}@gmail.com`;
    const displayName = userMeta.displayName || `User ${id.slice(-4)}`;
    const avatarUrl = userMeta.avatarUrl || `https://lh3.googleusercontent.com/a/${id}`;
    const user = { id, email, displayName, avatarUrl, provider: 'google' };
    this.users.set(id, user);

    const profile = {
      id,
      email,
      displayName,
      avatarUrl,
      fishPoints: userMeta.fishPoints ?? 100,
    };
    this.profiles.set(id, profile);
    return user;
  }

  rpcCreateRoom(userId, roomName = 'Shared Tank', mood = 'calm') {
    const user = this.users.get(userId);
    if (!user) throw new Error('not_authenticated');

    const roomId = `room_${Math.random().toString(36).slice(2, 10)}`;
    let code = generateRoomCode();
    while (this.roomCodeMap.has(code)) {
      code = generateRoomCode();
    }

    const room = {
      id: roomId,
      code,
      name: roomName,
      created_by: userId,
      created_at: new Date().toISOString(),
      tank_mood: mood,
      nutrient_seconds: 0,
      co_away_since: null,
      active_away_count: 0,
      last_interaction_at: new Date().toISOString(),
      last_nudged_at: null,
      nudge_text: null,
    };

    this.rooms.set(roomId, room);
    this.roomCodeMap.set(code, roomId);

    // Add creator as first participant
    const participant = {
      room_id: roomId,
      user_id: userId,
      joined_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      hidden_since: null,
      love_language: 'time',
    };
    this.participants.set(roomId, [participant]);

    // Provision creator's fish
    const fishId = `fish_${Math.random().toString(36).slice(2, 10)}`;
    const fish = {
      id: fishId,
      room_id: roomId,
      owner_id: userId,
      holder_id: userId,
      color: '#FF6B6B',
      fin_style: 'standard',
      y_frac: 0.5,
      speed: 45,
      direction: 1,
      updated_at: new Date().toISOString(),
    };
    this.fish.set(fishId, fish);

    return { room_id: roomId, room_code: code };
  }

  rpcJoinRoom(userId, targetCode) {
    const user = this.users.get(userId);
    if (!user) return { status: 'not_authenticated', joined_room: null };

    const normalized = (targetCode || '').trim().toUpperCase();
    const roomId = this.roomCodeMap.get(normalized);
    if (!roomId || !this.rooms.has(roomId)) {
      return { status: 'room_not_found', joined_room: null };
    }

    const members = this.participants.get(roomId) || [];
    const alreadyMember = members.find((m) => m.user_id === userId);
    if (alreadyMember) {
      return { status: 'ok', joined_room: roomId };
    }

    if (members.length >= ROOM_CAPACITY) {
      return { status: 'room_full', joined_room: null };
    }

    const newParticipant = {
      room_id: roomId,
      user_id: userId,
      joined_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      hidden_since: null,
      love_language: 'words',
    };
    members.push(newParticipant);
    this.participants.set(roomId, members);

    // Provision distinct personalized fish for new member
    const finStyles = ['standard', 'veil', 'plakat', 'crown', 'butterfly'];
    const palette = ['#4ECDC4', '#FFE66D', '#FF8B94', '#9B5DE5', '#F15BB5'];
    const memberIndex = members.length - 1;
    const fishId = `fish_${Math.random().toString(36).slice(2, 10)}`;
    const fish = {
      id: fishId,
      room_id: roomId,
      owner_id: userId,
      holder_id: userId,
      color: palette[memberIndex % palette.length],
      fin_style: finStyles[memberIndex % finStyles.length],
      y_frac: 0.2 + (memberIndex * 0.15),
      speed: 40 + (memberIndex * 5),
      direction: memberIndex % 2 === 0 ? 1 : -1,
      updated_at: new Date().toISOString(),
    };
    this.fish.set(fishId, fish);

    return { status: 'ok', joined_room: roomId };
  }

  setParticipantAway(roomId, userId, away = true, timestamp = new Date().toISOString()) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');
    const members = this.participants.get(roomId) || [];
    const member = members.find((m) => m.user_id === userId);
    if (!member) throw new Error('Participant not in room');

    const wasAway = member.hidden_since !== null;
    if (away && !wasAway) {
      member.hidden_since = timestamp;
    } else if (!away && wasAway) {
      // Calculate continuous credit accrued up to this resume moment
      const now = new Date(timestamp).getTime();
      const openSince = room.co_away_since ? new Date(room.co_away_since).getTime() : now;
      const elapsedSec = (now - openSince) / 1000;
      const k = members.filter((m) => m.hidden_since !== null).length;
      const n = members.length;
      if (k > 0 && n >= 2) {
        const credit = computeCoAwayAccrual(elapsedSec, k, n);
        room.nutrient_seconds += Math.floor(credit);
      }
      member.hidden_since = null;
    }

    const currentAwayCount = members.filter((m) => m.hidden_since !== null).length;
    room.active_away_count = currentAwayCount;
    if (currentAwayCount > 0 && !room.co_away_since) {
      room.co_away_since = timestamp;
    } else if (currentAwayCount === 0) {
      room.co_away_since = null;
    }
  }

  createTimeCapsule(roomId, userId, capsuleData) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');
    const members = this.participants.get(roomId) || [];
    if (!members.some((m) => m.user_id === userId)) {
      throw new Error('RLS_VIOLATION: User is not a room member');
    }

    const id = `capsule_${Math.random().toString(36).slice(2, 10)}`;
    const capsule = {
      id,
      room_id: roomId,
      created_by: userId,
      title: capsuleData.title,
      memory_text: capsuleData.memory_text,
      media_url: capsuleData.media_url || null,
      unlock_at: capsuleData.unlock_at,
      created_at: new Date().toISOString(),
    };
    this.timeCapsules.set(id, capsule);
    return capsule;
  }

  getTimeCapsulesForUser(roomId, userId, currentTime = new Date()) {
    const members = this.participants.get(roomId) || [];
    if (!members.some((m) => m.user_id === userId)) {
      throw new Error('RLS_VIOLATION: Access denied');
    }

    const currentMs = currentTime instanceof Date ? currentTime.getTime() : new Date(currentTime).getTime();
    const result = [];
    for (const capsule of this.timeCapsules.values()) {
      if (capsule.room_id === roomId) {
        const unlockMs = new Date(capsule.unlock_at).getTime();
        const isUnlocked = currentMs >= unlockMs;
        result.push({
          ...capsule,
          unlocked: isUnlocked,
          memory_text: isUnlocked ? capsule.memory_text : '🔒 Locked until unlock date',
          media_url: isUnlocked ? capsule.media_url : null,
        });
      }
    }
    return result;
  }

  redeemVoucher(userId, voucherId) {
    const profile = this.profiles.get(userId);
    if (!profile) throw new Error('User profile not found');
    const voucher = this.vouchers.get(voucherId);
    if (!voucher) throw new Error('Voucher not found');

    if (profile.fishPoints < voucher.points_cost) {
      throw new Error(`Insufficient Fish Points (${profile.fishPoints} < ${voucher.points_cost})`);
    }

    profile.fishPoints -= voucher.points_cost;
    const redemption = {
      id: `redemption_${Math.random().toString(36).slice(2, 10)}`,
      user_id: userId,
      voucher_id: voucherId,
      redeemed_at: new Date().toISOString(),
      code: voucher.discount_code,
    };
    this.voucherRedemptions.push(redemption);
    return { success: true, remainingPoints: profile.fishPoints, code: voucher.discount_code };
  }
}
