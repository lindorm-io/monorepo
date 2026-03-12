import { MySqlTransactionError } from "../../errors/MySqlTransactionError";
import type { MysqlTransactionHandle } from "../../types/mysql-transaction-handle";

export const assertActiveTransaction = (handle: MysqlTransactionHandle): void => {
  if (handle.state !== "active") {
    throw new MySqlTransactionError(
      `Transaction is already ${handle.state} — cannot perform further operations`,
    );
  }
};
