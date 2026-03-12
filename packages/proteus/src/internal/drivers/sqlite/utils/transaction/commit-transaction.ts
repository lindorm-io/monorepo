import type { SqliteTransactionHandle } from "../../types/sqlite-transaction-handle";
import { SqliteTransactionError } from "../../errors/SqliteTransactionError";
import { assertActiveTransaction } from "./assert-active-transaction";

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
      error: error as Error,
    });
  }
};
