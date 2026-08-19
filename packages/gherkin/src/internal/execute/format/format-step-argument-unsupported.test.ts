import { describe, expect, test } from "vitest";
import type { StepModel } from "../../model/types.js";
import { formatStepArgumentUnsupported } from "./format-step-argument-unsupported.js";

describe("formatStepArgumentUnsupported", () => {
  test("should anchor to the step line and say support lands later", () => {
    const step: StepModel = {
      column: 5,
      hasArgument: true,
      line: 12,
      text: "the payload:",
      type: "Context",
    };

    const message = formatStepArgumentUnsupported({
      remaining: 3,
      step,
      uri: "src/features/aes.feature",
    });

    expect(message).toContain("Step argument not supported");
    expect(message).toContain("at src/features/aes.feature:12:5");
    expect(message).toContain("lands in a later milestone");
    expect(message).toContain("The remaining 3 steps in this scenario were skipped.");
    expect(message).toMatchSnapshot();
  });
});
