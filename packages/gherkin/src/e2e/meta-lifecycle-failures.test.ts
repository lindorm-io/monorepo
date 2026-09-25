import { beforeAll, describe, expect, test } from "vitest";
import { runMetaFixture } from "./__fixtures__/spawn-vitest.js";

/**
 * The scenario-level half of §4's lifecycle table, proven at reporter level:
 * one child `vitest run` over the lifecycle-failures fixture, asserting the
 * PRINTED counts, the anchored failure messages and the stdout sentinels —
 * presence proves a hook/step/dispose() ran, absence (beside a control on the
 * same channel) proves it never ran. Feature hooks live in meta-lifecycle;
 * coverage is NOT discharged here — every branch stays unit-covered
 * in-process (run-scenario.lifecycle.test.ts, create-scenario-container.ts
 * tests).
 */
describe("meta-suite: lifecycle failures", () => {
  let output = "";
  let testFiles = "";
  let tests = "";

  beforeAll(() => {
    const result = runMetaFixture("lifecycle-failures");
    output = result.output;
    testFiles = result.summary.testFiles;
    tests = result.summary.tests;
  }, 180_000);

  test("should print exact totals — every scenario-level throw stage is IN the counts", () => {
    // 7 failed = before-scenario 1 + context-constructor 1 + before-step 1 +
    // after-step 1 + after-scenario 1 + dispose 2; 2 passed = tag-filter
    // control + hook ordering.
    expect(tests).toBe("7 failed | 2 passed (9)");
    expect(testFiles).toBe("6 failed | 2 passed (8)");
  });

  test("should fail a @BeforeScenario throw with the scenario-anchored hook message", () => {
    expect(output).toContain(
      "× features/before-scenario-throw.feature > before-scenario throw > steps never run but teardown does",
    );
    expect(output).toContain(
      [
        "@BeforeScenario hook failed",
        "",
        "  BeforeScenarioBoom.brokenSeed",
        "  at features/before-scenario-throw.feature:4:3",
        "",
        "seed store offline",
        "",
        "The remaining 2 steps in this scenario were skipped.",
      ].join("\n"),
    );
  });

  test("should never run the steps of a scenario whose @BeforeScenario threw", () => {
    expect(output).not.toContain("META_SENTINEL_BEFORE_BOOM_STEP_ONE");
    expect(output).not.toContain("META_SENTINEL_BEFORE_BOOM_STEP_TWO");
  });

  test("should still run @AfterScenario and dispose() after a @BeforeScenario throw — teardown always unwinds", () => {
    // The after-hook observes the scenario's own failure as its argument.
    expect(output).toContain("META_SENTINEL_BEFORE_BOOM_AFTER_SCENARIO failed");
    expect(output).toContain("META_SENTINEL_BEFORE_BOOM_DISPOSED");
  });

  test("should fail a throwing @Context constructor anchored to the TOKEN class", () => {
    expect(output).toContain(
      "× features/context-constructor-throw.feature > context constructor throw > a step demanding a broken context",
    );
    expect(output).toContain(
      [
        "Context class BrokenCtorContext constructor threw",
        "",
        "no backing store configured",
      ].join("\n"),
    );
    expect(output).not.toContain("META_SENTINEL_CTOR_BOOM_BODY");
  });

  test("should fail a @BeforeStep throw without running the step body, with the remaining count", () => {
    expect(output).toContain(
      "× features/before-step-throw.feature > before-step throw > the guarded step body never runs",
    );
    expect(output).toContain(
      [
        "@BeforeStep hook failed",
        "",
        "  BeforeStepBoom.brokenBefore",
        "",
        "  Given a guarded step",
        "  at features/before-step-throw.feature:5:5",
        "",
        'lock unavailable for "a guarded step"',
        "",
        "The remaining 1 step in this scenario was skipped.",
      ].join("\n"),
    );
    expect(output).not.toContain("META_SENTINEL_STEP_BEFORE_BOOM_BODY");
    expect(output).not.toContain("META_SENTINEL_STEP_BEFORE_BOOM_TRAILING");
  });

  test("should run the @AfterStep hook even though @BeforeStep failed — cucumber parity, observing the failure", () => {
    // Exactly once: the failed first step is the only DISPATCHED one — the
    // skipped trailing step runs no hooks.
    expect(
      output.match(/META_SENTINEL_STEP_BEFORE_BOOM_AFTER_STEP failed/g),
    ).toHaveLength(1);
  });

  test("should fail the scenario on an @AfterStep throw even though the step passed", () => {
    expect(output).toContain(
      "× features/after-step-throw.feature > after-step throw > the step passes yet the scenario is red",
    );
    // The step body RAN and the hook observed it as passed — the red comes
    // from the hook alone.
    expect(output).toContain("META_SENTINEL_STEP_AFTER_BOOM_BODY");
    expect(output).toContain("META_SENTINEL_STEP_AFTER_BOOM_OBSERVED passed");
    expect(output).toContain(
      [
        "@AfterStep hook failed",
        "",
        "  AfterStepBoom.brokenAfter",
        "",
        "  Given a recorded passing step",
        "  at features/after-step-throw.feature:5:5",
        "",
        "report upload failed",
      ].join("\n"),
    );
  });

  test("should fail the scenario on an @AfterScenario throw and still dispose", () => {
    expect(output).toContain(
      "× features/after-scenario-throw.feature > after-scenario throw > teardown flake reddens a passing scenario",
    );
    expect(output).toContain("META_SENTINEL_AFTER_BOOM_STEP");
    expect(output).toContain(
      [
        "@AfterScenario hook failed",
        "",
        "  AfterScenarioBoom.brokenTeardown",
        "  at features/after-scenario-throw.feature:4:3",
        "",
        "teardown flake",
      ].join("\n"),
    );
    expect(output).toContain("META_SENTINEL_AFTER_BOOM_DISPOSED");
  });

  test("should fail a scenario whose ONLY failure is dispose(), continuing through the remaining contexts", () => {
    expect(output).toContain(
      "× features/dispose-throw.feature > disposal throw > disposal continues past the throwing context",
    );
    expect(output).toContain(
      [
        "Context class DisposeAlphaContext dispose() threw",
        "",
        "socket already closed",
      ].join("\n"),
    );
    // Whole lines, not substrings — the reporter's code frame quotes the
    // sentinel() call, which a bare substring count would include. Both
    // scenarios in the feature construct both contexts; ALPHA throws in each,
    // and BETA still disposes each time — disposal continues.
    const lines = output.split("\n");

    expect(lines.filter((line) => line === "META_SENTINEL_DISPOSE_ALPHA")).toHaveLength(
      2,
    );
    expect(lines.filter((line) => line === "META_SENTINEL_DISPOSE_BETA")).toHaveLength(2);
    // Reverse construction order: the dependent disposes before what it
    // injects.
    expect(lines.indexOf("META_SENTINEL_DISPOSE_ALPHA")).toBeLessThan(
      lines.indexOf("META_SENTINEL_DISPOSE_BETA"),
    );
  });

  test("should append the disposal failure with its code after a primary step failure", () => {
    expect(output).toContain(
      "× features/dispose-throw.feature > disposal throw > a step failure stays primary and the disposal failure appends",
    );
    expect(output).toContain(
      [
        "primary step failure",
        "",
        "1 additional failure followed the one above:",
        "",
        "  1) disposal_failed",
        "",
        "     Context class DisposeAlphaContext dispose() threw",
        "",
        "     socket already closed",
      ].join("\n"),
    );
  });

  test("should never run a hook whose tag expression matches nothing — with a matching control on the same channel", () => {
    expect(output).not.toContain("META_SENTINEL_TAG_FILTERED_HOOK");
    expect(output).toContain("META_SENTINEL_TAG_CONTROL_HOOK");
    expect(output).toContain(
      "✓ features/tag-filtered-hooks.feature > tag-filtered hooks > only the matching hook runs",
    );
  });

  test("should run hooks in priority order and unwind every After* kind in reverse, across two classes", () => {
    expect(output).toContain(
      "META_ORDER before:alpha>before:beta>before-step:alpha>before-step:beta>step>after-step:beta>after-step:alpha>after:beta>after:alpha",
    );
    expect(output).toContain(
      "✓ features/hook-ordering.feature > hook ordering > hooks run in priority order and unwind in reverse",
    );
  });
});
