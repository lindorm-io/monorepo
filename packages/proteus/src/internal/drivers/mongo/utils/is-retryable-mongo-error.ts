import type { MongoError } from "mongodb";

/**
 * Determine if a MongoDB error is transient and safe to retry.
 *
 * MongoDB marks errors with the `TransientTransactionError` label when
 * a transaction fails due to a transient condition (e.g., write conflict,
 * primary step-down). These are safe to retry with a fresh transaction.
 */
export const isRetryableMongoError = (error: unknown): boolean => {
  if (error == null || typeof error !== "object") return false;

  // MongoDB driver errors carry errorLabels array
  const mongoError = error as MongoError;

  if (Array.isArray(mongoError.errorLabels)) {
    return mongoError.errorLabels.includes("TransientTransactionError");
  }

  // Fallback: check for hasErrorLabel method (MongoError interface)
  if (typeof (mongoError as any).hasErrorLabel === "function") {
    return (mongoError as any).hasErrorLabel("TransientTransactionError");
  }

  return false;
};
