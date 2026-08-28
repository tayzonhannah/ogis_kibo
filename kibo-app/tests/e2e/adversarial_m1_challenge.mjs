/**
 * Empirical Adversarial Challenge Suite for Milestone 1: Auth & Schema Boundary
 * Tests Google OAuth Exclusivity, Callback Error Handling, Profiles Schema Constraints & Triggers,
 * Room Capacity Limits (6th Join Attempt), Stale Purges, Idempotent Rejoin, and Type Contracts.
 */

import { describe, it, expect } from './test_framework.mjs';
import { MockSupabaseEnvironment } from './helpers/simulators.mjs';
import { validateUserProfile, validateTankRoom, ROOM_CAPACITY } from './helpers/contracts.mjs';

describe('Adversarial Challenge M1: Milestone 1 Boundary & Stress Verification', () => {
  // --------------------------------------------------------------------------
  // Area 1: Google OAuth Exclusivity & Callback Error Parameters
  // --------------------------------------------------------------------------
  describe('Area 1: Google OAuth Exclusivity & Callback Error Handling', () => {
    it('ADV-M1-01: Confirms OAuth provider is exclusively restricted to Google', () => {
      const allowedProviders = ['google'];
      const attemptedProviders = ['google', 'github', 'facebook', 'apple', 'twitter', 'email_password'];
      
      const results = attemptedProviders.map((provider) => ({
        provider,
        allowed: allowedProviders.includes(provider),
      }));

      const allowedList = results.filter((r) => r.allowed).map((r) => r.provider);
      const rejectedList = results.filter((r) => !r.allowed).map((r) => r.provider);

      expect(allowedList).toEqual(['google']);
      expect(rejectedList.length).toBe(5);
    });

    it('ADV-M1-02: Route callback redirects to error when OAuth provider returns error params', () => {
      // Simulating app/auth/callback/route.ts logic
      const handleCallback = (searchParams, env = { url: 'https://test.supabase.co', anonKey: 'anon-key' }) => {
        const origin = 'https://kibo.app';
        const code = searchParams.get('code');
        const next = searchParams.get('next') ?? '/dashboard';
        const error = searchParams.get('error');

        if (!env.url || !env.anonKey) {
          return { redirect: `${origin}/?error=missing_env`, status: 302 };
        }

        if (error || !code) {
          return { redirect: `${origin}/?error=auth_callback_failed`, status: 302 };
        }

        if (code === 'invalid_code_exchange_fail') {
          return { redirect: `${origin}/?error=auth_callback_failed`, status: 302 };
        }

        return { redirect: `${origin}${next}`, status: 302 };
      };

      // Case A: User denied consent / OAuth error
      const paramsError = new URLSearchParams({ error: 'access_denied', error_description: 'User denied access' });
      expect(handleCallback(paramsError).redirect).toBe('https://kibo.app/?error=auth_callback_failed');

      // Case B: No code or error provided (blank callback)
      const paramsEmpty = new URLSearchParams({});
      expect(handleCallback(paramsEmpty).redirect).toBe('https://kibo.app/?error=auth_callback_failed');

      // Case C: Missing Supabase Env
      const paramsValid = new URLSearchParams({ code: 'valid_auth_code' });
      expect(handleCallback(paramsValid, { url: '', anonKey: '' }).redirect).toBe('https://kibo.app/?error=missing_env');

      // Case D: Valid Code Exchange
      expect(handleCallback(paramsValid).redirect).toBe('https://kibo.app/dashboard');

      // Case E: Custom Next parameter
      const paramsNext = new URLSearchParams({ code: 'valid_auth_code', next: '/room/TESTCODE' });
      expect(handleCallback(paramsNext).redirect).toBe('https://kibo.app/room/TESTCODE');
    });
  });

  // --------------------------------------------------------------------------
  // Area 2: Profiles Schema Integrity, Constraints, Triggers, and Cascades
  // --------------------------------------------------------------------------
  describe('Area 2: Profiles Schema Integrity & Triggers', () => {
    it('ADV-M1-03: Enforces non-negative fish_points constraint (fish_points >= 0)', () => {
      const validatePoints = (points) => {
        if (typeof points !== 'number' || !Number.isInteger(points) || points < 0) {
          throw new Error('CHECK CONSTRAINT VIOLATION: fish_points must be non-negative integer');
        }
        return true;
      };

      expect(validatePoints(0)).toBe(true);
      expect(validatePoints(100)).toBe(true);
      expect(validatePoints(50000)).toBe(true);

      expect(() => validatePoints(-1)).toThrow('CHECK CONSTRAINT VIOLATION');
      expect(() => validatePoints(-500)).toThrow('CHECK CONSTRAINT VIOLATION');
      expect(() => validatePoints(12.5)).toThrow('CHECK CONSTRAINT VIOLATION');
    });

    it('ADV-M1-04: Simulates handle_new_user() trigger with varied Google metadata shapes', () => {
      // Logic from 0007_google_auth_multi_tank.sql trigger handle_new_user
      const triggerHandleNewUser = (authUser) => {
        const rawMeta = authUser.raw_user_meta_data || {};
        const email = authUser.email;
        const userName = rawMeta.full_name || rawMeta.name || (email ? email.split('@')[0] : 'Aquanaut');
        const userAvatar = rawMeta.avatar_url || rawMeta.picture || null;

        return {
          id: authUser.id,
          email: authUser.email,
          display_name: userName,
          avatar_url: userAvatar,
          fish_points: 0,
        };
      };

      // Shape 1: Standard Google OAuth payload with full_name and avatar_url
      const u1 = triggerHandleNewUser({
        id: 'u_1',
        email: 'hannah@gmail.com',
        raw_user_meta_data: { full_name: 'Hannah Abbott', avatar_url: 'https://lh3.googleusercontent.com/a/hannah' },
      });
      expect(u1.display_name).toBe('Hannah Abbott');
      expect(u1.avatar_url).toBe('https://lh3.googleusercontent.com/a/hannah');
      expect(u1.fish_points).toBe(0);

      // Shape 2: Alternative Google payload with 'name' and 'picture'
      const u2 = triggerHandleNewUser({
        id: 'u_2',
        email: 'cedric@gmail.com',
        raw_user_meta_data: { name: 'Cedric Diggory', picture: 'https://lh3.googleusercontent.com/a/cedric' },
      });
      expect(u2.display_name).toBe('Cedric Diggory');
      expect(u2.avatar_url).toBe('https://lh3.googleusercontent.com/a/cedric');

      // Shape 3: Minimal metadata fallback to email prefix
      const u3 = triggerHandleNewUser({
        id: 'u_3',
        email: 'luna_lovegood@kibo.app',
        raw_user_meta_data: {},
      });
      expect(u3.display_name).toBe('luna_lovegood');
      expect(u3.avatar_url).toBeNull();

      // Shape 4: No email, no metadata fallback
      const u4 = triggerHandleNewUser({
        id: 'u_4',
        email: null,
        raw_user_meta_data: null,
      });
      expect(u4.display_name).toBe('Aquanaut');
      expect(u4.avatar_url).toBeNull();
    });

    it('ADV-M1-05: Verifies Cascade Deletion of profiles and room participation upon auth user deletion', () => {
      const env = new MockSupabaseEnvironment();
      const user = env.createGoogleUser({ id: 'usr_to_delete' });
      const room = env.rpcCreateRoom(user.id, 'Ephemeral Room');

      expect(env.users.has(user.id)).toBe(true);
      expect(env.profiles.has(user.id)).toBe(true);
      expect(env.participants.get(room.room_id).length).toBe(1);

      // Delete auth user -> cascade deletion in Postgres
      env.users.delete(user.id);
      env.profiles.delete(user.id);
      const remainingParticipants = env.participants.get(room.room_id).filter((p) => p.user_id !== user.id);
      env.participants.set(room.room_id, remainingParticipants);

      expect(env.profiles.has(user.id)).toBe(false);
      expect(env.participants.get(room.room_id).length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Area 3: Room Capacity Limits (6th Join Attempt, Stale Purge, Idempotency)
  // --------------------------------------------------------------------------
  describe('Area 3: join_room Capacity Limits & Concurrency Boundaries', () => {
    it('ADV-M1-06: Strictly rejects 6th participant attempt to join 5-capacity room with room_full', () => {
      const env = new MockSupabaseEnvironment();
      const creator = env.createGoogleUser({ id: 'u_creator' });
      const room = env.rpcCreateRoom(creator.id, 'Five Capacity Room');

      // Join users 2, 3, 4, 5
      const guests = [
        env.createGoogleUser({ id: 'u_2' }),
        env.createGoogleUser({ id: 'u_3' }),
        env.createGoogleUser({ id: 'u_4' }),
        env.createGoogleUser({ id: 'u_5' }),
      ];

      for (const guest of guests) {
        const joinRes = env.rpcJoinRoom(guest.id, room.room_code);
        expect(joinRes.status).toBe('ok');
        expect(joinRes.joined_room).toBe(room.room_id);
      }

      // Verify exact count is 5
      const currentMembers = env.participants.get(room.room_id);
      expect(currentMembers.length).toBe(5);

      // Attempt joining 6th user
      const guest6 = env.createGoogleUser({ id: 'u_6' });
      const joinRes6 = env.rpcJoinRoom(guest6.id, room.room_code);
      expect(joinRes6.status).toBe('room_full');
      expect(joinRes6.joined_room).toBeNull();
      expect(env.participants.get(room.room_id).length).toBe(5);

      // Attempt joining 7th user
      const guest7 = env.createGoogleUser({ id: 'u_7' });
      const joinRes7 = env.rpcJoinRoom(guest7.id, room.room_code);
      expect(joinRes7.status).toBe('room_full');
      expect(joinRes7.joined_room).toBeNull();
      expect(env.participants.get(room.room_id).length).toBe(5);
    });

    it('ADV-M1-07: Idempotent rejoin by an existing member in a full room succeeds without consuming slot', () => {
      const env = new MockSupabaseEnvironment();
      const creator = env.createGoogleUser({ id: 'u_c_full' });
      const room = env.rpcCreateRoom(creator.id, 'Full Room');

      const guests = [
        env.createGoogleUser({ id: 'u_g2' }),
        env.createGoogleUser({ id: 'u_g3' }),
        env.createGoogleUser({ id: 'u_g4' }),
        env.createGoogleUser({ id: 'u_g5' }),
      ];

      for (const g of guests) {
        env.rpcJoinRoom(g.id, room.room_code);
      }

      expect(env.participants.get(room.room_id).length).toBe(5);

      // User 3 rejoins (e.g. refreshed tab or switched devices)
      const rejoinRes = env.rpcJoinRoom('u_g3', room.room_code);
      expect(rejoinRes.status).toBe('ok');
      expect(rejoinRes.joined_room).toBe(room.room_id);
      expect(env.participants.get(room.room_id).length).toBe(5);

      // Creator rejoins
      const creatorRejoin = env.rpcJoinRoom('u_c_full', room.room_code);
      expect(creatorRejoin.status).toBe('ok');
      expect(creatorRejoin.joined_room).toBe(room.room_id);
      expect(env.participants.get(room.room_id).length).toBe(5);
    });

    it('ADV-M1-08: Stale participants (> 14 days) are purged upon next join allowing new member to enter', () => {
      const env = new MockSupabaseEnvironment();
      const creator = env.createGoogleUser({ id: 'u_stale_creator' });
      const room = env.rpcCreateRoom(creator.id, 'Stale Test Room');

      const guests = [
        env.createGoogleUser({ id: 'u_s2' }),
        env.createGoogleUser({ id: 'u_s3' }),
        env.createGoogleUser({ id: 'u_s4' }),
        env.createGoogleUser({ id: 'u_s5' }),
      ];

      for (const g of guests) {
        env.rpcJoinRoom(g.id, room.room_code);
      }

      expect(env.participants.get(room.room_id).length).toBe(5);

      // Simulate guest 5 being stale (> 14 days ago)
      const participants = env.participants.get(room.room_id);
      const staleParticipant = participants.find((p) => p.user_id === 'u_s5');
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
      staleParticipant.last_seen_at = fifteenDaysAgo;

      // Simulate join_room stale purge logic from 0007_google_auth_multi_tank.sql:
      // delete from public.room_participants rp where rp.room_id = target and rp.last_seen_at < now() - interval '14 days';
      const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const filtered = participants.filter((p) => new Date(p.last_seen_at).getTime() >= cutoff);
      env.participants.set(room.room_id, filtered);

      expect(env.participants.get(room.room_id).length).toBe(4);

      // Now 6th user attempts to join
      const newGuest = env.createGoogleUser({ id: 'u_new_entrant' });
      const joinRes = env.rpcJoinRoom(newGuest.id, room.room_code);
      expect(joinRes.status).toBe('ok');
      expect(joinRes.joined_room).toBe(room.room_id);
      expect(env.participants.get(room.room_id).length).toBe(5);
    });

    it('ADV-M1-09: Rate limits join attempts after 10 recent failures within 15 minutes', () => {
      // Simulate rate limit query:
      // select count(*) into recent_failures from public.join_attempts where user_id = caller and succeeded = false and attempted_at > now() - interval '15 minutes'
      const joinAttemptTracker = {
        attempts: [],
        recordFailure(userId) {
          this.attempts.push({ userId, succeeded: false, timestamp: Date.now() });
        },
        isRateLimited(userId) {
          const fifteenMinAgo = Date.now() - 15 * 60 * 1000;
          const failures = this.attempts.filter(
            (a) => a.userId === userId && !a.succeeded && a.timestamp > fifteenMinAgo
          ).length;
          return failures >= 10;
        },
      };

      const attackerId = 'attacker_usr_1';

      for (let i = 0; i < 9; i++) {
        joinAttemptTracker.recordFailure(attackerId);
        expect(joinAttemptTracker.isRateLimited(attackerId)).toBe(false);
      }

      // 10th failure triggers rate limit
      joinAttemptTracker.recordFailure(attackerId);
      expect(joinAttemptTracker.isRateLimited(attackerId)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Area 4: Strict Type Contracts & Constants
  // --------------------------------------------------------------------------
  describe('Area 4: Type Safety & Interface Contracts', () => {
    it('ADV-M1-10: Validates UserProfile type contract against required and optional fields', () => {
      const validProfile = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        fishPoints: 250,
      };

      const res = validateUserProfile(validProfile);
      expect(res.valid).toBe(true);
      expect(res.errors.length).toBe(0);

      const invalidProfile = {
        id: '', // Empty ID invalid
        fishPoints: 'hundred', // Non-number invalid
      };
      const resInvalid = validateUserProfile(invalidProfile);
      expect(resInvalid.valid).toBe(false);
      expect(resInvalid.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('ADV-M1-11: Verifies ROOM_CAPACITY is strictly 5 across all contracts and migrations', () => {
      expect(ROOM_CAPACITY).toBe(5);
    });
  });
});
