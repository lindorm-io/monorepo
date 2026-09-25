import { beforeAll, describe, expect, test } from "vitest";
import { runMetaFixture } from "./__fixtures__/spawn-vitest.js";

/**
 * One child `vitest run` over a consumer whose pipeline lowers no decorators
 * — the meta-suite's only proof that the lowering guard reaches a real
 * consumer's terminal, since the in-package, example and every other child
 * run wires swc and so can only prove the guard stays silent.
 */
describe("meta-suite: no decorator lowering", () => {
  let output = "";
  let testFiles = "";
  let tests = "";

  beforeAll(() => {
    const result = runMetaFixture("no-lowering");
    output = result.output;
    testFiles = result.summary.testFiles;
    tests = result.summary.tests;
  }, 180_000);

  test("should refuse by naming the surviving decorator instead of letting a bare SyntaxError escape", () => {
    expect(output).toContain(
      "Step module steps/no-lowering.steps.ts still carries a stage-3 decorator after the transform pipeline ran.",
    );
    expect(output).not.toContain("SyntaxError: Invalid or unexpected token");
  });

  test("should state the requirement generically — a transform is needed, swc is the verified route, tsc works too", () => {
    expect(output).toContain("gherkin lowers nothing itself");
    expect(output).toContain("tsc's own __esDecorate lowering included");
    expect(output).toContain("`unplugin-swc`");
  });

  test("should anchor the refusal to the guard plugin and the step module", () => {
    expect(output).toContain("Plugin: lindorm-gherkin-lowering");
    expect(output).toContain("File: steps/no-lowering.steps.ts");
  });

  test("should print the refusal in the counts — one failed file, no tests", () => {
    expect(testFiles).toBe("1 failed (1)");
    expect(tests).toBe("no tests");
  });
});
