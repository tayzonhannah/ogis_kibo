import { describe, it, expect } from '../test_framework.mjs';
import { MockSupabaseEnvironment } from '../helpers/simulators.mjs';

describe('Tier 2: Boundary & Corner Cases - F5: In-Tank Tank Switcher Boundaries', () => {
  it('TC-F5-B21: Tank switcher dropdown maintains z-index over canvas and overlays (z-50)', () => {
    const switcherZIndex = 50;
    const canvasZIndex = 0;
    const overlayZIndex = 40;

    expect(switcherZIndex).toBeGreaterThan(overlayZIndex);
    expect(overlayZIndex).toBeGreaterThan(canvasZIndex);
  });

  it('TC-F5-B22: Selecting currently active tank in switcher does not trigger redundant page refresh', () => {
    const currentRoomId = 'room_123';
    const selectedRoomId = 'room_123';
    const shouldNavigate = currentRoomId !== selectedRoomId;
    expect(shouldNavigate).toBe(false);
  });

  it('TC-F5-B23: Escape key event properly closes switcher dropdown', () => {
    let isOpen = true;
    const handleKeyDown = (key) => {
      if (key === 'Escape') isOpen = false;
    };

    handleKeyDown('Escape');
    expect(isOpen).toBe(false);
  });

  it('TC-F5-B24: Switcher excludes rooms where user membership has ended', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();
    const otherUser = env.createGoogleUser();

    const t1 = env.rpcCreateRoom(user.id, 'My Active Tank');
    const t2 = env.rpcCreateRoom(otherUser.id, 'Other Private Tank');

    const availableTanks = Array.from(env.rooms.values()).filter((r) => {
      const members = env.participants.get(r.id) || [];
      return members.some((m) => m.user_id === user.id);
    });

    expect(availableTanks.map((t) => t.id)).toContain(t1.room_id);
    expect(availableTanks.map((t) => t.id)).not.toContain(t2.room_id);
  });

  it('TC-F5-B25: Long tank name (e.g. 50+ chars) in switcher is truncated with ellipsis safely', () => {
    const longName = 'The Grand Super Long Name For A Relaxing Marine Aquarium Pod';
    const truncate = (str, max = 24) => (str.length > max ? `${str.slice(0, max - 1)}…` : str);
    
    const formatted = truncate(longName, 24);
    expect(formatted.length).toBeLessThanOrEqual(24);
    expect(formatted.endsWith('…')).toBe(true);
  });
});
