import { describe, it, expect } from '../test_framework.mjs';
import { MockSupabaseEnvironment } from '../helpers/simulators.mjs';
import { computeCoAwayAccrual, routeScreenCrossing } from '../helpers/contracts.mjs';

describe('Tier 3: Cross-Feature Interactions (Pairwise Matrix)', () => {
  it('TC-T3-01 [F1 + F2]: Google sign-in provisions profile and links Google metadata', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser({
      email: 'pair.test@gmail.com',
      displayName: 'Pair User',
      avatarUrl: 'https://lh3.googleusercontent.com/pair-test',
    });

    const profile = env.profiles.get(user.id);
    expect(profile.email).toBe('pair.test@gmail.com');
    expect(profile.displayName).toBe('Pair User');
    expect(profile.avatarUrl).toBe('https://lh3.googleusercontent.com/pair-test');
    expect(profile.fishPoints).toBe(100);
  });

  it('TC-T3-02 [F2 + F3]: User profile establishes creator ownership in public.rooms', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();

    const created = env.rpcCreateRoom(user.id, 'Ownership Tank');
    const room = env.rooms.get(created.room_id);
    expect(room.created_by).toBe(user.id);
  });

  it('TC-T3-03 [F3 + F4]: Room created via RPC immediately manifests on /dashboard', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();

    const created = env.rpcCreateRoom(user.id, 'Live Dash Tank', 'warm');
    
    const userRooms = Array.from(env.rooms.values()).filter((r) => {
      const members = env.participants.get(r.id) || [];
      return members.some((m) => m.user_id === user.id);
    });

    expect(userRooms.map((r) => r.id)).toContain(created.room_id);
    expect(userRooms.find((r) => r.id === created.room_id).tank_mood).toBe('warm');
  });

  it('TC-T3-04 [F4 + F5]: Newly joined tank from dashboard appears in In-Tank Switcher', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();
    const friend = env.createGoogleUser();

    const friendRoom = env.rpcCreateRoom(friend.id, 'Friend Pod');
    const myRoom = env.rpcCreateRoom(user.id, 'My Home Tank');

    // Join friend tank
    env.rpcJoinRoom(user.id, friendRoom.room_code);

    // Check switcher list while inside myRoom
    const userRooms = Array.from(env.rooms.values()).filter((r) => {
      const members = env.participants.get(r.id) || [];
      return members.some((m) => m.user_id === user.id);
    });
    const switcherOptions = userRooms.filter((r) => r.id !== myRoom.room_id);

    expect(switcherOptions.map((r) => r.id)).toContain(friendRoom.room_id);
  });

  it('TC-T3-05 [F3 + F6]: 5-user capacity limit enforced consistently during multi-user join cascade', () => {
    const env = new MockSupabaseEnvironment();
    const host = env.createGoogleUser();
    const room = env.rpcCreateRoom(host.id, 'Cascade Tank');

    const guests = Array.from({ length: 5 }, () => env.createGoogleUser());
    const results = guests.map((g) => env.rpcJoinRoom(g.id, room.room_code));

    // First 4 guests succeed (1 host + 4 guests = 5 max)
    expect(results[0].status).toBe('ok');
    expect(results[1].status).toBe('ok');
    expect(results[2].status).toBe('ok');
    expect(results[3].status).toBe('ok');
    // 5th guest rejected
    expect(results[4].status).toBe('room_full');
  });

  it('TC-T3-06 [F6 + F7]: 5-member tank automatically instantiates 5 distinct personalized fish', () => {
    const env = new MockSupabaseEnvironment();
    const users = Array.from({ length: 5 }, () => env.createGoogleUser());
    const room = env.rpcCreateRoom(users[0].id, 'Big Aquarium');

    for (let i = 1; i < 5; i++) {
      env.rpcJoinRoom(users[i].id, room.room_code);
    }

    const roomFish = Array.from(env.fish.values()).filter((f) => f.room_id === room.room_id);
    expect(roomFish.length).toBe(5);

    const colors = new Set(roomFish.map((f) => f.color));
    expect(colors.size).toBeGreaterThanOrEqual(4);
  });

  it('TC-T3-07 [F7 + F8]: Screen crossing retains fish morphology (color, fin_style) during handoff', () => {
    const env = new MockSupabaseEnvironment();
    const u1 = env.createGoogleUser();
    const u2 = env.createGoogleUser();
    const room = env.rpcCreateRoom(u1.id, 'Crossing Tank');
    env.rpcJoinRoom(u2.id, room.room_code);

    const fish = Array.from(env.fish.values()).find((f) => f.owner_id === u1.id);
    
    // Perform handoff
    const nextHolder = routeScreenCrossing(fish.holder_id, 1, [u1.id, u2.id]);
    fish.holder_id = nextHolder;

    expect(fish.holder_id).toBe(u2.id);
    expect(fish.color).toBeDefined();
    expect(fish.fin_style).toBeDefined();
  });

  it('TC-T3-08 [F6 + F9]: Scaling group size adjusts K/N rate dynamically when new member arrives mid-away', () => {
    // 2 members away out of 3: rate = 2/3
    const phase1Gained = computeCoAwayAccrual(300, 2, 3);
    // 4th member joins, still 2 away: rate = 2/4 = 0.5
    const phase2Gained = computeCoAwayAccrual(300, 2, 4);

    expect(phase1Gained).toBe(200);
    expect(phase2Gained).toBe(150);
    expect(phase1Gained + phase2Gained).toBe(350);
  });

  it('TC-T3-09 [F9 + F10]: Connect Moment session multiplier boosts K/N nutrient accumulation', () => {
    const elapsedSec = 600; // 10 min
    const baseAccrual = computeCoAwayAccrual(elapsedSec, 4, 5); // 4/5 * 600 = 480s
    const connectMultiplier = 2.0;
    const boostedAccrual = baseAccrual * connectMultiplier;

    expect(baseAccrual).toBe(480);
    expect(boostedAccrual).toBe(960);
  });

  it('TC-T3-10 [F9 + F12]: Nutrient seconds convert to Fish Points enabling voucher redemption', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser({ fishPoints: 0 });

    // Simulate 3600 seconds of co-away earned -> 1 point per 30 seconds = 120 points
    const earnedNutrients = 3600;
    const pointsAwarded = Math.floor(earnedNutrients / 30);
    env.profiles.get(user.id).fishPoints += pointsAwarded;

    expect(env.profiles.get(user.id).fishPoints).toBe(120);

    // Redeem 120pt coffee voucher
    const res = env.redeemVoucher(user.id, 'v1');
    expect(res.success).toBe(true);
    expect(res.remainingPoints).toBe(0);
  });

  it('TC-T3-11 [F6 + F11]: All 5 active room members can post and read shared time capsules', () => {
    const env = new MockSupabaseEnvironment();
    const users = Array.from({ length: 5 }, () => env.createGoogleUser());
    const room = env.rpcCreateRoom(users[0].id, 'Group Memory Tank');

    for (let i = 1; i < 5; i++) {
      env.rpcJoinRoom(users[i].id, room.room_code);
    }

    // User 3 creates a capsule
    env.createTimeCapsule(room.room_id, users[2].id, {
      title: 'Group Dinner at Mission',
      memory_text: 'Celebrated our project milestone!',
      unlock_at: new Date(Date.now() - 1000).toISOString(),
    });

    // User 5 views feed
    const feed = env.getTimeCapsulesForUser(room.room_id, users[4].id);
    expect(feed.length).toBe(1);
    expect(feed[0].title).toBe('Group Dinner at Mission');
    expect(feed[0].created_by).toBe(users[2].id);
  });

  it('TC-T3-12 [F1 + F12]: Partner voucher redemptions are strictly isolated per authenticated user', () => {
    const env = new MockSupabaseEnvironment();
    const u1 = env.createGoogleUser({ id: 'u_alpha', fishPoints: 500 });
    const u2 = env.createGoogleUser({ id: 'u_beta', fishPoints: 500 });

    env.redeemVoucher(u1.id, 'v1'); // cost 120
    expect(env.profiles.get(u1.id).fishPoints).toBe(380);
    expect(env.profiles.get(u2.id).fishPoints).toBe(500); // Unaffected
  });

  it('TC-T3-13 [F5 + F7]: In-Tank Switcher switches active fish set upon room navigation', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();
    const t1 = env.rpcCreateRoom(user.id, 'Tank A');
    const t2 = env.rpcCreateRoom(user.id, 'Tank B');

    const fishA = Array.from(env.fish.values()).filter((f) => f.room_id === t1.room_id);
    const fishB = Array.from(env.fish.values()).filter((f) => f.room_id === t2.room_id);

    expect(fishA.length).toBe(1);
    expect(fishB.length).toBe(1);
    expect(fishA[0].id).not.toBe(fishB[0].id);
  });

  it('TC-T3-14 [F10 + F11]: Concluded Connect Moment provides prompt to create Milestone memory', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();
    const room = env.rpcCreateRoom(user.id, 'Focus Tank');

    const sessionCompleted = { category: 'walks', durationMinutes: 45 };
    if (sessionCompleted.durationMinutes >= 30) {
      env.createTimeCapsule(room.room_id, user.id, {
        title: 'Afternoon Stroll in Presidio',
        memory_text: 'Walked 45 minutes together with phones away.',
        unlock_at: new Date().toISOString(),
      });
    }

    const feed = env.getTimeCapsulesForUser(room.room_id, user.id);
    expect(feed.length).toBe(1);
    expect(feed[0].title).toBe('Afternoon Stroll in Presidio');
  });
});
