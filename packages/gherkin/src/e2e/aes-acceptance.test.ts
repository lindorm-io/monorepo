import { beforeAll, describe, expect, test } from "vitest";
import { runMetaFixture } from "./__fixtures__/spawn-vitest.js";

const SNIPPET = [
  '  @Given("an oct key with algorithm {string} and encryption {string}")',
  "  anOctKeyWithAlgorithmAndEncryption(string: string, string2: string): void {",
  "    throw new PendingStepError();",
  "  }",
].join("\n");

/**
 * THE M1 EXIT CRITERION (§7): the {string}-only AES feature, verbatim, goes
 * red-to-green — 4 Undefined-step failures with pasteable snippets against
 * an empty registry, then exactly 4 passing real @lindorm/aes round trips
 * once the pasted-and-implemented steps module exists.
 */
describe("meta-suite: aes acceptance", () => {
  describe("red — the feature with no step definitions", () => {
    let output = "";
    let testFiles = "";
    let tests = "";

    beforeAll(() => {
      const result = runMetaFixture("aes-red");
      output = result.output;
      testFiles = result.summary.testFiles;
      tests = result.summary.tests;
    }, 180_000);

    test("should fail all 4 scenarios in the printed counts — 1 Example + 3 Outline rows", () => {
      expect(tests).toBe("4 failed (4)");
      expect(testFiles).toBe("1 failed (1)");
    });

    test("should report every scenario as an undefined step", () => {
      const failures = output
        .split("\n")
        .filter((line) => line.startsWith("GherkinError: Undefined step"));

      expect(failures).toHaveLength(4);
    });

    test("should print the pasteable snippet for the oct-key step", () => {
      expect(output).toContain("No step definition matched. Implement it:");
      expect(output).toContain(SNIPPET);
    });

    test("should anchor each row to the feature file", () => {
      expect(output).toContain(
        '  Given an oct key with algorithm "A128KW" and encryption "A256CBC-HS512"\n  at features/aes-round-trip.feature:11:7',
      );
    });
  });

  describe("green — the same feature with real step definitions", () => {
    let output = "";
    let testFiles = "";
    let tests = "";

    beforeAll(() => {
      const result = runMetaFixture("aes-green");
      output = result.output;
      testFiles = result.summary.testFiles;
      tests = result.summary.tests;
    }, 180_000);

    test("should pass exactly 4 tests — THE MILESTONE GATE", () => {
      expect(tests).toBe("4 passed (4)");
      expect(testFiles).toBe("1 passed (1)");
    });

    test("should print all 4 scenarios as passing, nested Feature > Rule", () => {
      expect(output).toContain(
        "✓ features/aes-round-trip.feature > AES round trip > content survives a round trip > default mode",
      );
      expect(
        output
          .split("\n")
          .filter((line) =>
            line.includes(
              "✓ features/aes-round-trip.feature > AES round trip > content survives a round trip > every content encryption round-trips",
            ),
          ),
      ).toHaveLength(3);
    });

    test("should report no failure anywhere in the run", () => {
      expect(output).not.toContain("failed");
      expect(output).not.toContain("FAIL");
    });
  });
});
