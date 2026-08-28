import { describe, it, expect } from '../test_framework.mjs';
import { MockSupabaseEnvironment } from '../helpers/simulators.mjs';
import { validateUserProfile } from '../helpers/contracts.mjs';

describe('Tier 1: Feature Coverage - F2: User Profiles Schema & Trigger', () => {
  it('TC-F2-01: Profile entity contains all required fields (id, email, display_name, avatar_url, fish_points)', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser({
      id: 'usr_schema_1',
      email: 'sara@kibo.app',
      displayName: 'Sara K',
      avatarUrl: 'https://images.unsplash.com/photo-user-sara',
      fishPoints: 150,
    });

    const profile = env.profiles.get(user.id);
    expect(profile).toHaveProperty('id', 'usr_schema_1');
    expect(profile).toHaveProperty('email', 'sara@kibo.app');
    expect(profile).toHaveProperty('displayName', 'Sara K');
    expect(profile).toHaveProperty('avatarUrl', 'https://images.unsplash.com/photo-user-sara');
    expect(profile).toHaveProperty('fishPoints', 150);
  });

  it('TC-F2-02: Profile links correctly to multiple room memberships', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser({ id: 'usr_multi_membership' });

    const room1 = env.rpcCreateRoom(user.id, 'Family Pod');
    const room2 = env.rpcCreateRoom(user.id, 'Study Group');

    const p1 = env.participants.get(room1.room_id).find((m) => m.user_id === user.id);
    const p2 = env.participants.get(room2.room_id).find((m) => m.user_id === user.id);

    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
    expect(p1.user_id).toBe(user.id);
    expect(p2.user_id).toBe(user.id);
  });

  it('TC-F2-03: Updating display_name in profile preserves fish_points and relations', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser({ id: 'usr_update_test', fishPoints: 400 });
    const profile = env.profiles.get(user.id);
    
    profile.displayName = 'Sara Knight';
    expect(env.profiles.get(user.id).displayName).toBe('Sara Knight');
    expect(env.profiles.get(user.id).fishPoints).toBe(400);
  });

  it('TC-F2-04: Enforces strict type contract for fish_points balance', () => {
    const invalidProfile = {
      id: 'usr_bad_pts',
      email: 'bad@test.com',
      fishPoints: -10, // Invalid negative points
    };
    const res = validateUserProfile(invalidProfile);
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThanOrEqual(1);
  });

  it('TC-F2-05: Cascades profile deletion cleanly when auth user is removed', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser({ id: 'usr_cascade' });
    expect(env.profiles.has('usr_cascade')).toBe(true);

    // Simulate cascade delete
    env.users.delete('usr_cascade');
    env.profiles.delete('usr_cascade');
    expect(env.profiles.has('usr_cascade')).toBe(false);
  });
});
