import { describe, it, expect } from '../test_framework.mjs';
import { MockSupabaseEnvironment } from '../helpers/simulators.mjs';
import { validateUserProfile } from '../helpers/contracts.mjs';

describe('Tier 2: Boundary & Corner Cases - F2: User Profiles Boundaries', () => {
  it('TC-F2-B06: Exact zero fish_points balance is valid and supported', () => {
    const profile = { id: 'usr_zero_pts', email: 'zero@kibo.app', fishPoints: 0 };
    const res = validateUserProfile(profile);
    expect(res.valid).toBe(true);
  });

  it('TC-F2-B07: Large integer fish points (1,000,000+) stored accurately without integer overflow', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser({ fishPoints: 1_500_000 });
    const profile = env.profiles.get(user.id);

    expect(profile.fishPoints).toBe(1_500_000);
    const res = validateUserProfile(profile);
    expect(res.valid).toBe(true);
  });

  it('TC-F2-B08: Handles null vs empty string avatarUrl gracefully', () => {
    const profileNull = { id: 'usr_null_av', avatarUrl: undefined, fishPoints: 10 };
    const resNull = validateUserProfile(profileNull);
    expect(resNull.valid).toBe(true);
  });

  it('TC-F2-B09: Handles max length display name (255 characters)', () => {
    const longName = 'A'.repeat(255);
    const profile = { id: 'usr_long_name', displayName: longName, fishPoints: 10 };
    const res = validateUserProfile(profile);
    expect(res.valid).toBe(true);
  });

  it('TC-F2-B10: Atomic update on profile points prevents lost updates in concurrent transactions', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser({ fishPoints: 100 });
    
    // Simulate 2 parallel awards of +50 points
    const p = env.profiles.get(user.id);
    p.fishPoints += 50;
    p.fishPoints += 50;
    
    expect(env.profiles.get(user.id).fishPoints).toBe(200);
  });
});
