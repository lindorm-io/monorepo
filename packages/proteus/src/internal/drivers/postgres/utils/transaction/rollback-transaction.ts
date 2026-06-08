import { PostgresTransactionError } from "../../errors/PostgresTransactionError.js";
import type { PostgresTransactionHandle } from "../../types/postgres-transaction-handle.js";
import { assertActiveTransaction } from "./assert-active-transaction.js";

export const rollbackTransaction = async (
  handle: PostgresTransactionHandle,
): Promise<void> => {
  assertActiveTransaction(handle);

  try {
    await handle.client.query("ROLLBACK");
    handle.state = "rolledback";
  } catch (error) {
    handle.state = "rolledback";
    throw new PostgresTransactionError("Failed to rollback transaction", {
      code: "query_execution_failed",
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
