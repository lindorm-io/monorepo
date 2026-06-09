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
      code: "query_execution_failed",
      title: "Query Execution Failed",
      details: "The ROLLBACK statement failed while aborting the transaction.",
      data: { operation: "ROLLBACK" },
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
