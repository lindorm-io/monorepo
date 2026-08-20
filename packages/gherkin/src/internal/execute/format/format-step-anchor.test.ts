import { describe, expect, test } from "vitest";
import type { StepModel } from "../../model/types.js";
import { formatStepAnchor } from "./format-step-anchor.js";

describe("formatStepAnchor", () => {
  test("should render the resolved keyword, text and position", () => {
    const step: StepModel = {
      column: 5,
      line: 12,
      text: 'I encrypt "secret"',
      type: "Action",
    };

    expect(formatStepAnchor(step, "src/features/aes.feature")).toBe(
      '  When I encrypt "secret"\n  at src/features/aes.feature:12:5',
    );
  });

  test("should render * for an Unknown step", () => {
    const step: StepModel = {
      column: 5,
      line: 9,
      text: "a wildcard",
      type: "Unknown",
    };

    expect(formatStepAnchor(step, "src/features/aes.feature")).toBe(
      "  * a wildcard\n  at src/features/aes.feature:9:5",
    );
  });
});
