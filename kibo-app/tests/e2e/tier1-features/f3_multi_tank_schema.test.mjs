import { describe, it, expect } from '../test_framework.mjs';
import { MockSupabaseEnvironment } from '../helpers/simulators.mjs';
import { validateTankRoom, isValidRoomCode, ROOM_CAPACITY } from '../helpers/contracts.mjs';

describe('Tier 1: Feature Coverage - F3: Multi-Tank Schema & RPCs', () => {
  it('TC-F3-01: create_room RPC creates room with custom name and returns room_id & 8-char code', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();

    const created = env.rpcCreateRoom(user.id, 'Stargazing Pod', 'deep');
    expect(created.room_id).toBeDefined();
    expect(isValidRoomCode(created.room_code)).toBe(true);

    const room = env.rooms.get(created.room_id);
    expect(room.name).toBe('Stargazing Pod');
    expect(room.created_by).toBe(user.id);
    expect(room.tank_mood).toBe('deep');

    const validation = validateTankRoom(room);
    expect(validation.valid).toBe(true);
  });

  it('TC-F3-02: join_room RPC successfully adds user up to capacity limit', () => {
    const env = new MockSupabaseEnvironment();
    const owner = env.createGoogleUser();
    const guest1 = env.createGoogleUser();
    const guest2 = env.createGoogleUser();

    const roomInfo = env.rpcCreateRoom(owner.id, 'Reading Nook');
    const join1 = env.rpcJoinRoom(guest1.id, roomInfo.room_code);
    const join2 = env.rpcJoinRoom(guest2.id, roomInfo.room_code);

    expect(join1.status).toBe('ok');
    expect(join2.status).toBe('ok');

    const members = env.participants.get(roomInfo.room_id);
    expect(members.length).toBe(3);
  });

  it('TC-F3-03: Rejects join_room when room reaches maximum capacity of 5', () => {
    const env = new MockSupabaseEnvironment();
    const owner = env.createGoogleUser();
    const roomInfo = env.rpcCreateRoom(owner.id, 'Full Tank');

    // Fill to 5
    for (let i = 1; i < ROOM_CAPACITY; i++) {
      const guest = env.createGoogleUser();
      const res = env.rpcJoinRoom(guest.id, roomInfo.room_code);
      expect(res.status).toBe('ok');
    }
    expect(env.participants.get(roomInfo.room_id).length).toBe(5);

    // 6th user attempts to join
    const guest6 = env.createGoogleUser();
    const res6 = env.rpcJoinRoom(guest6.id, roomInfo.room_code);
    expect(res6.status).toBe('room_full');
    expect(res6.joined_room).toBeNull();
  });

  it('TC-F3-04: Rejects join_room with non-existent code', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();
    const res = env.rpcJoinRoom(user.id, 'ZZZZ9999');
    expect(res.status).toBe('room_not_found');
  });

  it('TC-F3-05: Re-joining an already joined room is idempotent and returns ok', () => {
    const env = new MockSupabaseEnvironment();
    const user1 = env.createGoogleUser();
    const user2 = env.createGoogleUser();

    const roomInfo = env.rpcCreateRoom(user1.id, 'Idempotent Tank');
    const firstJoin = env.rpcJoinRoom(user2.id, roomInfo.room_code);
    const secondJoin = env.rpcJoinRoom(user2.id, roomInfo.room_code);

    expect(firstJoin.status).toBe('ok');
    expect(secondJoin.status).toBe('ok');
    expect(env.participants.get(roomInfo.room_id).length).toBe(2);
  });
});
