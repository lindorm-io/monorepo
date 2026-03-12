import type { SqliteTransactionHandle } from "../../types/sqlite-transaction-handle";
import { SqliteTransactionError } from "../../errors/SqliteTransactionError";
import { assertActiveTransaction } from "./assert-active-transaction";

export const rollbackTransaction = (handle: SqliteTransactionHandle): void => {
  assertActiveTransaction(handle);

  try {
    handle.client.exec("ROLLBACK");
    handle.state = "rolledback";
  } catch (error) {
    handle.state = "rolledback";
    throw new SqliteTransactionError("Failed to rollback transaction", {
      error: error as Error,
    });
  }
};
