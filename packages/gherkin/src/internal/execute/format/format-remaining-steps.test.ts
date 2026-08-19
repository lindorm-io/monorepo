import { describe, expect, test } from "vitest";
import { formatRemainingSteps } from "./format-remaining-steps.js";

describe("formatRemainingSteps", () => {
  test("should omit the line entirely at zero remaining steps", () => {
    expect(formatRemainingSteps(0)).toBe("");
  });

  test("should use the singular at one remaining step", () => {
    expect(formatRemainingSteps(1)).toBe(
      "The remaining 1 step in this scenario was skipped.",
    );
  });

  test("should carry the real count in the plural", () => {
    expect(formatRemainingSteps(2)).toBe(
      "The remaining 2 steps in this scenario were skipped.",
    );
  });
});
