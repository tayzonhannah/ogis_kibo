import { describe, it, expect } from '../test_framework.mjs';
import { MockSupabaseEnvironment } from '../helpers/simulators.mjs';

describe('Tier 2: Boundary & Corner Cases - F12: Partner Vouchers Boundaries', () => {
  it('TC-F12-B56: Exact points match leaves user balance at exactly 0', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser({ fishPoints: 120 }); // v1 costs 120

    const res = env.redeemVoucher(user.id, 'v1');
    expect(res.success).toBe(true);
    expect(res.remainingPoints).toBe(0);
    expect(env.profiles.get(user.id).fishPoints).toBe(0);
  });

  it('TC-F12-B57: Sequentially redeems multiple vouchers while points suffice', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser({ fishPoints: 600 });

    const r1 = env.redeemVoucher(user.id, 'v1'); // 120
    const r2 = env.redeemVoucher(user.id, 'v2'); // 250
    const r3 = env.redeemVoucher(user.id, 'v4'); // 150
    // Total spent: 520, remaining: 80

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r3.success).toBe(true);
    expect(env.profiles.get(user.id).fishPoints).toBe(80);
    expect(env.voucherRedemptions.length).toBe(3);
  });

  it('TC-F12-B58: Voucher category filter with no matches yields empty list gracefully', () => {
    const env = new MockSupabaseEnvironment();
    const all = Array.from(env.vouchers.values());
    const nonExistentCategory = all.filter((v) => v.category === 'outer-space');
    expect(nonExistentCategory.length).toBe(0);
  });

  it('TC-F12-B59: Rejects redemption of invalid / non-existent voucher ID', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser({ fishPoints: 1000 });

    expect(() => {
      env.redeemVoucher(user.id, 'non_existent_voucher_id');
    }).toThrow('Voucher not found');
  });

  it('TC-F12-B60: Prevents double redemption if balance drops below threshold on second attempt', () => {
    const env = new MockSupabaseEnvironment();
    const user = env.createGoogleUser({ fishPoints: 120 }); // Only enough for 1x v1 (120)

    const first = env.redeemVoucher(user.id, 'v1');
    expect(first.success).toBe(true);

    expect(() => {
      env.redeemVoucher(user.id, 'v1');
    }).toThrow('Insufficient Fish Points');
  });
});
