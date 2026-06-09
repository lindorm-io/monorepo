import { MySqlTransactionError } from "../../errors/MySqlTransactionError.js";
import type { MysqlTransactionHandle } from "../../types/mysql-transaction-handle.js";

export const assertActiveTransaction = (handle: MysqlTransactionHandle): void => {
  if (handle.state !== "active") {
    throw new MySqlTransactionError(
      `Transaction is already ${handle.state} — cannot perform further operations`,
      {
        code: "transaction_not_active",
        title: "Transaction Not Active",
        details:
          "The transaction is no longer active, so no further operations can be performed on it.",
        data: { state: handle.state },
      },
    );
  }
};
