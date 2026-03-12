import { DeadlockError } from "#internal/errors/DeadlockError";
import { SerializationError } from "#internal/errors/SerializationError";
import { PostgresTransactionError } from "../../errors/PostgresTransactionError";
import { isRetryableTransactionError } from "./is-retryable-transaction-error";

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
