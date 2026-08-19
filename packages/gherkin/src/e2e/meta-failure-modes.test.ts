import { beforeAll, describe, expect, test } from "vitest";
import { runMetaFixture } from "./__fixtures__/spawn-vitest.js";

/**
 * §0's mandatory end-to-end meta-suite: one child `vitest run` over the
 * failure-modes fixture directory, asserting the PRINTED counts and reporter
 * text — an empty suite is a collection error invisible in the counts, so
 * only the child's own printed output proves a scenario actually ran (or
 * actually went red). Coverage is NOT discharged here (a child reports no V8
 * coverage to the parent); every branch stays unit-covered in-process.
 */
describe("meta-suite: failure modes", () => {
  let output = "";
  let testFiles = "";
  let tests = "";

  beforeAll(() => {
    const result = runMetaFixture("failure-modes");
    output = result.output;
    testFiles = result.summary.testFiles;
    tests = result.summary.tests;
  }, 180_000);

  test("should print exact totals — every failure mode is IN the counts", () => {
    // 12 failed = undefined 1 + ambiguous 1 + pending 1 + conversion 2 +
    // constructor 1 + async 1 + empty-examples 1 + empty-scenario 1 +
    // step-argument 2 + parse-error 1; 4 passed = green 3 + conversion
    // control 1.
    expect(tests).toBe("12 failed | 4 passed (16)");
  });

  test("should print exact file totals — skipped files are skipped, not failed", () => {
    // 13 files: the 10 failed and 1 passed are enumerated by name below, so
    // the remaining 2 (background-only + empty file) must be the skipped.
    expect(testFiles).toBe("10 failed | 1 passed | 2 skipped (13)");
  });

  test("should report an undefined step with anchor, snippet and skipped count", () => {
    expect(output).toContain(
      [
        "Undefined step",
        "",
        '  When I frobnicate "twice"',
        "  at features/undefined-step.feature:4:5",
        "",
        "No step definition matched. Implement it:",
        "",
        '  @When("I frobnicate {string}")',
        "  iFrobnicate(string: string): void {",
        "    throw new PendingStepError();",
        "  }",
        "",
        "The remaining 2 steps in this scenario were skipped.",
      ].join("\n"),
    );
  });

  test("should report an ambiguous step with both candidates as authored", () => {
    expect(output).toContain(
      [
        "Ambiguous step",
        "",
        "  Given a duplicated step",
        "  at features/ambiguous-step.feature:4:5",
        "",
        "2 step definitions matched:",
        '  DuplicatedAlpha.aDuplicatedStep     @Given("a duplicated step")',
        "    at /steps/failure-modes.steps.ts",
        '  DuplicatedBeta.alsoADuplicatedStep  @When("a duplicated step")',
        "    at /steps/failure-modes.steps.ts",
        "",
        "Remove one, or make the expressions disjoint.",
      ].join("\n"),
    );
  });

  test("should report a pending step as red, naming the definition", () => {
    expect(output).toContain(
      [
        "Pending step",
        "",
        "  Given a pending step",
        "  at features/pending-step.feature:4:5",
        "",
        "PendingSteps.aPendingStep is pending — implement its body.",
      ].join("\n"),
    );
  });

  test("should report a throwing sync transform as conversion_failed with the declaration site", () => {
    expect(output).toContain(
      [
        "Step argument conversion failed",
        "",
        '  Given a failing value "boom"',
        "  at features/conversion-failure.feature:4:5",
        "",
        'Parameter {failing} could not convert "boom"',
        "  ConversionSteps.failing (/steps/failure-modes.steps.ts)",
        '  no such value "boom"',
        "",
        "The step matched — the argument did not convert.",
      ].join("\n"),
    );
  });

  test("should report a rejecting async transform as conversion_failed", () => {
    expect(output).toContain(
      [
        'Parameter {rejecting} could not convert "kaboom"',
        "  ConversionSteps.rejecting (/steps/failure-modes.steps.ts)",
        '  rejected value "kaboom"',
      ].join("\n"),
    );
  });

  test("should NOT run a step body whose argument transform rejected — arguments are awaited first", () => {
    // The end-to-end ORDER proof: the step body prints a sentinel line, and
    // that line must be absent from the child's whole output.
    expect(output).not.toContain("META_SENTINEL_REJECTING_BODY_RAN");
    expect(output).not.toContain("META_SENTINEL_FAILING_BODY_RAN");
  });

  test("should run the step body once its async transform resolves — the sentinel channel works", () => {
    // The control that keeps the absence assertions honest: the same channel
    // DOES fire when conversion succeeds, transformed value included.
    expect(output).toContain("META_SENTINEL_CONVERTED_FINE");
  });

  test("should fail the scenario when the binding-class constructor throws, anchored to the class", () => {
    expect(output).toContain(
      "× features/constructor-throw.feature > binding constructor failure > a step whose binding class cannot construct",
    );
    expect(output).toContain(
      [
        "Binding class ThrowingConstructorSteps constructor threw",
        "",
        "  Given a step in a throwing class",
        "  at features/constructor-throw.feature:4:5",
        "",
        "no fixture store configured",
        "",
        "The remaining 1 step in this scenario was skipped.",
      ].join("\n"),
    );
  });

  test("should fail the SCENARIO in the printed counts when an async step rejects after a tick", () => {
    expect(output).toContain(
      "× features/async-step.feature > async step failure > a rejecting async step fails the scenario",
    );
    expect(output).toContain(
      [
        "Step failed",
        "",
        "  When an async step rejects after a tick",
        "  at features/async-step.feature:4:5",
        "",
        "rejected after a tick",
      ].join("\n"),
    );
  });

  test("should never mask a failure as an unhandled-rejection side note", () => {
    // dangerouslyIgnoreUnhandledErrors is explicitly false in the child; a
    // masked rejection would print an "Unhandled Error"/"Unhandled Rejection"
    // section instead of failing inside the counts.
    expect(output).not.toContain("Unhandled");
  });

  test("should fail a zero-row Examples table, anchored to the Examples line", () => {
    expect(output).toContain(
      [
        "Empty Examples table",
        "",
        "  a table with no rows",
        "  at features/empty-examples.feature:6:5",
      ].join("\n"),
    );
  });

  test("should fail a zero-step scenario — the manufactured-green case is RED in the counts", () => {
    expect(output).toContain(
      "× features/empty-scenario.feature > empty scenario reporting > a scenario with no steps",
    );
    expect(output).toContain(
      [
        "Empty scenario",
        "",
        "  a scenario with no steps",
        "  at features/empty-scenario.feature:3:3",
      ].join("\n"),
    );
  });

  test("should fail a DocString-bearing and a DataTable-bearing step", () => {
    expect(output).toContain(
      [
        "Step argument not supported",
        "",
        "  Given a documented step",
        "  at features/step-argument.feature:4:5",
      ].join("\n"),
    );
    expect(output).toContain(
      [
        "Step argument not supported",
        "",
        "  Given a tabulated step",
        "  at features/step-argument.feature:10:5",
      ].join("\n"),
    );
  });

  test("should report a parse error as a failing TEST with an anchored parser message", () => {
    // A failing test, not a bare collection error — the file contributes to
    // the counts and carries the parser's own uri:line:column anchor.
    expect(output).toContain("× features/parse-error.feature > gherkin parse error");
    expect(output).toContain(
      [
        "Failed to parse feature file",
        "",
        "  (1:1): expected: #EOF, #Language, #TagLine, #FeatureLine, #Comment, #Empty, got 'this line is not gherkin'",
        "  at features/parse-error.feature:1:1",
      ].join("\n"),
    );
  });

  test("should not count the skipped feature files as failures", () => {
    // Neither skipped file may appear as a test result line or FAIL entry;
    // together with the "2 skipped" file total this pins the skipped-suite
    // fallback for a Background-only feature and an empty feature file.
    expect(output).not.toContain("skipped-background-only.feature >");
    expect(output).not.toContain("skipped-empty.feature >");
  });

  test("should run the green feature's scenarios — printed tests equal pickles", () => {
    // 3 pickles (1 Example + 2 Outline rows, Background merged into each)
    // must surface as EXACTLY 3 printed passing tests, nested
    // Feature > Rule — the structural invariant's happy side.
    const lines = output
      .split("\n")
      .filter((line) => line.includes("✓ features/green.feature"));

    expect(lines).toHaveLength(3);
    expect(output).toContain(
      "✓ features/green.feature > green multi scenario > increments accumulate > a single bump",
    );
    expect(lines.filter((line) => line.includes("> bumps of every size"))).toHaveLength(
      2,
    );
  });
});
