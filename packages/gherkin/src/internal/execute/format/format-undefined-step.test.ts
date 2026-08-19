import { describe, expect, test } from "vitest";
import type { StepModel } from "../../model/types.js";
import { formatUndefinedStep } from "./format-undefined-step.js";

const step: StepModel = {
  column: 5,
  hasArgument: false,
  line: 12,
  text: 'I encrypt "secret" in record mode with aad "tenant-1"',
  type: "Action",
};

const snippet = [
  '@When("I encrypt {string} in record mode with aad {string}")',
  "iEncryptInRecordModeWithAad(string: string, string2: string): void {",
  "  throw new PendingStepError();",
  "}",
].join("\n");

describe("formatUndefinedStep", () => {
  test("should render the failure-contract layout", () => {
    const message = formatUndefinedStep({
      remaining: 2,
      snippet,
      step,
      uri: "src/features/aes-encryption.feature",
    });

    expect(message).toContain("Undefined step");
    expect(message).toContain("at src/features/aes-encryption.feature:12:5");
    expect(message).toContain("No step definition matched. Implement it:");
    expect(message).toContain("  throw new PendingStepError();");
    expect(message).toContain("The remaining 2 steps in this scenario were skipped.");
    expect(message).toMatchSnapshot();
  });

  test("should omit the skipped line for the last step", () => {
    const message = formatUndefinedStep({
      remaining: 0,
      snippet,
      step,
      uri: "src/features/aes-encryption.feature",
    });

    expect(message).not.toContain("skipped");
    expect(message).toMatchSnapshot();
  });
});
