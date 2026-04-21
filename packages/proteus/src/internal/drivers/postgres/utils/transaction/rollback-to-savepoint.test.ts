import { PostgresTransactionError } from "../../errors/PostgresTransactionError.js";
import type { PostgresTransactionHandle } from "../../types/postgres-transaction-handle.js";
import { rollbackToSavepoint } from "./rollback-to-savepoint.js";
import { describe, expect, it, vi, type Mock } from "vitest";

const makeHandle = (
  state: PostgresTransactionHandle["state"] = "active",
): PostgresTransactionHandle => ({
  client: { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) },
  release: vi.fn(),
  state,
  savepointCounter: 1,
});

describe("rollbackToSavepoint", () => {
  it("should issue ROLLBACK TO SAVEPOINT", async () => {
    const handle = makeHandle();

    await rollbackToSavepoint(handle, "sp_1");

    expect(handle.client.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT "sp_1"');
  });

  it("should throw when transaction is not active", async () => {
    const handle = makeHandle("committed");

    await expect(rollbackToSavepoint(handle, "sp_1")).rejects.toThrow(
      PostgresTransactionError,
    );
  });

  it("should propagate query failure", async () => {
    const handle = makeHandle();
    (handle.client.query as Mock).mockRejectedValueOnce(new Error("connection lost"));

    await expect(rollbackToSavepoint(handle, "sp_1")).rejects.toThrow("connection lost");
  });
});
