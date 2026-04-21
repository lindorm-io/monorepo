import { MySqlTransactionError } from "../../errors/MySqlTransactionError.js";
import type { MysqlTransactionHandle } from "../../types/mysql-transaction-handle.js";
import { assertActiveTransaction } from "./assert-active-transaction.js";

/**
 * Executes `fn` within a MySQL savepoint. On success the savepoint is released;
 * on failure it is rolled back and the original error is re-thrown. If the rollback
 * itself fails, the rollback error is attached as `error.cause` so the original
 * error is never masked.
 */
export const withSavepoint = async <T>(
  handle: MysqlTransactionHandle,
  fn: () => Promise<T>,
): Promise<T> => {
  assertActiveTransaction(handle);

  const counter = ++handle.savepointCounter;
  const name = `sp_${counter}`;

  try {
    await handle.client.query(`SAVEPOINT \`${name}\``);
  } catch (error) {
    throw new MySqlTransactionError(`Failed to create savepoint "${name}"`, {
      error: error as Error,
    });
  }

  try {
    const result = await fn();
    try {
      await handle.client.query(`RELEASE SAVEPOINT \`${name}\``);
    } catch {
      // Release failure is non-fatal — MySQL auto-releases savepoints on COMMIT.
    }
    return result;
  } catch (error) {
    try {
      await handle.client.query(`ROLLBACK TO SAVEPOINT \`${name}\``);
    } catch (rollbackError) {
      // Preserve the original error as the primary cause
      if (error instanceof Error && rollbackError instanceof Error) {
        error.cause = rollbackError;
      }
    }
    throw error;
  }
};
