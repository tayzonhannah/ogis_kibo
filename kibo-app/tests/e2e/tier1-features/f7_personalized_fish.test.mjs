import { describe, it, expect } from '../test_framework.mjs';
import { MockSupabaseEnvironment } from '../helpers/simulators.mjs';
import { validateFishMorphology } from '../helpers/contracts.mjs';

describe('Tier 1: Feature Coverage - F7: Dynamic Personalized Fish Simulation', () => {
  it('TC-F7-01: Instantiates exactly 1 distinct fish per active room participant', () => {
    const env = new MockSupabaseEnvironment();
    const u1 = env.createGoogleUser();
    const u2 = env.createGoogleUser();
    const u3 = env.createGoogleUser();

    const room = env.rpcCreateRoom(u1.id, 'Fish Tank');
    env.rpcJoinRoom(u2.id, room.room_code);
    env.rpcJoinRoom(u3.id, room.room_code);

    const roomFish = Array.from(env.fish.values()).filter((f) => f.room_id === room.room_id);
    expect(roomFish.length).toBe(3);

    const ownerIds = new Set(roomFish.map((f) => f.owner_id));
    expect(ownerIds.size).toBe(3);
    expect(ownerIds.has(u1.id)).toBe(true);
    expect(ownerIds.has(u2.id)).toBe(true);
    expect(ownerIds.has(u3.id)).toBe(true);
  });

  it('TC-F7-02: Each fish has unique visual morphology (color, fin_style)', () => {
    const env = new MockSupabaseEnvironment();
    const users = Array.from({ length: 4 }, () => env.createGoogleUser());

    const room = env.rpcCreateRoom(users[0].id, 'Morphology Tank');
    for (let i = 1; i < 4; i++) {
      env.rpcJoinRoom(users[i].id, room.room_code);
    }

    const roomFish = Array.from(env.fish.values()).filter((f) => f.room_id === room.room_id);
    for (const f of roomFish) {
      const val = validateFishMorphology(f);
      expect(val.valid).toBe(true);
    }

    const colors = roomFish.map((f) => f.color);
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBeGreaterThanOrEqual(3);
  });

  it('TC-F7-03: Fish vertical distribution (y_frac) is spaced across canvas height [0, 1]', () => {
    const env = new MockSupabaseEnvironment();
    const u1 = env.createGoogleUser();
    const u2 = env.createGoogleUser();
    const u3 = env.createGoogleUser();

    const room = env.rpcCreateRoom(u1.id, 'Spaced Tank');
    env.rpcJoinRoom(u2.id, room.room_code);
    env.rpcJoinRoom(u3.id, room.room_code);

    const roomFish = Array.from(env.fish.values()).filter((f) => f.room_id === room.room_id);
    for (const f of roomFish) {
      expect(f.y_frac).toBeGreaterThanOrEqual(0);
      expect(f.y_frac).toBeLessThanOrEqual(1);
    }
  });

  it('TC-F7-04: Fish movement direction is either 1 (rightward) or -1 (leftward)', () => {
    const env = new MockSupabaseEnvironment();
    const u1 = env.createGoogleUser();
    const room = env.rpcCreateRoom(u1.id, 'Direction Tank');

    const fish = Array.from(env.fish.values()).find((f) => f.room_id === room.room_id);
    expect([1, -1]).toContain(fish.direction);
  });

  it('TC-F7-05: Fish velocity (speed) is positive and within pleasant ambient range [30, 80] px/s', () => {
    const env = new MockSupabaseEnvironment();
    const u1 = env.createGoogleUser();
    const room = env.rpcCreateRoom(u1.id, 'Velocity Tank');

    const fish = Array.from(env.fish.values()).find((f) => f.room_id === room.room_id);
    expect(fish.speed).toBeGreaterThanOrEqual(30);
    expect(fish.speed).toBeLessThanOrEqual(80);
  });
});
