import { SqliteTransactionError } from "../../errors/SqliteTransactionError.js";
import type { SqliteTransactionHandle } from "../../types/sqlite-transaction-handle.js";

export const assertActiveTransaction = (handle: SqliteTransactionHandle): void => {
  if (handle.state !== "active") {
    throw new SqliteTransactionError(
      `Transaction is already ${handle.state} — cannot perform further operations`,
    );
  }
};
