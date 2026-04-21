import { PostgresTransactionError } from "../../errors/PostgresTransactionError.js";
import type { PostgresTransactionHandle } from "../../types/postgres-transaction-handle.js";

export const assertActiveTransaction = (handle: PostgresTransactionHandle): void => {
  if (handle.state !== "active") {
    throw new PostgresTransactionError(
      `Transaction is already ${handle.state} — cannot perform further operations`,
    );
  }
};
