import type { SqliteTransactionHandle } from "../../types/sqlite-transaction-handle.js";
import { SqliteTransactionError } from "../../errors/SqliteTransactionError.js";
import { assertActiveTransaction } from "./assert-active-transaction.js";

export const rollbackTransaction = (handle: SqliteTransactionHandle): void => {
  assertActiveTransaction(handle);

  try {
    handle.client.exec("ROLLBACK");
    handle.state = "rolledback";
  } catch (error) {
    handle.state = "rolledback";
    throw new SqliteTransactionError("Failed to rollback transaction", {
      code: "query_execution_failed",
      title: "Query Execution Failed",
      details: "SQLite rejected the ROLLBACK statement for the active transaction.",
      error: error as Error,
    });
  }
};
