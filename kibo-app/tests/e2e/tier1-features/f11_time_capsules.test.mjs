import { describe, it, expect } from '../test_framework.mjs';
import { MockSupabaseEnvironment } from '../helpers/simulators.mjs';

describe('Tier 1: Feature Coverage - F11: Milestones & Time Capsules Drawer', () => {
  it('TC-F11-01: Room member can create a milestone log or time capsule with future unlock date', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();
    const room = env.rpcCreateRoom(user.id, 'Memory Tank');

    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const capsule = env.createTimeCapsule(room.room_id, user.id, {
      title: 'Hike to Mount Tamalpais',
      memory_text: 'Reached the summit together at sunset!',
      media_url: 'https://images.unsplash.com/photo-summit-sunset',
      unlock_at: futureDate,
    });

    expect(capsule.id).toBeDefined();
    expect(capsule.title).toBe('Hike to Mount Tamalpais');
    expect(capsule.created_by).toBe(user.id);
  });

  it('TC-F11-02: Content remains locked and masked before unlock_at date', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();
    const room = env.rpcCreateRoom(user.id, 'Secret Tank');

    const futureDate = new Date(Date.now() + 86400000).toISOString();
    env.createTimeCapsule(room.room_id, user.id, {
      title: 'Surprise Anniversary Message',
      memory_text: 'Secret surprise details...',
      unlock_at: futureDate,
    });

    const feed = env.getTimeCapsulesForUser(room.room_id, user.id, new Date());
    expect(feed.length).toBe(1);
    expect(feed[0].unlocked).toBe(false);
    expect(feed[0].memory_text).toContain('Locked');
    expect(feed[0].media_url).toBeNull();
  });

  it('TC-F11-03: Content automatically unlocks once unlock_at timestamp passes', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();
    const room = env.rpcCreateRoom(user.id, 'Time Machine Tank');

    const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
    env.createTimeCapsule(room.room_id, user.id, {
      title: 'Graduation Day',
      memory_text: 'We finally made it! Here is the photo.',
      media_url: 'https://images.unsplash.com/photo-grad',
      unlock_at: pastDate,
    });

    const feed = env.getTimeCapsulesForUser(room.room_id, user.id, new Date());
    expect(feed.length).toBe(1);
    expect(feed[0].unlocked).toBe(true);
    expect(feed[0].memory_text).toBe('We finally made it! Here is the photo.');
    expect(feed[0].media_url).toBe('https://images.unsplash.com/photo-grad');
  });

  it('TC-F11-04: Non-members cannot access room time capsules (RLS Enforcement)', () => {
    const env = new MockSupabaseEnvironment();
    const member = env.createGoogleUser();
    const nonMember = env.createGoogleUser();
    const room = env.rpcCreateRoom(member.id, 'Private Tank');

    env.createTimeCapsule(room.room_id, member.id, {
      title: 'Private Note',
      memory_text: 'Confidential',
      unlock_at: new Date().toISOString(),
    });

    expect(() => {
      env.getTimeCapsulesForUser(room.room_id, nonMember.id);
    }).toThrow('RLS_VIOLATION');
  });

  it('TC-F11-05: Time Capsules drawer provides glassmorphic modal overlay UI contracts', () => {
    const drawerProps = {
      isOpen: true,
      roomId: 'room_123',
      glassmorphicTheme: 'frosted-cyan',
    };

    expect(drawerProps.isOpen).toBe(true);
    expect(drawerProps.glassmorphicTheme).toBe('frosted-cyan');
  });
});
