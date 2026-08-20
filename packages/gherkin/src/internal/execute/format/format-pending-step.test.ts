import { describe, expect, test } from "vitest";
import type { StepModel } from "../../model/types.js";
import { formatPendingStep } from "./format-pending-step.js";

describe("formatPendingStep", () => {
  test("should name the step, its anchor and the pending class.method", () => {
    const step: StepModel = {
      column: 5,
      line: 7,
      text: 'I encrypt "hello"',
      type: "Action",
    };

    const message = formatPendingStep({
      className: "AesEncryptionSteps",
      methodName: "iEncrypt",
      remaining: 1,
      step,
      uri: "src/features/aes.feature",
    });

    expect(message).toContain("Pending step");
    expect(message).toContain("at src/features/aes.feature:7:5");
    expect(message).toContain(
      "AesEncryptionSteps.iEncrypt is pending — implement its body.",
    );
    expect(message).toContain("The remaining 1 step in this scenario was skipped.");
    expect(message).toMatchSnapshot();
  });
});
