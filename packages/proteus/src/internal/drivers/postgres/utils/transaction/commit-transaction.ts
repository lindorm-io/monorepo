import type { PostgresTransactionHandle } from "../../types/postgres-transaction-handle";
import { wrapPgError } from "../repository/wrap-pg-error";
import { assertActiveTransaction } from "./assert-active-transaction";

export const commitTransaction = async (
  handle: PostgresTransactionHandle,
): Promise<void> => {
  assertActiveTransaction(handle);

  try {
    await handle.client.query("COMMIT");
    handle.state = "committed";
  } catch (error) {
    handle.state = "rolledback";
    wrapPgError(error, "Failed to commit transaction");
  } finally {
    try {
      handle.release();
    } catch {
      // Release failure is secondary — preserve any commit/rollback error
    }
  }
};
