import { isRetryableMongoError } from "./is-retryable-mongo-error";
import { describe, expect, test } from "vitest";

describe("isRetryableMongoError", () => {
  test("should return true for TransientTransactionError label", () => {
    const error = { errorLabels: ["TransientTransactionError"] };
    expect(isRetryableMongoError(error)).toBe(true);
  });

  test("should return true when TransientTransactionError is among multiple labels", () => {
    const error = {
      errorLabels: ["UnknownTransactionCommitResult", "TransientTransactionError"],
    };
    expect(isRetryableMongoError(error)).toBe(true);
  });

  test("should return false for non-transient error labels", () => {
    const error = { errorLabels: ["UnknownTransactionCommitResult"] };
    expect(isRetryableMongoError(error)).toBe(false);
  });

  test("should return false for empty error labels", () => {
    const error = { errorLabels: [] };
    expect(isRetryableMongoError(error)).toBe(false);
  });

  test("should return false for null", () => {
    expect(isRetryableMongoError(null)).toBe(false);
  });

  test("should return false for undefined", () => {
    expect(isRetryableMongoError(undefined)).toBe(false);
  });

  test("should return false for non-object", () => {
    expect(isRetryableMongoError("error")).toBe(false);
    expect(isRetryableMongoError(42)).toBe(false);
  });

  test("should return false for object without errorLabels", () => {
    expect(isRetryableMongoError({ message: "fail" })).toBe(false);
  });

  test("should use hasErrorLabel method as fallback", () => {
    const error = {
      hasErrorLabel: (label: string) => label === "TransientTransactionError",
    };
    expect(isRetryableMongoError(error)).toBe(true);
  });

  test("should return false when hasErrorLabel returns false", () => {
    const error = {
      hasErrorLabel: () => false,
    };
    expect(isRetryableMongoError(error)).toBe(false);
  });
});
