import { DeadlockError } from "../../../../errors/DeadlockError.js";
import { SerializationError } from "../../../../errors/SerializationError.js";

/**
 * Determines whether a MySQL error is a transient transaction failure
 * that can be safely retried.
 *
 * - errno 1213 = ER_LOCK_DEADLOCK — innodb deadlock detected
 * - errno 1205 = ER_LOCK_WAIT_TIMEOUT — lock wait timeout exceeded
 *
 * When errors are wrapped by `wrapMysqlError`, the original `.errno` property
 * is lost. We check `.cause?.errno` as a fallback for wrapped errors that
 * preserve the original via the standard Error `cause` property.
 */
export const isRetryableTransactionError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;

  // Typed error class checks (preferred — works with wrapped errors)
  if (error instanceof DeadlockError) return true;
  if (error instanceof SerializationError) return true;

  // Check the error itself (raw mysql2 error)
  if (hasRetryableErrno(error)) return true;

  // Check error.cause (wrapped errors that preserve original via cause)
  if (error.cause instanceof Error && hasRetryableErrno(error.cause)) return true;

  // Check for wrapped ProteusRepositoryError by message pattern
  // wrapMysqlError produces messages like "... (deadlock detected — retry the operation)"
  // and "... (lock wait timeout — retry the operation)"
  if (
    error.message.includes("deadlock detected") ||
    error.message.includes("lock wait timeout")
  ) {
    return true;
  }

  return false;
};

const hasRetryableErrno = (error: Error): boolean => {
  if ("errno" in error) {
    const errno = (error as any).errno as number;
    return errno === 1213 || errno === 1205;
  }
  return false;
};
