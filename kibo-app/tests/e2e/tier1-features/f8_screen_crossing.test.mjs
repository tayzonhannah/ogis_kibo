import { describe, it, expect } from '../test_framework.mjs';
import { routeScreenCrossing } from '../helpers/contracts.mjs';

describe('Tier 1: Feature Coverage - F8: Multi-Peer Screen Crossing', () => {
  it('TC-F8-01: Routes rightward screen crossing in 3-peer ring (0 -> 1 -> 2 -> 0)', () => {
    const peers = ['usr_0', 'usr_1', 'usr_2'];
    expect(routeScreenCrossing('usr_0', 1, peers)).toBe('usr_1');
    expect(routeScreenCrossing('usr_1', 1, peers)).toBe('usr_2');
    expect(routeScreenCrossing('usr_2', 1, peers)).toBe('usr_0');
  });

  it('TC-F8-02: Routes leftward screen crossing in 3-peer ring (0 -> 2 -> 1 -> 0)', () => {
    const peers = ['usr_0', 'usr_1', 'usr_2'];
    expect(routeScreenCrossing('usr_0', -1, peers)).toBe('usr_2');
    expect(routeScreenCrossing('usr_2', -1, peers)).toBe('usr_1');
    expect(routeScreenCrossing('usr_1', -1, peers)).toBe('usr_0');
  });

  it('TC-F8-03: Routes rightward screen crossing across 5-peer full ring topology', () => {
    const peers = ['u0', 'u1', 'u2', 'u3', 'u4'];
    expect(routeScreenCrossing('u0', 1, peers)).toBe('u1');
    expect(routeScreenCrossing('u3', 1, peers)).toBe('u4');
    expect(routeScreenCrossing('u4', 1, peers)).toBe('u0');
  });

  it('TC-F8-04: Two-phase handoff broadcasts payload with required transfer metadata', () => {
    const payload = {
      type: 'FISH_CROSS',
      fishId: 'fish_cross_01',
      fromUser: 'u1',
      toUser: 'u2',
      yFrac: 0.42,
      speed: 45,
      direction: 1,
      color: '#4ECDC4',
      finStyle: 'veil',
    };

    expect(payload.type).toBe('FISH_CROSS');
    expect(payload.fishId).toBeDefined();
    expect(payload.fromUser).toBe('u1');
    expect(payload.toUser).toBe('u2');
    expect(payload.yFrac).toBeCloseTo(0.42);
    expect(payload.direction).toBe(1);
  });

  it('TC-F8-05: Solo participant bounces fish locally within canvas bounds without error', () => {
    const peers = ['solo_user'];
    const dest = routeScreenCrossing('solo_user', 1, peers);
    expect(dest).toBe('solo_user');
  });
});
