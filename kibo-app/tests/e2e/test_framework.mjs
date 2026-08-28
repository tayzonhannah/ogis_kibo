/**
 * KIBO E2E Test Framework & Assertion Library
 * Zero-dependency, deterministic requirement validation engine.
 */

import assert from 'node:assert';

export class TestRegistry {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: [],
      startTime: 0,
      endTime: 0,
    };
  }

  describe(suiteName, fn) {
    const parentSuite = this.currentSuite;
    const suite = {
      name: suiteName,
      parent: parentSuite,
      tests: [],
      suites: [],
    };

    if (parentSuite) {
      parentSuite.suites.push(suite);
    } else {
      this.suites.push(suite);
    }

    this.currentSuite = suite;
    try {
      fn();
    } finally {
      this.currentSuite = parentSuite;
    }
  }

  it(testName, fn) {
    if (!this.currentSuite) {
      throw new Error(`Test "${testName}" must be defined inside a describe() block`);
    }
    this.currentSuite.tests.push({
      name: testName,
      fn,
      suitePath: this.getSuitePath(this.currentSuite),
    });
  }

  getSuitePath(suite) {
    const parts = [];
    let curr = suite;
    while (curr) {
      parts.unshift(curr.name);
      curr = curr.parent;
    }
    return parts.join(' > ');
  }

  async runAll() {
    this.results.startTime = performance.now();
    this.results.passed = 0;
    this.results.failed = 0;
    this.results.skipped = 0;
    this.results.tests = [];

    const flattenedTests = [];
    function collect(suite) {
      for (const t of suite.tests) flattenedTests.push(t);
      for (const s of suite.suites) collect(s);
    }
    for (const suite of this.suites) {
      collect(suite);
    }

    for (const test of flattenedTests) {
      const testStart = performance.now();
      try {
        await test.fn();
        const durationMs = performance.now() - testStart;
        this.results.passed++;
        this.results.tests.push({
          suite: test.suitePath,
          name: test.name,
          status: 'pass',
          durationMs,
        });
      } catch (err) {
        const durationMs = performance.now() - testStart;
        this.results.failed++;
        this.results.tests.push({
          suite: test.suitePath,
          name: test.name,
          status: 'fail',
          error: err instanceof Error ? err.stack || err.message : String(err),
          durationMs,
        });
      }
    }

    this.results.endTime = performance.now();
    return this.results;
  }
}

export const globalRegistry = new TestRegistry();

export function describe(name, fn) {
  globalRegistry.describe(name, fn);
}

export function it(name, fn) {
  globalRegistry.it(name, fn);
}

function buildMatchers(actual, isNot = false) {
  return {
    toBe(expected) {
      if (isNot) {
        assert.notStrictEqual(actual, expected, `Expected ${JSON.stringify(actual)} NOT to strictly equal ${JSON.stringify(expected)}`);
      } else {
        assert.strictEqual(actual, expected, `Expected ${JSON.stringify(actual)} to strictly equal ${JSON.stringify(expected)}`);
      }
    },
    toEqual(expected) {
      if (isNot) {
        assert.notDeepStrictEqual(actual, expected, `Expected ${JSON.stringify(actual)} NOT to deeply equal ${JSON.stringify(expected)}`);
      } else {
        assert.deepStrictEqual(actual, expected, `Expected ${JSON.stringify(actual)} to deeply equal ${JSON.stringify(expected)}`);
      }
    },
    toBeDefined() {
      if (isNot) {
        assert.strictEqual(actual, undefined, `Expected value NOT to be defined`);
      } else {
        assert.notStrictEqual(actual, undefined, `Expected value to be defined`);
      }
    },
    toBeUndefined() {
      if (isNot) {
        assert.notStrictEqual(actual, undefined, `Expected value NOT to be undefined`);
      } else {
        assert.strictEqual(actual, undefined, `Expected value to be undefined`);
      }
    },
    toBeNull() {
      if (isNot) {
        assert.notStrictEqual(actual, null, `Expected value NOT to be null`);
      } else {
        assert.strictEqual(actual, null, `Expected value to be null`);
      }
    },
    toBeNotNull() {
      assert.notStrictEqual(actual, null, `Expected value not to be null`);
    },
    toBeTruthy() {
      if (isNot) {
        assert.ok(!actual, `Expected ${actual} NOT to be truthy`);
      } else {
        assert.ok(actual, `Expected ${actual} to be truthy`);
      }
    },
    toBeFalsy() {
      if (isNot) {
        assert.ok(actual, `Expected ${actual} NOT to be falsy`);
      } else {
        assert.ok(!actual, `Expected ${actual} to be falsy`);
      }
    },
    toBeGreaterThan(num) {
      assert.ok(actual > num, `Expected ${actual} to be greater than ${num}`);
    },
    toBeGreaterThanOrEqual(num) {
      assert.ok(actual >= num, `Expected ${actual} to be >= ${num}`);
    },
    toBeLessThan(num) {
      assert.ok(actual < num, `Expected ${actual} to be less than ${num}`);
    },
    toBeLessThanOrEqual(num) {
      assert.ok(actual <= num, `Expected ${actual} to be <= ${num}`);
    },
    toBeCloseTo(expected, delta = 0.001) {
      const diff = Math.abs(actual - expected);
      assert.ok(diff <= delta, `Expected ${actual} to be within ${delta} of ${expected} (diff: ${diff})`);
    },
    toContain(item) {
      if (typeof actual === 'string') {
        if (isNot) {
          assert.ok(!actual.includes(item), `Expected string "${actual}" NOT to contain "${item}"`);
        } else {
          assert.ok(actual.includes(item), `Expected string "${actual}" to contain "${item}"`);
        }
      } else if (Array.isArray(actual)) {
        if (isNot) {
          assert.ok(!actual.includes(item), `Expected array ${JSON.stringify(actual)} NOT to contain ${JSON.stringify(item)}`);
        } else {
          assert.ok(actual.includes(item), `Expected array ${JSON.stringify(actual)} to contain ${JSON.stringify(item)}`);
        }
      } else if (actual instanceof Set || actual instanceof Map) {
        if (isNot) {
          assert.ok(!actual.has(item), `Expected collection NOT to contain ${item}`);
        } else {
          assert.ok(actual.has(item), `Expected collection to contain ${item}`);
        }
      } else {
        throw new Error(`toContain not supported for type ${typeof actual}`);
      }
    },
    toMatch(regex) {
      if (isNot) {
        assert.ok(!regex.test(String(actual)), `Expected "${actual}" NOT to match pattern ${regex}`);
      } else {
        assert.ok(regex.test(String(actual)), `Expected "${actual}" to match pattern ${regex}`);
      }
    },
    toHaveLength(len) {
      assert.strictEqual(actual?.length, len, `Expected length ${actual?.length} to equal ${len}`);
    },
    toHaveProperty(prop, value) {
      assert.ok(actual !== null && typeof actual === 'object' && prop in actual, `Expected object to have property "${prop}"`);
      if (value !== undefined) {
        assert.deepStrictEqual(actual[prop], value, `Expected property "${prop}" to equal ${JSON.stringify(value)}`);
      }
    },
    toThrow(expectedError) {
      if (typeof actual !== 'function') {
        throw new Error(`toThrow expects a function`);
      }
      let thrown = null;
      try {
        actual();
      } catch (err) {
        thrown = err;
      }
      if (isNot) {
        assert.ok(thrown === null, `Expected function NOT to throw an error, but it threw: ${thrown?.message}`);
      } else {
        assert.ok(thrown !== null, `Expected function to throw an error`);
        if (typeof expectedError === 'string') {
          assert.ok(thrown.message.includes(expectedError), `Expected error message "${thrown.message}" to include "${expectedError}"`);
        } else if (expectedError instanceof RegExp) {
          assert.ok(expectedError.test(thrown.message), `Expected error message "${thrown.message}" to match ${expectedError}`);
        }
      }
    },
  };
}

export function expect(actual) {
  const matchers = buildMatchers(actual, false);
  matchers.not = buildMatchers(actual, true);
  return matchers;
}
