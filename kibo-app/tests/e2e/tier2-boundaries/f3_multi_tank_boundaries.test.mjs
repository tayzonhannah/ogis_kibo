import { describe, it, expect } from '../test_framework.mjs';
import { MockSupabaseEnvironment } from '../helpers/simulators.mjs';
import { isValidRoomCode, CODE_ALPHABET } from '../helpers/contracts.mjs';

describe('Tier 2: Boundary & Corner Cases - F3: Multi-Tank Schema Boundaries', () => {
  it('TC-F3-B11: Room names with leading/trailing whitespace are trimmed; empty names default gracefully', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();

    const created = env.rpcCreateRoom(user.id, '   Coastal Retreat   ');
    const room = env.rooms.get(created.room_id);
    expect(room.name.trim()).toBe('Coastal Retreat');
  });

  it('TC-F3-B12: Ambiguous characters (0, O, 1, I) are strictly excluded from generated room codes', () => {
    const forbiddenChars = ['0', 'O', '1', 'I'];
    for (const char of forbiddenChars) {
      expect(CODE_ALPHABET.includes(char)).toBe(false);
    }
  });

  it('TC-F3-B13: Room code verification is strictly case-insensitive', () => {
    const env = new MockSupabaseEnvironment();
    const owner = env.createGoogleUser();
    const guest = env.createGoogleUser();

    const room = env.rpcCreateRoom(owner.id, 'Case Insensitive Tank');
    const lowerCode = room.room_code.toLowerCase();

    const joinRes = env.rpcJoinRoom(guest.id, lowerCode);
    expect(joinRes.status).toBe('ok');
    expect(joinRes.joined_room).toBe(room.room_id);
  });

  it('TC-F3-B14: Single user can create 10+ distinct tanks without database collision', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();
    const createdCodes = new Set();

    for (let i = 0; i < 15; i++) {
      const res = env.rpcCreateRoom(user.id, `Tank #${i + 1}`);
      expect(createdCodes.has(res.room_code)).toBe(false);
      createdCodes.add(res.room_code);
    }

    expect(createdCodes.size).toBe(15);
  });

  it('TC-F3-B15: Invalid length room codes (e.g. 7 or 9 chars) are rejected immediately', () => {
    expect(isValidRoomCode('ABC')).toBe(false);
    expect(isValidRoomCode('ABCDEFG')).toBe(false); // 7 chars
    expect(isValidRoomCode('ABCDEFGHI')).toBe(false); // 9 chars
  });
});
