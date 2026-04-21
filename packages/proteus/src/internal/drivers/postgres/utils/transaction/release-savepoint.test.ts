import { PostgresTransactionError } from "../../errors/PostgresTransactionError.js";
import type { PostgresTransactionHandle } from "../../types/postgres-transaction-handle.js";
import { releaseSavepoint } from "./release-savepoint.js";
import { describe, expect, it, vi, type Mock } from "vitest";

const makeHandle = (
  state: PostgresTransactionHandle["state"] = "active",
): PostgresTransactionHandle => ({
  client: { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) },
  release: vi.fn(),
  state,
  savepointCounter: 1,
});

describe("releaseSavepoint", () => {
  it("should issue RELEASE SAVEPOINT", async () => {
    const handle = makeHandle();

    await releaseSavepoint(handle, "sp_1");

    expect(handle.client.query).toHaveBeenCalledWith('RELEASE SAVEPOINT "sp_1"');
  });

  it("should throw when transaction is not active", async () => {
    const handle = makeHandle("rolledback");

    await expect(releaseSavepoint(handle, "sp_1")).rejects.toThrow(
      PostgresTransactionError,
    );
  });

  it("should propagate query failure", async () => {
    const handle = makeHandle();
    (handle.client.query as Mock).mockRejectedValueOnce(new Error("connection lost"));

    await expect(releaseSavepoint(handle, "sp_1")).rejects.toThrow("connection lost");
  });
});
