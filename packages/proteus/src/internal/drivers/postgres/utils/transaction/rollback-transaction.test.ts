import { PostgresTransactionError } from "../../errors/PostgresTransactionError";
import type { PostgresTransactionHandle } from "../../types/postgres-transaction-handle";
import { rollbackTransaction } from "./rollback-transaction";
import { describe, expect, it, vi, type Mock } from "vitest";

const makeHandle = (
  state: PostgresTransactionHandle["state"] = "active",
): PostgresTransactionHandle => ({
  client: { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) },
  release: vi.fn(),
  state,
  savepointCounter: 0,
});

describe("rollbackTransaction", () => {
  it("should issue ROLLBACK and set state to rolledback", async () => {
    const handle = makeHandle();

    await rollbackTransaction(handle);

    expect(handle.client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(handle.state).toBe("rolledback");
    expect(handle.release).toHaveBeenCalled();
  });

  it("should throw when transaction is not active", async () => {
    const handle = makeHandle("rolledback");

    await expect(rollbackTransaction(handle)).rejects.toThrow(PostgresTransactionError);
  });

  it("should release even when ROLLBACK query fails", async () => {
    const handle = makeHandle();
    (handle.client.query as Mock).mockRejectedValueOnce(new Error("network error"));

    await expect(rollbackTransaction(handle)).rejects.toThrow(PostgresTransactionError);
    expect(handle.release).toHaveBeenCalled();
  });

  // P3: when ROLLBACK throws, state must be "rolledback" — not left as "active"
  it("should set handle state to rolledback when ROLLBACK query throws", async () => {
    const handle = makeHandle();
    (handle.client.query as Mock).mockRejectedValueOnce(new Error("connection lost"));

    await expect(rollbackTransaction(handle)).rejects.toThrow();

    expect(handle.state).toBe("rolledback");
  });
});
