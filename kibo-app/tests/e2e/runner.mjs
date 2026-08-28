/**
 * KIBO E2E Automated Test Runner
 * Executes all test tiers (Tiers 1-4) with diagnostic reporting and exit code semantics.
 */

import { globalRegistry } from './test_framework.mjs';

// Tier 1: Feature Coverage (F1 - F12)
import './tier1-features/f1_auth.test.mjs';
import './tier1-features/f2_profiles.test.mjs';
import './tier1-features/f3_multi_tank_schema.test.mjs';
import './tier1-features/f4_dashboard.test.mjs';
import './tier1-features/f5_tank_switcher.test.mjs';
import './tier1-features/f6_multi_user_capacity.test.mjs';
import './tier1-features/f7_personalized_fish.test.mjs';
import './tier1-features/f8_screen_crossing.test.mjs';
import './tier1-features/f9_co_away_kn.test.mjs';
import './tier1-features/f10_connect_moment.test.mjs';
import './tier1-features/f11_time_capsules.test.mjs';
import './tier1-features/f12_vouchers.test.mjs';

// Tier 2: Boundary & Corner Cases (F1 - F12)
import './tier2-boundaries/f1_auth_boundaries.test.mjs';
import './tier2-boundaries/f2_profiles_boundaries.test.mjs';
import './tier2-boundaries/f3_multi_tank_boundaries.test.mjs';
import './tier2-boundaries/f4_dashboard_boundaries.test.mjs';
import './tier2-boundaries/f5_tank_switcher_boundaries.test.mjs';
import './tier2-boundaries/f6_multi_user_boundaries.test.mjs';
import './tier2-boundaries/f7_personalized_fish_boundaries.test.mjs';
import './tier2-boundaries/f8_screen_crossing_boundaries.test.mjs';
import './tier2-boundaries/f9_co_away_kn_boundaries.test.mjs';
import './tier2-boundaries/f10_connect_moment_boundaries.test.mjs';
import './tier2-boundaries/f11_time_capsules_boundaries.test.mjs';
import './tier2-boundaries/f12_vouchers_boundaries.test.mjs';

// Tier 3: Cross-Feature Interactions
import './tier3-interactions/pairwise_interactions.test.mjs';

// Tier 4: Real-World Scenarios
import './tier4-scenarios/real_world_scenarios.test.mjs';

// Tier 5: Adversarial Stress & Coverage Hardening
import './tier5_adversarial.test.mjs';

async function main() {
  console.log('\n======================================================');
  console.log('  KIBO AMBIENT AQUARIUM — E2E TEST RUNNER');
  console.log('======================================================\n');

  const results = await globalRegistry.runAll();
  const totalDuration = ((results.endTime - results.startTime) / 1000).toFixed(3);

  // Group results by suite
  const suiteMap = new Map();
  for (const t of results.tests) {
    if (!suiteMap.has(t.suite)) {
      suiteMap.set(t.suite, []);
    }
    suiteMap.get(t.suite).push(t);
  }

  let currentTier = '';
  for (const [suite, tests] of suiteMap.entries()) {
    const tierMatch = suite.match(/Tier \d/);
    const tierName = tierMatch ? tierMatch[0] : 'Other';
    if (tierName !== currentTier) {
      currentTier = tierName;
      console.log(`\n▶ [${currentTier.toUpperCase()}]`);
    }

    console.log(`  📂 ${suite}`);
    for (const test of tests) {
      if (test.status === 'pass') {
        console.log(`    \x1b[32m✔\x1b[0m ${test.name} \x1b[90m(${test.durationMs.toFixed(1)}ms)\x1b[0m`);
      } else {
        console.log(`    \x1b[31m✖\x1b[0m ${test.name} \x1b[90m(${test.durationMs.toFixed(1)}ms)\x1b[0m`);
        console.log(`      \x1b[31mError:\x1b[0m ${test.error}\n`);
      }
    }
  }

  console.log('\n------------------------------------------------------');
  console.log(`  TOTAL TESTS: ${results.passed + results.failed}`);
  console.log(`  \x1b[32mPASSED:      ${results.passed}\x1b[0m`);
  if (results.failed > 0) {
    console.log(`  \x1b[31mFAILED:      ${results.failed}\x1b[0m`);
  }
  console.log(`  ELAPSED:     ${totalDuration}s`);
  console.log('------------------------------------------------------\n');

  if (results.failed > 0) {
    console.error(`\x1b[31mTest Run Failed with ${results.failed} errors.\x1b[0m\n`);
    process.exit(1);
  } else {
    console.log(`\x1b[32mAll ${results.passed} tests completed successfully!\x1b[0m\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
