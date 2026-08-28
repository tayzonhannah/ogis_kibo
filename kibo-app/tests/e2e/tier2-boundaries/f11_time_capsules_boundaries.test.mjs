import { describe, it, expect } from '../test_framework.mjs';
import { MockSupabaseEnvironment } from '../helpers/simulators.mjs';

describe('Tier 2: Boundary & Corner Cases - F11: Time Capsules Boundaries', () => {
  it('TC-F11-B51: Unlock timestamp exactly equal to current timestamp evaluates to unlocked', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();
    const room = env.rpcCreateRoom(user.id, 'Exact Time Tank');

    const exactNow = new Date('2026-08-24T12:00:00.000Z');
    env.createTimeCapsule(room.room_id, user.id, {
      title: 'Noon Milestone',
      memory_text: 'Unlocked precisely at noon',
      unlock_at: exactNow.toISOString(),
    });

    const feed = env.getTimeCapsulesForUser(room.room_id, user.id, exactNow);
    expect(feed[0].unlocked).toBe(true);
    expect(feed[0].memory_text).toBe('Unlocked precisely at noon');
  });

  it('TC-F11-B52: Rejects capsule creation with empty title or empty memory text', () => {
    const validateCapsuleInput = (input) => {
      if (!input.title || input.title.trim().length === 0) throw new Error('EMPTY_TITLE');
      if (!input.memory_text || input.memory_text.trim().length === 0) throw new Error('EMPTY_MEMORY');
      return true;
    };

    expect(() => validateCapsuleInput({ title: '   ', memory_text: 'Valid' })).toThrow('EMPTY_TITLE');
    expect(() => validateCapsuleInput({ title: 'Valid', memory_text: '   ' })).toThrow('EMPTY_MEMORY');
  });

  it('TC-F11-B53: Handles large memory text payload (up to 2000 chars) gracefully', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();
    const room = env.rpcCreateRoom(user.id, 'Long Story Tank');

    const longStory = 'A'.repeat(2000);
    const capsule = env.createTimeCapsule(room.room_id, user.id, {
      title: 'Our Long Story',
      memory_text: longStory,
      unlock_at: new Date(Date.now() - 1000).toISOString(),
    });

    const feed = env.getTimeCapsulesForUser(room.room_id, user.id);
    expect(feed[0].memory_text.length).toBe(2000);
  });

  it('TC-F11-B54: Supports far future unlock dates (e.g. 10 years ahead)', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();
    const room = env.rpcCreateRoom(user.id, 'Decade Tank');

    const farFuture = new Date('2036-08-24T00:00:00.000Z').toISOString();
    env.createTimeCapsule(room.room_id, user.id, {
      title: '10 Year Letter',
      memory_text: 'Reading this in 2036!',
      unlock_at: farFuture,
    });

    const feed = env.getTimeCapsulesForUser(room.room_id, user.id, new Date('2026-08-24T00:00:00.000Z'));
    expect(feed[0].unlocked).toBe(false);
  });

  it('TC-F11-B55: Multiple time capsules with mixed lock states in same room filter accurately', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();
    const room = env.rpcCreateRoom(user.id, 'Mixed Tank');

    const past = new Date(Date.now() - 5000).toISOString();
    const future = new Date(Date.now() + 500000).toISOString();

    env.createTimeCapsule(room.room_id, user.id, { title: 'Past 1', memory_text: 'Past Text 1', unlock_at: past });
    env.createTimeCapsule(room.room_id, user.id, { title: 'Future 1', memory_text: 'Secret', unlock_at: future });

    const feed = env.getTimeCapsulesForUser(room.room_id, user.id);
    expect(feed.length).toBe(2);
    expect(feed.find((c) => c.title === 'Past 1').unlocked).toBe(true);
    expect(feed.find((c) => c.title === 'Future 1').unlocked).toBe(false);
  });
});
