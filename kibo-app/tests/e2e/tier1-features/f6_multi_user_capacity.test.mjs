import { describe, it, expect } from '../test_framework.mjs';
import { MockSupabaseEnvironment } from '../helpers/simulators.mjs';
import { ROOM_CAPACITY } from '../helpers/contracts.mjs';

describe('Tier 1: Feature Coverage - F6: Multi-User Capacity (3–5 Members)', () => {
  it('TC-F6-01: Verifies system constant ROOM_CAPACITY is set to 5', () => {
    expect(ROOM_CAPACITY).toBe(5);
  });

  it('TC-F6-02: Supports 3 concurrent participants in a single tank with synchronized state', () => {
    const env = new MockSupabaseEnvironment();
    const u1 = env.createGoogleUser();
    const u2 = env.createGoogleUser();
    const u3 = env.createGoogleUser();

    const room = env.rpcCreateRoom(u1.id, 'Trio Pod');
    env.rpcJoinRoom(u2.id, room.room_code);
    env.rpcJoinRoom(u3.id, room.room_code);

    const members = env.participants.get(room.room_id);
    expect(members.length).toBe(3);
  });

  it('TC-F6-03: Supports 4 concurrent participants in a single tank with synchronized state', () => {
    const env = new MockSupabaseEnvironment();
    const users = [env.createGoogleUser(), env.createGoogleUser(), env.createGoogleUser(), env.createGoogleUser()];

    const room = env.rpcCreateRoom(users[0].id, 'Quartet Pod');
    for (let i = 1; i < 4; i++) {
      const res = env.rpcJoinRoom(users[i].id, room.room_code);
      expect(res.status).toBe('ok');
    }

    const members = env.participants.get(room.room_id);
    expect(members.length).toBe(4);
  });

  it('TC-F6-04: Supports exactly 5 concurrent participants in a single tank', () => {
    const env = new MockSupabaseEnvironment();
    const users = Array.from({ length: 5 }, () => env.createGoogleUser());

    const room = env.rpcCreateRoom(users[0].id, 'Quintet Pod');
    for (let i = 1; i < 5; i++) {
      const res = env.rpcJoinRoom(users[i].id, room.room_code);
      expect(res.status).toBe('ok');
    }

    const members = env.participants.get(room.room_id);
    expect(members.length).toBe(5);
  });

  it('TC-F6-05: Realtime presence heartbeat accurately tracks multi-user active/away states', () => {
    const env = new MockSupabaseEnvironment();
    const u1 = env.createGoogleUser();
    const u2 = env.createGoogleUser();
    const u3 = env.createGoogleUser();

    const room = env.rpcCreateRoom(u1.id, 'Presence Pod');
    env.rpcJoinRoom(u2.id, room.room_code);
    env.rpcJoinRoom(u3.id, room.room_code);

    // Set u2 and u3 away
    env.setParticipantAway(room.room_id, u2.id, true);
    env.setParticipantAway(room.room_id, u3.id, true);

    const roomData = env.rooms.get(room.room_id);
    expect(roomData.active_away_count).toBe(2);
  });
});
