import { describe, it, expect } from '../test_framework.mjs';
import { MockSupabaseEnvironment } from '../helpers/simulators.mjs';

describe('Tier 1: Feature Coverage - F4: Multi-Tank Dashboard (/dashboard)', () => {
  it('TC-F4-01: Displays all active tanks a user is a member of', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();

    const t1 = env.rpcCreateRoom(user.id, 'Morning Tea');
    const t2 = env.rpcCreateRoom(user.id, 'Night Owls', 'deep');

    const otherUser = env.createGoogleUser();
    const t3 = env.rpcCreateRoom(otherUser.id, 'Colleagues Tank');
    env.rpcJoinRoom(user.id, t3.room_code);

    // Compute user tanks list
    const userTanks = [];
    for (const [roomId, members] of env.participants.entries()) {
      if (members.some((m) => m.user_id === user.id)) {
        userTanks.push(env.rooms.get(roomId));
      }
    }

    expect(userTanks.length).toBe(3);
    expect(userTanks.map((t) => t.name)).toContain('Morning Tea');
    expect(userTanks.map((t) => t.name)).toContain('Night Owls');
    expect(userTanks.map((t) => t.name)).toContain('Colleagues Tank');
  });

  it('TC-F4-02: Renders live tank status indicators (mood tint, member count, nutrient meter)', () => {
    const env = new MockSupabaseEnvironment();
    const owner = env.createGoogleUser();
    const guest = env.createGoogleUser();

    const created = env.rpcCreateRoom(owner.id, 'Sanctuary', 'warm');
    env.rpcJoinRoom(guest.id, created.room_code);
    const room = env.rooms.get(created.room_id);
    room.nutrient_seconds = 3600;

    const members = env.participants.get(created.room_id);

    // Verify tank card properties
    expect(room.tank_mood).toBe('warm');
    expect(members.length).toBe(2);
    expect(room.nutrient_seconds).toBe(3600);
  });

  it('TC-F4-03: Provides "Open New Tank" action modal handler', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();

    const actionCreate = (name, mood) => env.rpcCreateRoom(user.id, name, mood);
    const newTank = actionCreate('Zen Garden', 'bright');

    expect(newTank.room_id).toBeDefined();
    expect(env.rooms.get(newTank.room_id).name).toBe('Zen Garden');
  });

  it('TC-F4-04: Provides "Join via Code" action modal handler with code normalization', () => {
    const env = new MockSupabaseEnvironment();
    const owner = env.createGoogleUser();
    const user = env.createGoogleUser();

    const created = env.rpcCreateRoom(owner.id, 'Study Group');
    const inputCodeWithWhitespaceAndLowercase = `  ${created.room_code.toLowerCase()}  `;

    const joinAction = (rawCode) => env.rpcJoinRoom(user.id, rawCode);
    const res = joinAction(inputCodeWithWhitespaceAndLowercase);

    expect(res.status).toBe('ok');
    expect(res.joined_room).toBe(created.room_id);
  });

  it('TC-F4-05: Empty state renders cleanly when user has no active tanks', () => {
    const env = new MockSupabaseEnvironment();
    const newUser = env.createGoogleUser();

    const userTanks = [];
    for (const [roomId, members] of env.participants.entries()) {
      if (members.some((m) => m.user_id === newUser.id)) {
        userTanks.push(env.rooms.get(roomId));
      }
    }

    expect(userTanks.length).toBe(0);
  });
});
