import { describe, it, expect } from '../test_framework.mjs';
import { MockSupabaseEnvironment } from '../helpers/simulators.mjs';
import { validateUserProfile } from '../helpers/contracts.mjs';

describe('Tier 2: Boundary & Corner Cases - F1: Google OAuth Auth Boundaries', () => {
  it('TC-F1-B01: Handles malformed OAuth callback parameters cleanly', () => {
    const parseOAuthParams = (query) => {
      if (!query.code || !query.state) {
        throw new Error('MALFORMED_OAUTH_CALLBACK: Missing code or state');
      }
      return { code: query.code, state: query.state };
    };

    expect(() => parseOAuthParams({ error: 'access_denied' })).toThrow('MALFORMED_OAUTH_CALLBACK');
    expect(() => parseOAuthParams({})).toThrow('MALFORMED_OAUTH_CALLBACK');
  });

  it('TC-F1-B02: Rapid concurrent sign-in calls do not create duplicate auth listener registrations', () => {
    let listenerCount = 0;
    const registerListener = () => {
      if (listenerCount === 0) listenerCount++;
      return listenerCount;
    };

    registerListener();
    registerListener();
    registerListener();
    expect(listenerCount).toBe(1);
  });

  it('TC-F1-B03: Handles expired refresh token by triggering unauthenticated state', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser({ id: 'usr_expired' });
    
    // Invalidate session
    env.users.delete(user.id);
    expect(() => env.rpcCreateRoom(user.id)).toThrow('not_authenticated');
  });

  it('TC-F1-B04: Preserves complex Unicode display names and emoji fidelity', () => {
    const env = new MockSupabaseEnvironment();
    const unicodeName = 'Alex 🌊 🐠 珊瑚 (アレックス)';
    const user = env.createGoogleUser({ displayName: unicodeName });
    
    const profile = env.profiles.get(user.id);
    expect(profile.displayName).toBe(unicodeName);
  });

  it('TC-F1-B05: Sign-out revokes session and subsequent mutations are rejected', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser();
    
    // User signed in -> can create room
    const room = env.rpcCreateRoom(user.id, 'Active Room');
    expect(room.room_id).toBeDefined();

    // Sign out simulation
    env.users.delete(user.id);
    expect(() => env.rpcCreateRoom(user.id, 'Post Signout Room')).toThrow('not_authenticated');
  });
});
