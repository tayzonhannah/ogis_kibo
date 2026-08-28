import { describe, it, expect } from '../test_framework.mjs';
import { computeCoAwayAccrual, formatNutrientSeconds, liveNutrientSeconds } from '../helpers/contracts.mjs';

describe('Tier 1: Feature Coverage - F9: Continuous K/N Co-Away Engine', () => {
  it('TC-F9-01: Correctly calculates K/N accrual for 2-user tank with 1 away (1/2 rate)', () => {
    // 3600 seconds elapsed, 1 of 2 away -> 1800s nutrients gained
    const gained = computeCoAwayAccrual(3600, 1, 2);
    expect(gained).toBe(1800);
  });

  it('TC-F9-02: Correctly calculates K/N accrual for 5-user tank with 3 away (3/5 rate)', () => {
    // 1000 seconds elapsed, 3 of 5 away -> 600s nutrients gained
    const gained = computeCoAwayAccrual(1000, 3, 5);
    expect(gained).toBe(600);
  });

  it('TC-F9-03: Accrual is 0 when 0 users are away (K=0)', () => {
    const gained = computeCoAwayAccrual(3600, 0, 4);
    expect(gained).toBe(0);
  });

  it('TC-F9-04: Accrues at full rate 1.0 when all members in a group are co-away (K=N)', () => {
    const gained = computeCoAwayAccrual(1200, 5, 5);
    expect(gained).toBe(1200);
  });

  it('TC-F9-05: Formats nutrient durations cleanly without stopwatch jitter', () => {
    expect(formatNutrientSeconds(45)).toBe('45s');
    expect(formatNutrientSeconds(180)).toBe('3m');
    expect(formatNutrientSeconds(3600)).toBe('1h');
    expect(formatNutrientSeconds(4500)).toBe('1h 15m');
  });
});
