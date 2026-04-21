import { MySqlTransactionError } from "../../errors/MySqlTransactionError.js";
import type { MysqlTransactionHandle } from "../../types/mysql-transaction-handle.js";
import { assertActiveTransaction } from "./assert-active-transaction.js";

export const commitTransaction = async (
  handle: MysqlTransactionHandle,
): Promise<void> => {
  assertActiveTransaction(handle);

  try {
    await handle.client.query("COMMIT");
    handle.state = "committed";
  } catch (error) {
    // COMMIT failed — the connection is in an undefined state.
    // Issue an explicit ROLLBACK to leave the connection in a known state.
    try {
      await handle.client.query("ROLLBACK");
    } catch {
      // ROLLBACK failure is secondary — connection may already be dead
    }
    handle.state = "rolledback";
    throw new MySqlTransactionError("Failed to commit transaction", {
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
