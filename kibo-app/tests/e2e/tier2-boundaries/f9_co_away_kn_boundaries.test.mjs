import { describe, it, expect } from '../test_framework.mjs';
import { computeCoAwayAccrual, MAX_AWAY_CREDIT_SECONDS } from '../helpers/contracts.mjs';

describe('Tier 2: Boundary & Corner Cases - F9: Continuous K/N Co-Away Boundaries', () => {
  it('TC-F9-B41: Enforces MAX_AWAY_CREDIT_SECONDS (28,800s / 8h) ceiling clamp for long absences', () => {
    // 24 hours away = 86,400s
    // With N=2, K=2 (rate 1.0), should be clamped to 28,800s
    const gained = computeCoAwayAccrual(86400, 2, 2);
    expect(gained).toBe(MAX_AWAY_CREDIT_SECONDS);
  });

  it('TC-F9-B42: Micro-interval away toggling (rapid 1s intervals) accumulates without rounding drift', () => {
    let total = 0;
    // 100 1-second intervals with 3/4 members away
    for (let i = 0; i < 100; i++) {
      total += computeCoAwayAccrual(1, 3, 4);
    }
    expect(total).toBeCloseTo(75, 0.001);
  });

  it('TC-F9-B43: Piecewise continuous integration across dynamic K transitions (K=1 -> K=3 -> K=2 in 5-user tank)', () => {
    // Interval 1: 100s at K=1/5 -> 20s
    const int1 = computeCoAwayAccrual(100, 1, 5);
    // Interval 2: 200s at K=3/5 -> 120s
    const int2 = computeCoAwayAccrual(200, 3, 5);
    // Interval 3: 300s at K=2/5 -> 120s
    const int3 = computeCoAwayAccrual(300, 2, 5);

    const total = int1 + int2 + int3;
    expect(total).toBe(260);
  });

  it('TC-F9-B44: Variable N transitions (mid-session member joins, N increases from 3 to 4)', () => {
    // 300s with K=2, N=3 -> 300 * (2/3) = 200s
    const phase1 = computeCoAwayAccrual(300, 2, 3);
    // 300s with K=2, N=4 -> 300 * (2/4) = 150s
    const phase2 = computeCoAwayAccrual(300, 2, 4);

    expect(phase1).toBe(200);
    expect(phase2).toBe(150);
    expect(phase1 + phase2).toBe(350);
  });

  it('TC-F9-B45: Single-user tank (N=1) yields 0 co-away nutrients', () => {
    const singleUserGain = computeCoAwayAccrual(3600, 1, 1);
    expect(singleUserGain).toBe(0);
  });
});
