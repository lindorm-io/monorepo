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
    // 13 failed = undefined 1 + ambiguous 1 + pending 1 + conversion 2 +
    // constructor 1 + async 1 + empty-examples 1 + empty-scenario 1 +
    // data-conversion 3 + parse-error 1; 9 passed = green 3 + conversion
    // control 1 + data-delivery 5.
    expect(tests).toBe("13 failed | 9 passed (22)");
  });

  test("should print exact file totals — skipped files are skipped, not failed", () => {
    // 14 files: the 10 failed and 2 passed are enumerated by name below, so
    // the remaining 2 (background-only + empty file) must be the skipped.
    expect(testFiles).toBe("10 failed | 2 passed | 2 skipped (14)");
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

  test("should pass the trailing slot at STABLE ARITY — undefined when no argument", () => {
    // The §3.6 arity pin: a slotless step's rest parameters see exactly ONE
    // argument, the undefined slot. A runner that filters the absent slot
    // out (the @amiceli bug) prints _0_ and goes red here.
    expect(output).toContain("META_SENTINEL_SLOT_1_undefined");
  });

  test("should deliver a DocString verbatim with its media type", () => {
    expect(output).toContain("META_SENTINEL_DOC_markdown_# Title ${not_code}|body line");
  });

  test("should deliver a typed createSet — zod coerced the string cells to numbers", () => {
    // Unquoted prices prove the coercion; quoting them would mean the raw
    // strings leaked through.
    expect(output).toContain(
      'META_SENTINEL_SET_[{"name":"apple","price":3},{"name":"pear","price":4}]',
    );
  });

  test("should create ONE typed object from a one-row table", () => {
    expect(output).toContain('META_SENTINEL_CREATE_{"name":"fig","price":5}');
  });

  test("should substitute Examples values into table CELLS", () => {
    expect(output).toContain("META_SENTINEL_CELL_substituted");
  });

  test("should run the data-delivery scenarios green in the printed counts", () => {
    const lines = output
      .split("\n")
      .filter((line) => line.includes("✓ features/data-delivery.feature"));

    expect(lines).toHaveLength(5);
  });

  test("should fail a sync parse of an async schema with zod's fix-naming message VERBATIM", () => {
    // The locked §3.6 mechanism end to end: the message must survive
    // untouched, anchored to the step.
    expect(output).toContain(
      [
        "Step failed",
        "",
        "  Given an async schema parsed synchronously",
        "  at features/data-conversion.feature:4:5",
        "",
        "Encountered Promise during synchronous parse. Use .parseAsync() instead.",
      ].join("\n"),
    );
    expect(output).not.toContain("META_SENTINEL_ASYNC_SCHEMA_CONTINUED");
  });

  test("should fail a violating createSet as table_conversion_failed with the anchor and zod's issues", () => {
    expect(output).toContain(
      [
        "Step failed",
        "",
        "  Given a violating catalog",
        "  at features/data-conversion.feature:9:5",
        "",
        "Data table body row 1 failed schema conversion",
      ].join("\n"),
    );
    // zod's issue details stay visible in the reporter text...
    expect(output).toContain("Invalid input: expected number, received NaN");
    // ...and the taxonomy code in the Serialized Error block (vitest omits
    // `type`, so the code is the reporter-visible taxonomy signal).
    expect(output).toContain("code: 'table_conversion_failed'");
    expect(output).not.toContain("META_SENTINEL_VIOLATING_CONTINUED");
  });

  test("should fail create() on a multi-row table loudly — never silent truncation", () => {
    expect(output).toContain(
      [
        "Step failed",
        "",
        "  Given a created product",
        "  at features/data-conversion.feature:14:5",
        "",
        "create() converts exactly one body row — this table has 2. Use createSet() for multi-row tables.",
      ].join("\n"),
    );
    expect(output).not.toContain("META_SENTINEL_CREATE_MULTI_CONTINUED");
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
