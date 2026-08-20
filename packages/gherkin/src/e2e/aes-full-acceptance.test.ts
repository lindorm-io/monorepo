import { beforeAll, describe, expect, test } from "vitest";
import { runMetaFixture } from "./__fixtures__/spawn-vitest.js";

const SNIPPET = [
  '  @Given("an oct key with algorithm {string} and encryption {string}")',
  "  anOctKeyWithAlgorithmAndEncryption(string: string, string2: string): void {",
  "    throw new PendingStepError();",
  "  }",
].join("\n");

/**
 * THE M3 EXIT CRITERION (§7): the full §3.1 AES feature — Background, custom
 * {algorithm}/{encryption}/{aad} parameter types, record mode — goes
 * red-to-green on real @lindorm/aes: 5 Undefined-step failures against an
 * empty registry (Background merges into every pickle, so all 5 halt at its
 * Given), then exactly 5 passing round trips. The third fixture alters ONE
 * Examples row to an unknown encryption and pins conversion_failed on real
 * aes — the §4 taxonomy demo.
 */
describe("meta-suite: aes full acceptance", () => {
  describe("red — the feature with no step definitions", () => {
    let output = "";
    let testFiles = "";
    let tests = "";

    beforeAll(() => {
      const result = runMetaFixture("aes-full-red");
      output = result.output;
      testFiles = result.summary.testFiles;
      tests = result.summary.tests;
    }, 180_000);

    test("should fail all 5 pickles in the printed counts — 1 Example + 3 Outline rows + 1 record-mode Example", () => {
      expect(tests).toBe("5 failed (5)");
      expect(testFiles).toBe("1 failed (1)");
    });

    test("should report every pickle as an undefined step", () => {
      const annotations = output
        .split("\n")
        .filter((line) => line.includes("→ Undefined step"));

      expect(annotations).toHaveLength(5);

      // The detail section prints 2 blocks, not 5: all pickles fail at the
      // SAME Background Given, and vitest groups byte-identical errors — the
      // 4-step pickles share one block ("remaining 3"), the 3-step default
      // mode gets its own ("remaining 2").
      const blocks = output
        .split("\n")
        .filter((line) => line.startsWith("GherkinError: Undefined step"));

      expect(blocks).toHaveLength(2);
    });

    test("should print the pasteable snippet for the Background step, built-ins only", () => {
      expect(output).toContain("No step definition matched. Implement it:");
      expect(output).toContain(SNIPPET);
    });

    test("should anchor every pickle to the Background Given — each halts at its first step", () => {
      expect(output).toContain(
        '  Given an oct key with algorithm "A128KW" and encryption "A128GCM"\n  at features/aes-content-encryption.feature:4:5',
      );
    });

    test("should suggest NO custom parameter types — the generator knows only built-ins", () => {
      // No steps module loads in the red run, so {algorithm}/{encryption}
      // cannot appear in any snippet (generate-snippet.ts reads the registry).
      expect(output).not.toContain("{algorithm}");
      expect(output).not.toContain("{encryption}");
    });

    test("should print no snippet for the record-mode steps — the scenario halts at the Background step", () => {
      expect(output).not.toContain("in record mode");
    });
  });

  describe("green — the same feature with real step definitions", () => {
    let output = "";
    let testFiles = "";
    let tests = "";

    beforeAll(() => {
      const result = runMetaFixture("aes-full-green");
      output = result.output;
      testFiles = result.summary.testFiles;
      tests = result.summary.tests;
    }, 180_000);

    test("should pass exactly 5 tests — THE MILESTONE GATE", () => {
      expect(tests).toBe("5 passed (5)");
      expect(testFiles).toBe("1 passed (1)");
    });

    test("should print all 5 pickles as passing, nested Feature > Rule", () => {
      expect(output).toContain(
        "✓ features/aes-content-encryption.feature > AES content encryption > a round trip preserves the content > default mode",
      );
      expect(
        output
          .split("\n")
          .filter((line) =>
            line.includes(
              "✓ features/aes-content-encryption.feature > AES content encryption > a round trip preserves the content > every content encryption round-trips",
            ),
          ),
      ).toHaveLength(3);
      expect(output).toContain(
        "✓ features/aes-content-encryption.feature > AES content encryption > record mode binds the caller-supplied AAD > the bound AAD must be re-supplied",
      );
    });

    test("should report no failure anywhere in the run", () => {
      expect(output).not.toContain("failed");
      expect(output).not.toContain("FAIL");
    });
  });

  describe("conversion red — one Examples row altered to an unknown encryption", () => {
    let output = "";
    let testFiles = "";
    let tests = "";

    beforeAll(() => {
      const result = runMetaFixture("aes-full-conversion-red");
      output = result.output;
      testFiles = result.summary.testFiles;
      tests = result.summary.tests;
    }, 180_000);

    test("should fail ONLY the altered row — the other 4 pickles stay green", () => {
      expect(tests).toBe("1 failed | 4 passed (5)");
      expect(testFiles).toBe("1 failed (1)");
    });

    test("should report the row as conversion_failed, anchored with the transform's declaration site", () => {
      expect(output).toContain(
        [
          "Step argument conversion failed",
          "",
          '  Given an oct key with algorithm "A128KW" and encryption "A999GCM"',
          "  at features/aes-content-encryption.feature:13:7",
          "",
          'Parameter {encryption} could not convert "A999GCM"',
          "  AesContentEncryptionSteps.encryption (/steps/aes-content-encryption.steps.ts)",
          '  unknown content encryption "A999GCM"',
          "",
          "The step matched — the argument did not convert.",
          "",
          "The remaining 2 steps in this scenario were skipped.",
        ].join("\n"),
      );
      expect(output).toContain("code: 'conversion_failed'");
    });

    test("should keep the record-mode pickle green — the failure never leaks across scenarios", () => {
      expect(output).toContain(
        "✓ features/aes-content-encryption.feature > AES content encryption > record mode binds the caller-supplied AAD > the bound AAD must be re-supplied",
      );
    });
  });
});
