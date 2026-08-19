import { describe, expect, test } from "vitest";
import type { StepModel } from "../../model/types.js";
import { formatAnchor } from "./format-anchor.js";
import { formatConstructorFailure } from "./format-constructor-failure.js";
import { formatStepAnchor } from "./format-step-anchor.js";

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
      anchor: formatStepAnchor(step, "src/features/aes.feature"),
      className: "AesEncryptionSteps",
      message: "no kms configured",
      remaining: 2,
    });

    expect(message).toContain("Binding class AesEncryptionSteps constructor threw");
    expect(message).toContain("  Given an oct key");
    expect(message).toContain("at src/features/aes.feature:4:5");
    expect(message).toContain("no kms configured");
    expect(message).toContain("The remaining 2 steps in this scenario were skipped.");
    expect(message).toMatchSnapshot();
  });

  test("should carry a scenario anchor for the eager hook-class path", () => {
    // The eager construction path has no step — every hook-declaring class is
    // constructed before the first step runs (run-scenario.ts), so the
    // failure anchors to the scenario itself.
    const message = formatConstructorFailure({
      anchor: formatAnchor("hooks bracket the steps", "src/features/aes.feature", 3, 3),
      className: "LifecycleSteps",
      message: "no fixture store",
      remaining: 3,
    });

    expect(message).toContain("Binding class LifecycleSteps constructor threw");
    expect(message).toContain("  hooks bracket the steps");
    expect(message).toContain("at src/features/aes.feature:3:3");
    expect(message).toMatchSnapshot();
  });
});
