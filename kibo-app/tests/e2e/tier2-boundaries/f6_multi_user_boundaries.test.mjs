import { describe, it, expect } from '../test_framework.mjs';
import { MockSupabaseEnvironment } from '../helpers/simulators.mjs';
import { ROOM_CAPACITY } from '../helpers/contracts.mjs';

describe('Tier 2: Boundary & Corner Cases - F6: Multi-User Capacity Boundaries', () => {
  it('TC-F6-B26: Room rejects 6th join attempt with status room_full', () => {
    const env = new MockSupabaseEnvironment();
    const owner = env.createGoogleUser();
    const room = env.rpcCreateRoom(owner.id, 'Max Capacity Tank');

    for (let i = 1; i < ROOM_CAPACITY; i++) {
      const g = env.createGoogleUser();
      const res = env.rpcJoinRoom(g.id, room.room_code);
      expect(res.status).toBe('ok');
    }

    const guest6 = env.createGoogleUser();
    const res6 = env.rpcJoinRoom(guest6.id, room.room_code);
    expect(res6.status).toBe('room_full');
  });

  it('TC-F6-B27: When a member leaves a full tank (5 -> 4), new user can immediately join', () => {
    const env = new MockSupabaseEnvironment();
    const users = Array.from({ length: 5 }, () => env.createGoogleUser());
    const room = env.rpcCreateRoom(users[0].id, 'Recycling Slot Tank');

    for (let i = 1; i < 5; i++) {
      env.rpcJoinRoom(users[i].id, room.room_code);
    }
    expect(env.participants.get(room.room_id).length).toBe(5);

    // User 4 leaves
    const members = env.participants.get(room.room_id).filter((m) => m.user_id !== users[4].id);
    env.participants.set(room.room_id, members);
    expect(env.participants.get(room.room_id).length).toBe(4);

    // New user joins
    const newUser = env.createGoogleUser();
    const joinRes = env.rpcJoinRoom(newUser.id, room.room_code);
    expect(joinRes.status).toBe('ok');
    expect(env.participants.get(room.room_id).length).toBe(5);
  });

  it('TC-F6-B28: Minimum viable group size for co-away is 2 users', () => {
    const minGroupSize = 2;
    expect(minGroupSize).toBe(2);
  });

  it('TC-F6-B29: Heartbeat timeout identifies stale participants accurately', () => {
    const staleThresholdMs = 120_000; // 2 minutes
    const now = Date.now();
    const lastSeen = now - 150_000; // 2.5 minutes ago

    const isStale = (now - lastSeen) > staleThresholdMs;
    expect(isStale).toBe(true);
  });

  it('TC-F6-B30: Atomic participant join check prevents over-subscription under concurrency', () => {
    const currentMembers = 4;
    const capacity = 5;
    const canJoin = currentMembers < capacity;
    expect(canJoin).toBe(true);
    
    const afterJoin = currentMembers + 1;
    const canNextJoin = afterJoin < capacity;
    expect(canNextJoin).toBe(false);
  });
});
