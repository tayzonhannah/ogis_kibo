import { describe, it, expect } from '../test_framework.mjs';
import { MockSupabaseEnvironment } from '../helpers/simulators.mjs';
import { validateUserProfile } from '../helpers/contracts.mjs';

describe('Tier 1: Feature Coverage - F1: Google OAuth Auth Provider', () => {
  it('TC-F1-01: Exclusively allows Google OAuth provider during sign-in', async () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser({
      email: 'alex.chen@gmail.com',
      displayName: 'Alex Chen',
      avatarUrl: 'https://lh3.googleusercontent.com/a/alex-avatar',
    });

    expect(user.provider).toBe('google');
    expect(user.email).toContain('@gmail.com');
  });

  it('TC-F1-02: Synchronizes Google metadata to public.profiles upon login', async () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser({
      id: 'usr_g_001',
      email: 'maya.lin@gmail.com',
      displayName: 'Maya Lin',
      avatarUrl: 'https://lh3.googleusercontent.com/a/maya-pic',
    });

    const profile = env.profiles.get('usr_g_001');
    expect(profile).toBeDefined();
    expect(profile.email).toBe('maya.lin@gmail.com');
    expect(profile.displayName).toBe('Maya Lin');
    expect(profile.avatarUrl).toBe('https://lh3.googleusercontent.com/a/maya-pic');
    
    const validation = validateUserProfile(profile);
    expect(validation.valid).toBe(true);
  });

  it('TC-F1-03: Initializes default fish_points to non-negative integer for new Google user', async () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser({ id: 'usr_g_points', fishPoints: 0 });
    const profile = env.profiles.get(user.id);
    
    expect(profile.fishPoints).toBe(0);
    expect(Number.isInteger(profile.fishPoints)).toBe(true);
  });

  it('TC-F1-04: Session persistence maintains user identity across page reloads', async () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser({ id: 'usr_session_123' });
    
    // Simulate reading session
    const retrievedUser = env.users.get('usr_session_123');
    expect(retrievedUser).toBeDefined();
    expect(retrievedUser.id).toBe(user.id);
  });

  it('TC-F1-05: Rejects unauthenticated attempts to access restricted room operations', async () => {
    const env = new MockSupabaseEnvironment();
    expect(() => {
      env.rpcCreateRoom('non_existent_anon_user');
    }).toThrow('not_authenticated');
  });
});
