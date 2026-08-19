import { describe, expect, test } from "vitest";
import { PENDING_STEP_BRAND } from "../internal/metadata/symbols.js";
import { PendingStepError } from "./PendingStepError.js";
import { isPendingStepError } from "./is-pending-step-error.js";

describe("isPendingStepError", () => {
  test("should detect an instance of this package's class", () => {
    expect(isPendingStepError(new PendingStepError())).toBe(true);
  });

  test("should detect a branded error from a SECOND installed copy of the package", () => {
    // The dual-install shape: same Symbol.for brand, foreign prototype chain.
    const foreign = new Error("Step is not implemented");
    Object.defineProperty(foreign, PENDING_STEP_BRAND, { value: true });

    expect(foreign).not.toBeInstanceOf(PendingStepError);
    expect(isPendingStepError(foreign)).toBe(true);
  });

  test("should reject an unbranded error and non-objects", () => {
    expect(isPendingStepError(new Error("pending"))).toBe(false);
    expect(isPendingStepError("pending")).toBe(false);
    expect(isPendingStepError(undefined)).toBe(false);
    expect(isPendingStepError({ message: "pending" })).toBe(false);
  });
});
