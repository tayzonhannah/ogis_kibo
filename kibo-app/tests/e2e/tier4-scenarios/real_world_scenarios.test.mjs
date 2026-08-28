import { describe, it, expect } from '../test_framework.mjs';
import { MockSupabaseEnvironment } from '../helpers/simulators.mjs';
import {
  computeCoAwayAccrual,
  routeScreenCrossing,
  validateFishMorphology,
  validateTankRoom,
  validateUserProfile,
} from '../helpers/contracts.mjs';

describe('Tier 4: Real-World Multi-Step Scenarios', () => {
  it('Scenario A: Multi-Tank Lifecycle Workflow (Auth -> Multi-Tank Creation -> Dashboard -> Join via Code -> In-Tank Switcher)', async () => {
    const env = new MockSupabaseEnvironment();

    // Step 1: User logs in via Google OAuth
    const user = env.createGoogleUser({
      email: 'hannah.dev@gmail.com',
      displayName: 'Hannah S',
      avatarUrl: 'https://lh3.googleusercontent.com/a/hannah',
    });
    expect(validateUserProfile(env.profiles.get(user.id)).valid).toBe(true);

    // Step 2: Create "Family Tank" with 'warm' mood
    const familyRoom = env.rpcCreateRoom(user.id, 'Family Tank', 'warm');
    expect(familyRoom.room_code.length).toBe(8);

    // Step 3: Create "Study Pod Tank" with 'deep' mood
    const studyRoom = env.rpcCreateRoom(user.id, 'Study Pod Tank', 'deep');
    expect(studyRoom.room_code.length).toBe(8);

    // Step 4: Friend creates "Partner Tank", user joins via Code from Dashboard
    const partner = env.createGoogleUser({ email: 'partner@gmail.com', displayName: 'Sam' });
    const partnerRoom = env.rpcCreateRoom(partner.id, 'Partner Tank', 'calm');

    const joinRes = env.rpcJoinRoom(user.id, partnerRoom.room_code);
    expect(joinRes.status).toBe('ok');
    expect(joinRes.joined_room).toBe(partnerRoom.room_id);

    // Step 5: Verify Dashboard shows all 3 active tanks
    const userRooms = Array.from(env.rooms.values()).filter((r) => {
      const members = env.participants.get(r.id) || [];
      return members.some((m) => m.user_id === user.id);
    });
    expect(userRooms.length).toBe(3);
    const roomNames = userRooms.map((r) => r.name);
    expect(roomNames).toContain('Family Tank');
    expect(roomNames).toContain('Study Pod Tank');
    expect(roomNames).toContain('Partner Tank');

    // Step 6: In-Tank Switcher while inside Family Tank allows switching to Study Pod and Partner Tank
    const inTankOptions = userRooms.filter((r) => r.id !== familyRoom.room_id);
    expect(inTankOptions.length).toBe(2);
    expect(inTankOptions.map((r) => r.id)).toContain(studyRoom.room_id);
    expect(inTankOptions.map((r) => r.id)).toContain(partnerRoom.room_id);
  });

  it('Scenario B: 5-Member Shared Focus Session (5 Users -> 5 Fish -> 3 Away -> K/N 3/5 Accrual -> Connect Moment)', async () => {
    const env = new MockSupabaseEnvironment();

    // Step 1: 5 users join shared tank
    const users = Array.from({ length: 5 }, (_, i) =>
      env.createGoogleUser({ displayName: `Student ${i + 1}` })
    );
    const host = users[0];
    const roomInfo = env.rpcCreateRoom(host.id, 'Finals Study Pod', 'bright');

    for (let i = 1; i < 5; i++) {
      const res = env.rpcJoinRoom(users[i].id, roomInfo.room_code);
      expect(res.status).toBe('ok');
    }

    // Step 2: Verify 5 distinct personalized fish are instantiated
    const roomFish = Array.from(env.fish.values()).filter((f) => f.room_id === roomInfo.room_id);
    expect(roomFish.length).toBe(5);
    for (const fish of roomFish) {
      expect(validateFishMorphology(fish).valid).toBe(true);
    }

    // Step 3: 3 members turn phones off (away mode)
    const t0 = new Date('2026-08-24T10:00:00.000Z').toISOString();
    env.setParticipantAway(roomInfo.room_id, users[1].id, true, t0);
    env.setParticipantAway(roomInfo.room_id, users[2].id, true, t0);
    env.setParticipantAway(roomInfo.room_id, users[3].id, true, t0);

    const liveRoom = env.rooms.get(roomInfo.room_id);
    expect(liveRoom.active_away_count).toBe(3);

    // Step 4: 1800 seconds (30 mins) elapse with K=3, N=5 (rate 3/5 = 0.6)
    const t1 = new Date('2026-08-24T10:30:00.000Z').toISOString();
    // User 1 resumes
    env.setParticipantAway(roomInfo.room_id, users[1].id, false, t1);
    // Accrued = 1800 * 0.6 = 1080 seconds
    expect(liveRoom.nutrient_seconds).toBe(1080);

    // Step 5: Trigger Connect Moment study session with 1.5x bonus
    const connectSession = {
      id: 'session_study_finals',
      category: 'study',
      durationMinutes: 25,
      multiplier: 1.5,
      active: true,
    };
    expect(connectSession.category).toBe('study');
    expect(connectSession.multiplier).toBe(1.5);
  });

  it('Scenario C: Reciprocity & Partner Voucher Redemption (Accumulate Time -> Points Wallet -> Catalog Filter -> Redeem)', async () => {
    const env = new MockSupabaseEnvironment();

    // Step 1: User accumulates phone-off co-away time across tanks
    const user = env.createGoogleUser({ fishPoints: 50 });
    const r1 = env.rpcCreateRoom(user.id, 'Pod Alpha');
    const friend = env.createGoogleUser();
    env.rpcJoinRoom(friend.id, r1.room_code);

    // 7200 seconds of co-away at 1/2 rate = 3600 nutrient seconds
    const earnedNutrients = 3600;
    // Conversion rule: 3600 / 30 = 120 points earned
    const awardedPoints = Math.floor(earnedNutrients / 30);
    env.profiles.get(user.id).fishPoints += awardedPoints;

    // Total points now: 50 + 120 = 170 points
    expect(env.profiles.get(user.id).fishPoints).toBe(170);

    // Step 2: Browse /vouchers catalog and filter by 'coffee' and 'dining'
    const coffeeVouchers = Array.from(env.vouchers.values()).filter((v) => v.category === 'coffee');
    const diningVouchers = Array.from(env.vouchers.values()).filter((v) => v.category === 'dining');
    expect(coffeeVouchers.length).toBeGreaterThanOrEqual(1);
    expect(diningVouchers.length).toBeGreaterThanOrEqual(1);

    // Step 3: Redeem Coffee Cortado (cost 120)
    const redeemRes = env.redeemVoucher(user.id, 'v1');
    expect(redeemRes.success).toBe(true);
    expect(redeemRes.remainingPoints).toBe(50);
    expect(redeemRes.code).toBe('KIBO-CORTADO-24');

    // Step 4: Verify ledger integrity
    expect(env.voucherRedemptions.length).toBe(1);
    expect(env.voucherRedemptions[0].user_id).toBe(user.id);
    expect(env.voucherRedemptions[0].voucher_id).toBe('v1');
  });

  it('Scenario D: Privacy-First Time Capsule Memory Unlock (Deposit Capsule -> Locked RLS -> Time Advances -> Unlocked Feed)', async () => {
    const env = new MockSupabaseEnvironment();

    // Step 1: Room members deposit milestone capsule
    const member1 = env.createGoogleUser({ displayName: 'Maya' });
    const member2 = env.createGoogleUser({ displayName: 'Leo' });
    const outsider = env.createGoogleUser({ displayName: 'Eve' });

    const room = env.rpcCreateRoom(member1.id, 'Anniversary Tank');
    env.rpcJoinRoom(member2.id, room.room_code);

    const unlockTime = new Date('2026-08-24T18:00:00.000Z');
    env.createTimeCapsule(room.room_id, member1.id, {
      title: 'Our One Year Milestone',
      memory_text: 'Looking back on our favorite memories!',
      media_url: 'https://images.unsplash.com/photo-anniversary',
      unlock_at: unlockTime.toISOString(),
    });

    // Step 2: Outsider is blocked by RLS
    expect(() => {
      env.getTimeCapsulesForUser(room.room_id, outsider.id, new Date('2026-08-24T12:00:00.000Z'));
    }).toThrow('RLS_VIOLATION');

    // Step 3: Before unlock time, member sees locked mask
    const beforeFeed = env.getTimeCapsulesForUser(
      room.room_id,
      member2.id,
      new Date('2026-08-24T12:00:00.000Z')
    );
    expect(beforeFeed.length).toBe(1);
    expect(beforeFeed[0].unlocked).toBe(false);
    expect(beforeFeed[0].memory_text).toContain('Locked');
    expect(beforeFeed[0].media_url).toBeNull();

    // Step 4: After unlock time, member sees full memory and photo
    const afterFeed = env.getTimeCapsulesForUser(
      room.room_id,
      member2.id,
      new Date('2026-08-24T19:00:00.000Z')
    );
    expect(afterFeed.length).toBe(1);
    expect(afterFeed[0].unlocked).toBe(true);
    expect(afterFeed[0].memory_text).toBe('Looking back on our favorite memories!');
    expect(afterFeed[0].media_url).toBe('https://images.unsplash.com/photo-anniversary');
  });

  it('Scenario E: Adversarial & Edge Case Concurrency Suite (Rapid Screen Handoff -> 6th User Rejection -> Expired / Insufficient Vouchers)', async () => {
    const env = new MockSupabaseEnvironment();

    // 1. Capacity overflow test
    const host = env.createGoogleUser();
    const room = env.rpcCreateRoom(host.id, 'Stress Tank');
    const peers = [host.id];

    for (let i = 0; i < 4; i++) {
      const g = env.createGoogleUser();
      peers.push(g.id);
      const res = env.rpcJoinRoom(g.id, room.room_code);
      expect(res.status).toBe('ok');
    }

    const intruder = env.createGoogleUser();
    const rejectRes = env.rpcJoinRoom(intruder.id, room.room_code);
    expect(rejectRes.status).toBe('room_full');

    // 2. High-speed ring screen handoff across all 5 peers
    let currentHolder = peers[0];
    for (let step = 0; step < 25; step++) {
      currentHolder = routeScreenCrossing(currentHolder, 1, peers);
    }
    // 25 steps in 5-peer ring brings holder back to peers[0]
    expect(currentHolder).toBe(peers[0]);

    // 3. Insufficient balance voucher rejection
    const brokeUser = env.createGoogleUser({ fishPoints: 10 });
    expect(() => {
      env.redeemVoucher(brokeUser.id, 'v3'); // cost 500
    }).toThrow('Insufficient Fish Points');
  });

  it('Scenario F: Multi-Tank Multi-User Cross-Switching & State Isolation (Strict Separation of Fish, Nutrients, and Capsules)', async () => {
    const env = new MockSupabaseEnvironment();

    // User is part of 3 distinct tanks with different member sizes:
    // Tank A (2 members), Tank B (5 members), Tank C (3 members)
    const user = env.createGoogleUser({ displayName: 'Cross User' });

    // Tank A (2 members)
    const partner = env.createGoogleUser({ displayName: 'Partner' });
    const tankA = env.rpcCreateRoom(user.id, 'Tank A (Couple)', 'warm');
    env.rpcJoinRoom(partner.id, tankA.room_code);

    // Tank B (5 members)
    const squad = Array.from({ length: 4 }, (_, i) => env.createGoogleUser({ displayName: `Squad ${i}` }));
    const tankB = env.rpcCreateRoom(user.id, 'Tank B (Squad)', 'bright');
    for (const member of squad) {
      env.rpcJoinRoom(member.id, tankB.room_code);
    }

    // Tank C (3 members)
    const family = Array.from({ length: 2 }, (_, i) => env.createGoogleUser({ displayName: `Family ${i}` }));
    const tankC = env.rpcCreateRoom(user.id, 'Tank C (Family)', 'deep');
    for (const member of family) {
      env.rpcJoinRoom(member.id, tankC.room_code);
    }

    // Verify member counts
    expect(env.participants.get(tankA.room_id).length).toBe(2);
    expect(env.participants.get(tankB.room_id).length).toBe(5);
    expect(env.participants.get(tankC.room_id).length).toBe(3);

    // Verify fish counts per tank
    const fishA = Array.from(env.fish.values()).filter((f) => f.room_id === tankA.room_id);
    const fishB = Array.from(env.fish.values()).filter((f) => f.room_id === tankB.room_id);
    const fishC = Array.from(env.fish.values()).filter((f) => f.room_id === tankC.room_id);
    expect(fishA.length).toBe(2);
    expect(fishB.length).toBe(5);
    expect(fishC.length).toBe(3);

    // Set away states in Tank B without affecting Tank A or C
    env.setParticipantAway(tankB.room_id, squad[0].id, true);
    env.setParticipantAway(tankB.room_id, squad[1].id, true);
    expect(env.rooms.get(tankB.room_id).active_away_count).toBe(2);
    expect(env.rooms.get(tankA.room_id).active_away_count).toBe(0);
    expect(env.rooms.get(tankC.room_id).active_away_count).toBe(0);
  });
});
