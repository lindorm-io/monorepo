import { describe, expect, test } from "vitest";
import type { StepModel } from "../../model/types.js";
import { formatConversionFailed } from "./format-conversion-failed.js";

const step: StepModel = {
  column: 5,
  hasArgument: false,
  line: 6,
  text: 'an oct key with encryption "A999GCM"',
  type: "Context",
};

describe("formatConversionFailed", () => {
  test("should anchor the failing transform for a custom parameter type", () => {
    const message = formatConversionFailed({
      causeMessage: 'unknown encryption "A999GCM"',
      declaration: {
        className: "AesTransforms",
        methodName: "encryption",
        modulePath: "src/steps/aes.steps.ts",
      },
      parameterTypeName: "encryption",
      raw: "A999GCM",
      remaining: 2,
      step,
      uri: "src/features/aes-encryption.feature",
    });

    expect(message).toContain("Step argument conversion failed");
    expect(message).toContain("at src/features/aes-encryption.feature:6:5");
    expect(message).toContain('Parameter {encryption} could not convert "A999GCM"');
    expect(message).toContain("AesTransforms.encryption (src/steps/aes.steps.ts)");
    expect(message).toContain('unknown encryption "A999GCM"');
    expect(message).toContain("The step matched — the argument did not convert.");
    expect(message).toContain("The remaining 2 steps in this scenario were skipped.");
    expect(message).toMatchSnapshot();
  });

  test("should omit the declaration line for a built-in parameter type", () => {
    const message = formatConversionFailed({
      causeMessage: "boom",
      declaration: undefined,
      parameterTypeName: "int",
      raw: "3",
      remaining: 0,
      step,
      uri: "src/features/aes-encryption.feature",
    });

    expect(message).toContain('Parameter {int} could not convert "3"\n  boom');
    expect(message).not.toContain("skipped");
    expect(message).toMatchSnapshot();
  });
});
