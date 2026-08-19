import { beforeAll, describe, expect, test } from "vitest";
import { runMetaFixture } from "./__fixtures__/spawn-vitest.js";

/**
 * The feature-hook half of §0's meta-suite: one child `vitest run` over the
 * lifecycle fixture, asserting the PRINTED counts and reporter text — the
 * only signal that proves what real vitest does with the beforeAll/afterAll
 * the feature hooks compile to. Coverage is NOT discharged here; every
 * branch stays unit-covered in-process (feature-hooks.test.ts).
 */
describe("meta-suite: lifecycle", () => {
  let output = "";
  let testFiles = "";
  let tests = "";

  beforeAll(() => {
    const result = runMetaFixture("lifecycle");
    output = result.output;
    testFiles = result.summary.testFiles;
    tests = result.summary.tests;
  }, 180_000);

  test("should print exact totals — the beforeAll-failed feature is IN the counts as a failed FILE", () => {
    // CAPTURED behaviour (vitest 4.1.4): a throwing beforeAll fails the
    // SUITE, so the file counts as failed while its scenarios report
    // SKIPPED — red at file level, and no scenario reports green.
    expect(testFiles).toBe("1 failed | 1 passed (2)");
    expect(tests).toBe("1 passed | 2 skipped (3)");
  });

  test("should report the @BeforeFeature throw anchored to class.method and the feature uri", () => {
    expect(output).toContain(
      "FAIL  features/before-feature-throw.feature > before-feature throw",
    );
    expect(output).toContain(
      [
        "@BeforeFeature hook failed",
        "",
        "  LifecycleMetaSteps.brokenStart",
        "  at features/before-feature-throw.feature",
        "",
        "docker daemon is not running",
      ].join("\n"),
    );
  });

  test("should run @AfterFeature even though @BeforeFeature threw — teardown still unwinds", () => {
    // CAPTURED behaviour (vitest 4.1.4): afterAll runs after a FAILED
    // beforeAll, so the @AfterFeature teardown of a red feature still
    // executes. §4's "after-hooks always run" holds at feature level through
    // vitest's own mechanism — this pin goes red if a vitest upgrade stops
    // running afterAll for a failed suite.
    expect(output).toContain("META_SENTINEL_AFTER_BOOM");
  });

  test("should mark both scenarios of the failed feature skipped — none executed", () => {
    expect(output).toContain(
      "↓ features/before-feature-throw.feature > before-feature throw > first scenario never runs",
    );
    expect(output).toContain(
      "↓ features/before-feature-throw.feature > before-feature throw > second scenario never runs",
    );
    // The step sentinel printed exactly ONCE — the green feature's scenario.
    // Were the failed feature's scenarios executed, it would print thrice.
    expect(output.match(/META_SENTINEL_STEP_RAN/g)).toHaveLength(1);
  });

  test("should run @BeforeFeature before the scenario and @AfterFeature after it on the REAL api", () => {
    const before = output.indexOf("META_SENTINEL_BEFORE_FEATURE");
    const step = output.indexOf("META_SENTINEL_STEP_RAN");
    const after = output.indexOf("META_SENTINEL_AFTER_FEATURE");

    expect(before).toBeGreaterThanOrEqual(0);
    expect(step).toBeGreaterThan(before);
    expect(after).toBeGreaterThan(step);
    expect(output).toContain(
      "✓ features/feature-hooks-green.feature > feature hooks green > runs between the feature hooks",
    );
  });
});
