import type { SqliteTransactionHandle } from "../../types/sqlite-transaction-handle.js";
import { SqliteTransactionError } from "../../errors/SqliteTransactionError.js";
import { assertActiveTransaction } from "./assert-active-transaction.js";

/**
 * Executes `fn` within a SQLite savepoint. On success the savepoint is released;
 * on failure it is rolled back and the original error is re-thrown. If the rollback
 * itself fails, the rollback error is attached as `error.cause` so the original
 * error is never masked.
 */
export const withSavepoint = async <T>(
  handle: SqliteTransactionHandle,
  fn: () => Promise<T>,
): Promise<T> => {
  assertActiveTransaction(handle);

  const counter = ++handle.savepointCounter;
  const name = `sp_${counter}`;

  try {
    handle.client.exec(`SAVEPOINT "${name}"`);
  } catch (error) {
    throw new SqliteTransactionError(`Failed to create savepoint "${name}"`, {
      error: error as Error,
    });
  }

  try {
    const result = await fn();
    try {
      handle.client.exec(`RELEASE SAVEPOINT "${name}"`);
    } catch {
      // Release failure is non-fatal — SQLite auto-releases savepoints on COMMIT.
    }
    return result;
  } catch (error) {
    try {
      handle.client.exec(`ROLLBACK TO SAVEPOINT "${name}"`);
    } catch (rollbackError) {
      // Preserve the original error as the primary cause
      if (error instanceof Error && rollbackError instanceof Error) {
        error.cause = rollbackError;
      }
    }
    throw error;
  }
};
