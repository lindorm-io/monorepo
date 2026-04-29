import { PostgresTransactionError } from "../../errors/PostgresTransactionError.js";
import type { PostgresTransactionHandle } from "../../types/postgres-transaction-handle.js";
import { createSavepoint } from "./create-savepoint.js";
import { describe, expect, it, vi, type Mock } from "vitest";

const makeHandle = (
  state: PostgresTransactionHandle["state"] = "active",
): PostgresTransactionHandle => ({
  client: { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) },
  release: vi.fn(),
  state,
  savepointCounter: 0,
});

describe("createSavepoint", () => {
  it("should increment counter and issue SAVEPOINT", async () => {
    const handle = makeHandle();

    const name = await createSavepoint(handle);

    expect(name).toBe("sp_1");
    expect(handle.savepointCounter).toBe(1);
    expect(handle.client.query).toHaveBeenCalledWith('SAVEPOINT "sp_1"');
  });

  it("should increment counter on successive calls", async () => {
    const handle = makeHandle();

    const name1 = await createSavepoint(handle);
    const name2 = await createSavepoint(handle);
    const name3 = await createSavepoint(handle);

    expect(name1).toBe("sp_1");
    expect(name2).toBe("sp_2");
    expect(name3).toBe("sp_3");
    expect(handle.savepointCounter).toBe(3);
  });

  it("should throw when transaction is not active", async () => {
    const handle = makeHandle("committed");

    await expect(createSavepoint(handle)).rejects.toThrow(PostgresTransactionError);
  });

  it("should propagate query failure", async () => {
    const handle = makeHandle();
    (handle.client.query as Mock).mockRejectedValueOnce(new Error("connection lost"));

    await expect(createSavepoint(handle)).rejects.toThrow("connection lost");
  });
});
