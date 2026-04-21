import { MySqlTransactionError } from "../../errors/MySqlTransactionError.js";
import type { MysqlTransactionHandle } from "../../types/mysql-transaction-handle.js";
import { assertActiveTransaction } from "./assert-active-transaction.js";

export const rollbackTransaction = async (
  handle: MysqlTransactionHandle,
): Promise<void> => {
  assertActiveTransaction(handle);

  try {
    await handle.client.query("ROLLBACK");
    handle.state = "rolledback";
  } catch (error) {
    handle.state = "rolledback";
    throw new MySqlTransactionError("Failed to rollback transaction", {
      error: error as Error,
    });
  } finally {
    try {
      handle.release();
    } catch {
      // Release failure is secondary — preserve any commit/rollback error
    }
  }
};
