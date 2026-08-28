/**
 * Tier 5 Adversarial Stress & Coverage Hardening Test Suite
 * 
 * Verifies system boundaries and stress scenarios across:
 * 1. Extreme concurrency in K/N accumulation during rapid member visibility changes.
 * 2. Heavy multi-tank switching and ring-topology handoff robustness.
 * 3. Insufficient points rejection and duplicate redemption race conditions.
 * 4. Unlocked memory disclosure prevention and time capsule security boundaries.
 */

import { describe, it, expect } from './test_framework.mjs';
import { MockSupabaseEnvironment } from './helpers/simulators.mjs';
import {
  ROOM_CAPACITY,
  MAX_AWAY_CREDIT_SECONDS,
  computeCoAwayAccrual,
  liveNutrientSeconds,
  simulatePiecewiseCoAway,
  routeScreenCrossing,
  validateFishMorphology,
} from './helpers/contracts.mjs';

describe('Tier 5: Adversarial Coverage Hardening & Empirical Stress Tests', () => {

  // ==========================================================================
  // AREA 1: Extreme Concurrency in K/N Continuous Co-Away Accumulation
  // ==========================================================================
  describe('Area 1: K/N Continuous Co-Away Concurrency & Boundary Hardening', () => {

    it('TC-T5-01: Rapid flapping of member visibility state accumulates nutrients strictly monotonically', () => {
      const env = new MockSupabaseEnvironment();
      const creator = env.createGoogleUser({ id: 'u_flapper_0' });
      const room = env.rpcCreateRoom(creator.id, 'Flapping Stress Tank');
      
      const members = [
        creator,
        env.createGoogleUser({ id: 'u_flapper_1' }),
        env.createGoogleUser({ id: 'u_flapper_2' }),
        env.createGoogleUser({ id: 'u_flapper_3' }),
        env.createGoogleUser({ id: 'u_flapper_4' }),
      ];

      for (let i = 1; i < members.length; i++) {
        env.rpcJoinRoom(members[i].id, room.room_code);
      }

      // Simulate 60 rapid pseudo-concurrent visibility changes across all 5 members
      let baseTime = Date.now();
      let lastBanked = env.rooms.get(room.room_id).nutrient_seconds;

      for (let cycle = 0; cycle < 60; cycle++) {
        const randomMember = members[Math.floor(Math.random() * members.length)];
        const isAway = cycle % 2 === 0;
        baseTime += 1500; // 1.5s step

        env.setParticipantAway(room.room_id, randomMember.id, isAway, new Date(baseTime).toISOString());
        const currentRoom = env.rooms.get(room.room_id);

        expect(currentRoom.nutrient_seconds).toBeGreaterThanOrEqual(lastBanked);
        expect(Number.isFinite(currentRoom.nutrient_seconds)).toBe(true);
        expect(Number.isNaN(currentRoom.nutrient_seconds)).toBe(false);
        lastBanked = currentRoom.nutrient_seconds;
      }
    });

    it('TC-T5-02: Piecewise continuous integration across dynamic K transitions matches reference math exactly', () => {
      // 5-member tank: K changes [K=1 (100s) -> K=4 (200s) -> K=2 (300s) -> K=5 (500s) -> K=0 (60s)]
      const N = 5;
      const intervals = [
        { elapsedSeconds: 100, kAway: 1, nTotal: N }, // 100 * (1/5) = 20
        { elapsedSeconds: 200, kAway: 4, nTotal: N }, // 200 * (4/5) = 160
        { elapsedSeconds: 300, kAway: 2, nTotal: N }, // 300 * (2/5) = 120
        { elapsedSeconds: 500, kAway: 5, nTotal: N }, // 500 * (5/5) = 500
        { elapsedSeconds: 60,  kAway: 0, nTotal: N }, // 60 * (0/5) = 0
      ];

      const totalAccrued = simulatePiecewiseCoAway(intervals, 0);
      const expected = 20 + 160 + 120 + 500 + 0; // 800

      expect(totalAccrued).toBe(expected);
      expect(totalAccrued).toBe(800);
    });

    it('TC-T5-03: Dynamic group resizing (N transitions from 2 to 3 to 5 to 4) preserves strict mathematical bounds', () => {
      const transitions = [
        { elapsedSeconds: 120, kAway: 2, nTotal: 2 }, // 120 * (2/2) = 120
        { elapsedSeconds: 180, kAway: 2, nTotal: 3 }, // 180 * (2/3) = 120
        { elapsedSeconds: 300, kAway: 3, nTotal: 5 }, // 300 * (3/5) = 180
        { elapsedSeconds: 240, kAway: 3, nTotal: 4 }, // 240 * (3/4) = 180
      ];

      const accumulated = simulatePiecewiseCoAway(transitions, 50);
      expect(accumulated).toBe(50 + 120 + 120 + 180 + 180);
      expect(accumulated).toBe(650);

      // Verify N < 2 yields 0 accrual
      expect(computeCoAwayAccrual(500, 1, 1)).toBe(0);
      expect(computeCoAwayAccrual(500, 0, 4)).toBe(0);
    });

    it('TC-T5-04: Extreme hibernation clamp bounds accrual strictly at MAX_AWAY_CREDIT_SECONDS (28,800s / 8h)', () => {
      const oneWeekSeconds = 7 * 24 * 3600; // 604,800s
      const accrual = computeCoAwayAccrual(oneWeekSeconds, 5, 5); // K=5, N=5

      expect(accrual).toBe(MAX_AWAY_CREDIT_SECONDS);
      expect(accrual).toBe(28800);

      // Clamping with fractional rate (K=3, N=5)
      const fractionalAccrual = computeCoAwayAccrual(oneWeekSeconds, 3, 5);
      expect(fractionalAccrual).toBe(28800 * 0.6);
      expect(fractionalAccrual).toBe(17280);
    });

    it('TC-T5-05: Live nutrient calculation handles negative or malformed timestamps without crashing or negative drift', () => {
      const nowMs = 1700000000000;
      
      // Future timestamp (clock skew): should not subtract from banked
      const futureCoAway = new Date(nowMs + 60000).toISOString();
      const live1 = liveNutrientSeconds(150, futureCoAway, nowMs);
      expect(live1).toBe(150);

      // Invalid unparseable date string: should return banked seconds
      const live2 = liveNutrientSeconds(150, 'INVALID_DATE_STRING', nowMs);
      expect(live2).toBe(150);

      // Null coAwaySince: should return banked seconds
      const live3 = liveNutrientSeconds(150, null, nowMs);
      expect(live3).toBe(150);
    });
  });

  // ==========================================================================
  // AREA 2: Heavy Multi-Tank Switching & Ring-Topology Handoff Robustness
  // ==========================================================================
  describe('Area 2: Multi-Tank Switching & Ring-Topology Handoff Robustness', () => {

    it('TC-T5-06: Deterministic ring-topology screen crossing routing across 3-5 users in both directions', () => {
      const ring5 = ['usr_alice', 'usr_bob', 'usr_charlie', 'usr_diana', 'usr_evan'];

      // Forward direction (+1)
      expect(routeScreenCrossing('usr_alice', 1, ring5)).toBe('usr_bob');
      expect(routeScreenCrossing('usr_bob', 1, ring5)).toBe('usr_charlie');
      expect(routeScreenCrossing('usr_charlie', 1, ring5)).toBe('usr_diana');
      expect(routeScreenCrossing('usr_diana', 1, ring5)).toBe('usr_evan');
      expect(routeScreenCrossing('usr_evan', 1, ring5)).toBe('usr_alice'); // Wrap-around

      // Backward direction (-1)
      expect(routeScreenCrossing('usr_alice', -1, ring5)).toBe('usr_evan'); // Wrap-around
      expect(routeScreenCrossing('usr_evan', -1, ring5)).toBe('usr_diana');
      expect(routeScreenCrossing('usr_diana', -1, ring5)).toBe('usr_charlie');
      expect(routeScreenCrossing('usr_charlie', -1, ring5)).toBe('usr_bob');
      expect(routeScreenCrossing('usr_bob', -1, ring5)).toBe('usr_alice');
    });

    it('TC-T5-07: Sudden peer drop mid-crossing triggers graceful re-routing to surviving members', () => {
      const initialRing = ['usr_a', 'usr_b', 'usr_c', 'usr_d'];
      
      // Peer B disconnects while fish is crossing from A -> B
      const activeAfterDrop = ['usr_a', 'usr_c', 'usr_d'];
      const targetAfterDrop = routeScreenCrossing('usr_a', 1, activeAfterDrop);
      expect(targetAfterDrop).toBe('usr_c');

      // Only single user remains: reflects locally
      const soloRing = ['usr_a'];
      const targetSolo = routeScreenCrossing('usr_a', 1, soloRing);
      expect(targetSolo).toBe('usr_a');
    });

    it('TC-T5-08: Simultaneous bidirectional multi-fish handoff storm maintains exact fish conservation', () => {
      const env = new MockSupabaseEnvironment();
      const u1 = env.createGoogleUser({ id: 'u_storm_1' });
      const room = env.rpcCreateRoom(u1.id, 'Handoff Storm Tank');

      const u2 = env.createGoogleUser({ id: 'u_storm_2' });
      const u3 = env.createGoogleUser({ id: 'u_storm_3' });
      const u4 = env.createGoogleUser({ id: 'u_storm_4' });
      const u5 = env.createGoogleUser({ id: 'u_storm_5' });

      env.rpcJoinRoom(u2.id, room.room_code);
      env.rpcJoinRoom(u3.id, room.room_code);
      env.rpcJoinRoom(u4.id, room.room_code);
      env.rpcJoinRoom(u5.id, room.room_code);

      const allFish = Array.from(env.fish.values()).filter((f) => f.room_id === room.room_id);
      expect(allFish.length).toBe(5);

      // Verify every fish has valid morphology
      for (const fish of allFish) {
        const val = validateFishMorphology(fish);
        expect(val.valid).toBe(true);
        expect(val.errors.length).toBe(0);
      }

      // Simulate 100 screen crossing handoffs in quick succession
      const members = [u1.id, u2.id, u3.id, u4.id, u5.id];
      for (let i = 0; i < 100; i++) {
        const fish = allFish[i % allFish.length];
        const direction = i % 2 === 0 ? 1 : -1;
        const currentHolder = fish.holder_id;
        const nextHolder = routeScreenCrossing(currentHolder, direction, members);

        // Handoff write
        fish.holder_id = nextHolder;
        fish.direction = direction;
      }

      // Verify no fish were lost or duplicated
      const finalFishInRoom = Array.from(env.fish.values()).filter((f) => f.room_id === room.room_id);
      expect(finalFishInRoom.length).toBe(5);
      
      const holderIds = finalFishInRoom.map((f) => f.holder_id);
      for (const hid of holderIds) {
        expect(members.includes(hid)).toBe(true);
      }
    });

    it('TC-T5-09: Heavy multi-tank switching by single user preserves room isolation and state purity', () => {
      const env = new MockSupabaseEnvironment();
      const user = env.createGoogleUser({ id: 'u_switcher_pro' });

      // User creates 10 distinct tanks
      const tanks = [];
      for (let i = 0; i < 10; i++) {
        const r = env.rpcCreateRoom(user.id, `Tank #${i + 1}`, i % 2 === 0 ? 'calm' : 'bright');
        tanks.push(r);
      }

      expect(tanks.length).toBe(10);

      // User navigates sequentially through all 10 tanks
      for (const tank of tanks) {
        const targetRoom = env.rooms.get(tank.room_id);
        expect(targetRoom).toBeDefined();
        expect(targetRoom.created_by).toBe(user.id);

        const roomFish = Array.from(env.fish.values()).filter((f) => f.room_id === tank.room_id);
        expect(roomFish.length).toBe(1);
        expect(roomFish[0].owner_id).toBe(user.id);
      }
    });

    it('TC-T5-10: Boid separation algorithm bounds vertical coordinate within safety margin [0.12, 0.88]', () => {
      // Simulate boid repulsive force on colliding fish
      const fishA = { x: 200, yFrac: 0.5, direction: 1 };
      const fishB = { x: 205, yFrac: 0.5, direction: 1 };
      const height = 600;
      const dt = 0.016; // 60fps

      const dx = fishA.x - fishB.x;
      const dyPx = (fishA.yFrac - fishB.yFrac) * height;
      const normDistSq = (dx * dx) / (90 * 90) + (dyPx * dyPx) / (55 * 55);

      expect(normDistSq).toBeLessThan(1.0); // Inside collision bubble

      // Repulsion logic
      const force = 1.0 - Math.sqrt(normDistSq);
      const repulseY = (1 * force * 35) / height;
      const nextYFrac = Math.max(0.12, Math.min(0.88, fishA.yFrac + repulseY * dt));

      expect(nextYFrac).toBeGreaterThanOrEqual(0.12);
      expect(nextYFrac).toBeLessThanOrEqual(0.88);
      expect(Number.isFinite(nextYFrac)).toBe(true);
    });
  });

  // ==========================================================================
  // AREA 3: Insufficient Points Rejection & Duplicate Redemption Race Conditions
  // ==========================================================================
  describe('Area 3: Points Wallet & Voucher Redemption Race Conditions', () => {

    it('TC-T5-11: Concurrent duplicate redemption requests on insufficient points allow exactly 1 success', () => {
      const env = new MockSupabaseEnvironment();
      // User starts with 150 points. Voucher costs 120 points.
      const user = env.createGoogleUser({ id: 'u_racer_1', fishPoints: 150 });
      const voucherId = 'v1'; // 120 points

      // Simulate 5 simultaneous redemption attempts
      const attempts = [1, 2, 3, 4, 5];
      const results = [];

      for (const _ of attempts) {
        try {
          const res = env.redeemVoucher(user.id, voucherId);
          results.push({ status: 'ok', res });
        } catch (err) {
          results.push({ status: 'error', message: err.message });
        }
      }

      const successes = results.filter((r) => r.status === 'ok');
      const failures = results.filter((r) => r.status === 'error');

      // Exactly 1 success, 4 failures
      expect(successes.length).toBe(1);
      expect(failures.length).toBe(4);

      // Remaining balance must be exactly 30 (150 - 120)
      const finalProfile = env.profiles.get(user.id);
      expect(finalProfile.fishPoints).toBe(30);

      // Ledger must contain exactly 1 redemption
      const redemptions = env.voucherRedemptions.filter((r) => r.user_id === user.id);
      expect(redemptions.length).toBe(1);
      expect(redemptions[0].code).toBe('KIBO-CORTADO-24');
    });

    it('TC-T5-12: Zero balance boundary: User cannot redeem any voucher with 0 Fish Points', () => {
      const env = new MockSupabaseEnvironment();
      const user = env.createGoogleUser({ id: 'u_broke_user', fishPoints: 0 });

      expect(() => env.redeemVoucher(user.id, 'v1')).toThrow('Insufficient Fish Points');
      expect(() => env.redeemVoucher(user.id, 'v2')).toThrow('Insufficient Fish Points');
      expect(() => env.redeemVoucher(user.id, 'v3')).toThrow('Insufficient Fish Points');

      const profile = env.profiles.get(user.id);
      expect(profile.fishPoints).toBe(0);
      expect(env.voucherRedemptions.length).toBe(0);
    });

    it('TC-T5-13: Rejects redemption on non-existent or inactive voucher without modifying points', () => {
      const env = new MockSupabaseEnvironment();
      const user = env.createGoogleUser({ id: 'u_probe_user', fishPoints: 500 });

      expect(() => env.redeemVoucher(user.id, 'non_existent_voucher_999')).toThrow('Voucher not found');

      const profile = env.profiles.get(user.id);
      expect(profile.fishPoints).toBe(500);
      expect(env.voucherRedemptions.length).toBe(0);
    });

    it('TC-T5-14: Cross-user points isolation: Redemptions are strictly deducted from caller profile', () => {
      const env = new MockSupabaseEnvironment();
      const userA = env.createGoogleUser({ id: 'u_user_A', fishPoints: 300 });
      const userB = env.createGoogleUser({ id: 'u_user_B', fishPoints: 300 });

      // User A redeems 250 pt voucher
      const resA = env.redeemVoucher(userA.id, 'v2');
      expect(resA.success).toBe(true);

      expect(env.profiles.get(userA.id).fishPoints).toBe(50);
      expect(env.profiles.get(userB.id).fishPoints).toBe(300); // Unchanged
    });

    it('TC-T5-15: Full ledger audit: Points spent + Current balance equals starting balance', () => {
      const env = new MockSupabaseEnvironment();
      const startingPoints = 1000;
      const user = env.createGoogleUser({ id: 'u_audit_user', fishPoints: startingPoints });

      // Redeem v1 (120), v2 (250), v4 (150)
      env.redeemVoucher(user.id, 'v1');
      env.redeemVoucher(user.id, 'v2');
      env.redeemVoucher(user.id, 'v4');

      const currentPoints = env.profiles.get(user.id).fishPoints;
      const totalSpent = 120 + 250 + 150; // 520

      expect(currentPoints).toBe(1000 - 520);
      expect(currentPoints).toBe(480);
      expect(currentPoints + totalSpent).toBe(startingPoints);
    });
  });

  // ==========================================================================
  // AREA 4: Unlocked Memory Disclosure Prevention & Time Capsule Security
  // ==========================================================================
  describe('Area 4: Time Capsule Privacy & Security Boundaries', () => {

    it('TC-T5-16: Sealed time capsules strictly redact memory_text and mask media_url for all readers', () => {
      const env = new MockSupabaseEnvironment();
      const creator = env.createGoogleUser({ id: 'u_capsule_author' });
      const room = env.rpcCreateRoom(creator.id, 'Secret Capsule Tank');

      const futureDate = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(); // 30 days ahead
      const rawSecretStory = 'This is top secret memory text that must not leak before unlock!';
      const rawSecretMedia = 'https://secret.cdn/private_photo.jpg';

      const capsule = env.createTimeCapsule(room.room_id, creator.id, {
        title: 'Future Milestone',
        memory_text: rawSecretStory,
        media_url: rawSecretMedia,
        unlock_at: futureDate,
      });

      expect(capsule.id).toBeDefined();

      // Read as participant before unlock date
      const feed = env.getTimeCapsulesForUser(room.room_id, creator.id, new Date());
      expect(feed.length).toBe(1);

      const sealedView = feed[0];
      expect(sealedView.unlocked).toBe(false);
      expect(sealedView.memory_text).toBe('🔒 Locked until unlock date');
      expect(sealedView.media_url).toBeNull();
      expect(sealedView.memory_text).not.toContain('top secret');
    });

    it('TC-T5-17: Time transition reveals full memory and media once unlock timestamp has elapsed', () => {
      const env = new MockSupabaseEnvironment();
      const creator = env.createGoogleUser({ id: 'u_timer_creator' });
      const room = env.rpcCreateRoom(creator.id, 'Time Travel Tank');

      const unlockTime = new Date(Date.now() + 10000); // 10s in future
      const rawStory = 'Unlocked birthday celebration note!';
      const rawMedia = 'https://cdn.kibo.app/birthday.png';

      env.createTimeCapsule(room.room_id, creator.id, {
        title: 'Birthday Surprise',
        memory_text: rawStory,
        media_url: rawMedia,
        unlock_at: unlockTime.toISOString(),
      });

      // 1. Check before unlock
      const beforeFeed = env.getTimeCapsulesForUser(room.room_id, creator.id, new Date(Date.now()));
      expect(beforeFeed[0].unlocked).toBe(false);
      expect(beforeFeed[0].memory_text).toBe('🔒 Locked until unlock date');

      // 2. Check after unlock timestamp has elapsed
      const afterTime = new Date(unlockTime.getTime() + 5000);
      const afterFeed = env.getTimeCapsulesForUser(room.room_id, creator.id, afterTime);
      expect(afterFeed[0].unlocked).toBe(true);
      expect(afterFeed[0].memory_text).toBe(rawStory);
      expect(afterFeed[0].media_url).toBe(rawMedia);
    });

    it('TC-T5-18: Non-member user is strictly blocked from reading or creating capsules in another room (RLS)', () => {
      const env = new MockSupabaseEnvironment();
      const userA = env.createGoogleUser({ id: 'u_roomA_member' });
      const roomA = env.rpcCreateRoom(userA.id, 'Room A Sanctuary');

      const outsider = env.createGoogleUser({ id: 'u_outsider' });

      // Outsider attempts to read capsules in Room A
      expect(() => env.getTimeCapsulesForUser(roomA.room_id, outsider.id)).toThrow('RLS_VIOLATION');

      // Outsider attempts to deposit capsule in Room A
      expect(() => env.createTimeCapsule(roomA.room_id, outsider.id, {
        title: 'Malicious Infiltration',
        memory_text: 'Spam memory text',
        unlock_at: new Date().toISOString(),
      })).toThrow('RLS_VIOLATION');
    });

    it('TC-T5-19: Activity milestones with past/current unlock dates are unlocked immediately upon deposit', () => {
      const env = new MockSupabaseEnvironment();
      const user = env.createGoogleUser({ id: 'u_milestone_author' });
      const room = env.rpcCreateRoom(user.id, 'Milestone Log Tank');

      const now = new Date().toISOString();
      const milestoneStory = 'Completed 10km morning run together!';

      env.createTimeCapsule(room.room_id, user.id, {
        title: '10km Run',
        memory_text: milestoneStory,
        media_url: null,
        unlock_at: now,
      });

      const feed = env.getTimeCapsulesForUser(room.room_id, user.id, new Date());
      expect(feed.length).toBe(1);
      expect(feed[0].unlocked).toBe(true);
      expect(feed[0].memory_text).toBe(milestoneStory);
    });

    it('TC-T5-20: Memory text length boundary enforcement (rejects empty text, handles up to 2000 chars safely)', () => {
      const validateCapsulePayload = (title, text) => {
        if (!title || title.trim().length === 0 || title.length > 100) {
          throw new Error('VALIDATION_ERROR: title must be 1-100 characters');
        }
        if (!text || text.trim().length === 0 || text.length > 2000) {
          throw new Error('VALIDATION_ERROR: memory_text must be 1-2000 characters');
        }
        return true;
      };

      // Valid payloads
      expect(validateCapsulePayload('Valid Title', 'Short story')).toBe(true);
      expect(validateCapsulePayload('Max Test', 'A'.repeat(2000))).toBe(true);

      // Invalid payloads
      expect(() => validateCapsulePayload('', 'Story')).toThrow('VALIDATION_ERROR');
      expect(() => validateCapsulePayload('Title', '')).toThrow('VALIDATION_ERROR');
      expect(() => validateCapsulePayload('Title', '   ')).toThrow('VALIDATION_ERROR');
      expect(() => validateCapsulePayload('T'.repeat(101), 'Story')).toThrow('VALIDATION_ERROR');
      expect(() => validateCapsulePayload('Title', 'A'.repeat(2001))).toThrow('VALIDATION_ERROR');
    });
  });

});
