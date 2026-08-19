import { describe, expect, test } from "vitest";
import type { StepModel } from "../../model/types.js";
import { formatConstructorFailure } from "./format-constructor-failure.js";

describe("formatConstructorFailure", () => {
  test("should name the class and preserve the original message verbatim", () => {
    const step: StepModel = {
      column: 5,
      hasArgument: false,
      line: 4,
      text: "an oct key",
      type: "Context",
    };

    const message = formatConstructorFailure({
      className: "AesEncryptionSteps",
      message: "no kms configured",
      remaining: 2,
      step,
      uri: "src/features/aes.feature",
    });

    expect(message).toContain("Binding class AesEncryptionSteps constructor threw");
    expect(message).toContain("  Given an oct key");
    expect(message).toContain("at src/features/aes.feature:4:5");
    expect(message).toContain("no kms configured");
    expect(message).toContain("The remaining 2 steps in this scenario were skipped.");
    expect(message).toMatchSnapshot();
  });
});
