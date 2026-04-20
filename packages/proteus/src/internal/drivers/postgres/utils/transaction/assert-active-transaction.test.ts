import { PostgresTransactionError } from "../../errors/PostgresTransactionError";
import type { PostgresTransactionHandle } from "../../types/postgres-transaction-handle";
import { assertActiveTransaction } from "./assert-active-transaction";
import { describe, expect, it, vi } from "vitest";

const makeHandle = (
  state: PostgresTransactionHandle["state"] = "active",
): PostgresTransactionHandle => ({
  client: { query: vi.fn() },
  release: vi.fn(),
  state,
  savepointCounter: 0,
});

describe("assertActiveTransaction", () => {
  it("should not throw when state is active", () => {
    expect(() => assertActiveTransaction(makeHandle("active"))).not.toThrow();
  });

  it("should throw PostgresTransactionError when state is committed", () => {
    expect(() => assertActiveTransaction(makeHandle("committed"))).toThrow(
      PostgresTransactionError,
    );
    expect(() => assertActiveTransaction(makeHandle("committed"))).toThrow(
      "Transaction is already committed",
    );
  });

  it("should throw PostgresTransactionError when state is rolledback", () => {
    expect(() => assertActiveTransaction(makeHandle("rolledback"))).toThrow(
      PostgresTransactionError,
    );
    expect(() => assertActiveTransaction(makeHandle("rolledback"))).toThrow(
      "Transaction is already rolledback",
    );
  });
});
