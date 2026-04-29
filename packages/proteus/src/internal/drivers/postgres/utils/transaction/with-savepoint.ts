import type { PostgresTransactionHandle } from "../../types/postgres-transaction-handle.js";
import { createSavepoint } from "./create-savepoint.js";
import { releaseSavepoint } from "./release-savepoint.js";
import { rollbackToSavepoint } from "./rollback-to-savepoint.js";

/**
 * Executes `fn` within a PostgreSQL savepoint. On success the savepoint is released;
 * on failure it is rolled back and the original error is re-thrown. If the rollback
 * itself fails (e.g. lost connection), the rollback error is attached as `error.cause`
 * so the original error is never masked.
 */
export const withSavepoint = async <T>(
  handle: PostgresTransactionHandle,
  fn: () => Promise<T>,
): Promise<T> => {
  const name = await createSavepoint(handle);

  try {
    const result = await fn();
    try {
      await releaseSavepoint(handle, name);
    } catch {
      // Release failure is non-fatal — PG auto-releases savepoints on COMMIT.
      // Swallowing here preserves the successful result.
    }
    return result;
  } catch (error) {
    try {
      await rollbackToSavepoint(handle, name);
    } catch (rollbackError) {
      // Preserve the original error as the primary cause — the rollback
      // failure is secondary and would otherwise mask the root cause.
      if (error instanceof Error && rollbackError instanceof Error) {
        error.cause = rollbackError;
      }
    }
    throw error;
  }
};
