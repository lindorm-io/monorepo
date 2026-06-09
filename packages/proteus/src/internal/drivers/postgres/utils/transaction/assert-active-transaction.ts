import { PostgresTransactionError } from "../../errors/PostgresTransactionError.js";
import type { PostgresTransactionHandle } from "../../types/postgres-transaction-handle.js";

export const assertActiveTransaction = (handle: PostgresTransactionHandle): void => {
  if (handle.state !== "active") {
    throw new PostgresTransactionError(
      `Transaction is already ${handle.state} — cannot perform further operations`,
      {
        code: "transaction_not_active",
        title: "Transaction Not Active",
        details: `The transaction is in state "${handle.state}", not "active", so no further operations can run on it.`,
        data: { state: handle.state },
      },
    );
  }
};
