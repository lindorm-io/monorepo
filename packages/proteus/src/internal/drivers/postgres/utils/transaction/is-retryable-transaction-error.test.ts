import { DeadlockError } from "../../../../errors/DeadlockError.js";
import { SerializationError } from "../../../../errors/SerializationError.js";
import { PostgresTransactionError } from "../../errors/PostgresTransactionError.js";
import { isRetryableTransactionError } from "./is-retryable-transaction-error.js";
import { describe, expect, it } from "vitest";

describe("isRetryableTransactionError", () => {
  it("should return true for SerializationError", () => {
    expect(
      isRetryableTransactionError(new SerializationError("serialization failure")),
    ).toBe(true);
  });

  it("should return true for DeadlockError", () => {
    expect(isRetryableTransactionError(new DeadlockError("deadlock detected"))).toBe(
      true,
    );
  });

  it("should return false for PostgresTransactionError", () => {
    expect(isRetryableTransactionError(new PostgresTransactionError("tx error"))).toBe(
      false,
    );
  });

  it("should return false for generic Error", () => {
    expect(isRetryableTransactionError(new Error("some error"))).toBe(false);
  });

  it("should return false for non-error values", () => {
    expect(isRetryableTransactionError("string error")).toBe(false);
    expect(isRetryableTransactionError(null)).toBe(false);
    expect(isRetryableTransactionError(undefined)).toBe(false);
    expect(isRetryableTransactionError(42)).toBe(false);
  });
});
