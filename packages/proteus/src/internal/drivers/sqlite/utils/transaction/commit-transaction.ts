import type { SqliteTransactionHandle } from "../../types/sqlite-transaction-handle.js";
import { SqliteTransactionError } from "../../errors/SqliteTransactionError.js";
import { assertActiveTransaction } from "./assert-active-transaction.js";

export const commitTransaction = (handle: SqliteTransactionHandle): void => {
  assertActiveTransaction(handle);

  try {
    handle.client.exec("COMMIT");
    handle.state = "committed";
  } catch (error) {
    try {
      handle.client.exec("ROLLBACK");
    } catch {
      /* preserve original error */
    }
    handle.state = "rolledback";
    throw new SqliteTransactionError("Failed to commit transaction", {
      code: "query_execution_failed",
      title: "Query Execution Failed",
      details: "SQLite rejected the COMMIT; the transaction was rolled back.",
      error: error as Error,
    });
  }
};
