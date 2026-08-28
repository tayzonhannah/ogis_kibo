import { describe, it, expect } from '../test_framework.mjs';
import { MockSupabaseEnvironment } from '../helpers/simulators.mjs';
import { VOUCHER_CATEGORIES } from '../helpers/contracts.mjs';

describe('Tier 1: Feature Coverage - F12: Partner Vouchers Page (/vouchers)', () => {
  it('TC-F12-01: Displays authenticated user Fish Points balance wallet', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser({ fishPoints: 350 });

    const profile = env.profiles.get(user.id);
    expect(profile.fishPoints).toBe(350);
  });

  it('TC-F12-02: Displays partner voucher catalog filterable by category', () => {
    const env = new MockSupabaseEnvironment();
    const allVouchers = Array.from(env.vouchers.values());
    
    expect(allVouchers.length).toBeGreaterThanOrEqual(5);
    
    const coffeeVouchers = allVouchers.filter((v) => v.category === 'coffee');
    const bookstoreVouchers = allVouchers.filter((v) => v.category === 'bookstore');
    const wellnessVouchers = allVouchers.filter((v) => v.category === 'wellness');

    expect(coffeeVouchers.length).toBeGreaterThanOrEqual(1);
    expect(bookstoreVouchers.length).toBeGreaterThanOrEqual(1);
    expect(wellnessVouchers.length).toBeGreaterThanOrEqual(1);
  });

  it('TC-F12-03: Successfully redeems voucher when user has sufficient points balance', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser({ fishPoints: 300 });

    const res = env.redeemVoucher(user.id, 'v1'); // cost 120
    expect(res.success).toBe(true);
    expect(res.remainingPoints).toBe(180);
    expect(res.code).toBe('KIBO-CORTADO-24');
    expect(env.profiles.get(user.id).fishPoints).toBe(180);
  });

  it('TC-F12-04: Rejects redemption when user points balance is insufficient', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser({ fishPoints: 50 });

    expect(() => {
      env.redeemVoucher(user.id, 'v3'); // cost 500
    }).toThrow('Insufficient Fish Points');
  });

  it('TC-F12-05: Redemption records entry in voucher_redemptions ledger', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser({ fishPoints: 400 });

    env.redeemVoucher(user.id, 'v2'); // cost 250
    expect(env.voucherRedemptions.length).toBe(1);
    expect(env.voucherRedemptions[0].user_id).toBe(user.id);
    expect(env.voucherRedemptions[0].voucher_id).toBe('v2');
  });
});
