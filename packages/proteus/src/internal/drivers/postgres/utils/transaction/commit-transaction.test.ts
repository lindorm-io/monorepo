import { ProteusRepositoryError } from "../../../../../errors/ProteusRepositoryError.js";
import { PostgresTransactionError } from "../../errors/PostgresTransactionError.js";
import { SerializationError } from "../../../../errors/SerializationError.js";
import type { PostgresTransactionHandle } from "../../types/postgres-transaction-handle.js";
import { commitTransaction } from "./commit-transaction.js";
import { describe, expect, it, vi, type Mock } from "vitest";

const makeHandle = (
  state: PostgresTransactionHandle["state"] = "active",
): PostgresTransactionHandle => ({
  client: { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) },
  release: vi.fn(),
  state,
  savepointCounter: 0,
});

describe("commitTransaction", () => {
  it("should issue COMMIT and set state to committed", async () => {
    const handle = makeHandle();

    await commitTransaction(handle);

    expect(handle.client.query).toHaveBeenCalledWith("COMMIT");
    expect(handle.state).toBe("committed");
    expect(handle.release).toHaveBeenCalled();
  });

  it("should throw when transaction is not active", async () => {
    const handle = makeHandle("committed");

    await expect(commitTransaction(handle)).rejects.toThrow(PostgresTransactionError);
  });

  it("should release even when COMMIT query fails", async () => {
    const handle = makeHandle();
    (handle.client.query as Mock).mockRejectedValueOnce(new Error("network error"));

    await expect(commitTransaction(handle)).rejects.toThrow(ProteusRepositoryError);
    expect(handle.release).toHaveBeenCalled();
  });

  it("should throw SerializationError for PG code 40001 at commit time", async () => {
    const handle = makeHandle();
    const pgError = Object.assign(new Error("serialization_failure"), { code: "40001" });
    (handle.client.query as Mock).mockRejectedValueOnce(pgError);

    await expect(commitTransaction(handle)).rejects.toThrow(SerializationError);
    expect(handle.release).toHaveBeenCalled();
  });

  // P1-G: after a failed COMMIT the handle state must be "rolledback", not left as "active"
  it("should set handle state to rolledback when COMMIT query throws", async () => {
    const handle = makeHandle();
    (handle.client.query as Mock).mockRejectedValueOnce(new Error("network error"));

    await expect(commitTransaction(handle)).rejects.toThrow();

    expect(handle.state).toBe("rolledback");
  });
});
