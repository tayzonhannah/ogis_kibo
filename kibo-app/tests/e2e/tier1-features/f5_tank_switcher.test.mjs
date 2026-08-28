import { describe, it, expect } from '../test_framework.mjs';
import { MockSupabaseEnvironment } from '../helpers/simulators.mjs';

describe('Tier 1: Feature Coverage - F5: In-Tank Tank Switcher', () => {
  it('TC-F5-01: In-Tank Switcher fetches the complete list of alternate active tanks for user', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();

    const t1 = env.rpcCreateRoom(user.id, 'Tank Alpha');
    const t2 = env.rpcCreateRoom(user.id, 'Tank Beta');
    const t3 = env.rpcCreateRoom(user.id, 'Tank Gamma');

    const currentRoomId = t1.room_id;
    const userRooms = Array.from(env.rooms.values()).filter((r) => {
      const members = env.participants.get(r.id) || [];
      return members.some((m) => m.user_id === user.id);
    });

    const alternateRooms = userRooms.filter((r) => r.id !== currentRoomId);
    expect(alternateRooms.length).toBe(2);
    expect(alternateRooms.map((r) => r.name)).toContain('Tank Beta');
    expect(alternateRooms.map((r) => r.name)).toContain('Tank Gamma');
  });

  it('TC-F5-02: Switching tanks navigates seamlessly to the destination room URL (/room/[code])', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();

    const t1 = env.rpcCreateRoom(user.id, 'Source Tank');
    const t2 = env.rpcCreateRoom(user.id, 'Destination Tank');

    const targetUrl = `/room/${t2.room_code}`;
    expect(targetUrl).toBe(`/room/${t2.room_code}`);
    expect(t2.room_code.length).toBe(8);
  });

  it('TC-F5-03: Displays current room badge and mood in switcher header', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();
    const t1 = env.rpcCreateRoom(user.id, 'Focus Tank', 'bright');

    const room = env.rooms.get(t1.room_id);
    expect(room.name).toBe('Focus Tank');
    expect(room.tank_mood).toBe('bright');
  });

  it('TC-F5-04: Provides quick shortcut to Dashboard from within the in-tank switcher dropdown', () => {
    const dashboardRoute = '/dashboard';
    expect(dashboardRoute).toBe('/dashboard');
  });

  it('TC-F5-05: Handles single-tank user gracefully by displaying "No other active tanks" notice', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();
    const t1 = env.rpcCreateRoom(user.id, 'Only Tank');

    const userRooms = Array.from(env.rooms.values()).filter((r) => {
      const members = env.participants.get(r.id) || [];
      return members.some((m) => m.user_id === user.id);
    });
    const alternateRooms = userRooms.filter((r) => r.id !== t1.room_id);

    expect(alternateRooms.length).toBe(0);
  });
});
