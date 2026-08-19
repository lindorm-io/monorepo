import { describe, expect, test } from "vitest";
import type { StepModel } from "../../model/types.js";
import { formatStepFailure } from "./format-step-failure.js";

describe("formatStepFailure", () => {
  test("should prepend the step anchor and preserve the original message verbatim", () => {
    const step: StepModel = {
      column: 5,
      hasArgument: false,
      line: 8,
      text: 'decrypting returns "hello"',
      type: "Outcome",
    };

    const message = formatStepFailure({
      message: "expected 'goodbye' to be 'hello' // Object.is equality",
      remaining: 1,
      step,
      uri: "src/features/aes.feature",
    });

    expect(message).toContain("Step failed");
    expect(message).toContain('  Then decrypting returns "hello"');
    expect(message).toContain("at src/features/aes.feature:8:5");
    expect(message).toContain("expected 'goodbye' to be 'hello' // Object.is equality");
    expect(message).toContain("The remaining 1 step in this scenario was skipped.");
    expect(message).toMatchSnapshot();
  });
});
