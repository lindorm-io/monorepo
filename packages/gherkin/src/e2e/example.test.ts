import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import type { MetaRunResult } from "./__fixtures__/spawn-vitest.js";
import { runVitestChild } from "./__fixtures__/spawn-vitest.js";

const EXAMPLE_DIRECTORY = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../example",
);

/**
 * The example/ folder mirrors the README quickstart; typechecking catches a
 * broken signature but not a broken behaviour, so the example is RUN as a
 * child and its printed counts pinned — a doc that stops working goes red.
 */
describe("meta-suite: example", () => {
  let result: MetaRunResult;

  beforeAll(() => {
    result = runVitestChild(EXAMPLE_DIRECTORY);
  }, 180_000);

  test("should pass all 4 scenarios — 2 Examples + 2 Outline rows", () => {
    expect(result.summary.tests).toBe("4 passed (4)");
    expect(result.summary.testFiles).toBe("1 passed (1)");
  });

  test("should run the custom-parameter-type scenario", () => {
    expect(result.output).toContain(
      "✓ features/greeting.feature > Greeting > greet shouting",
    );
  });
});
