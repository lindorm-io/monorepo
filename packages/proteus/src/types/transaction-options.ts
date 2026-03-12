/**
 * SQL transaction isolation level.
 *
 * - `"READ COMMITTED"` — each statement sees only committed data (default for most drivers)
 * - `"REPEATABLE READ"` — all reads within the transaction see a consistent snapshot
 * - `"SERIALIZABLE"` — transactions execute as if run sequentially
 */
export type IsolationLevel = "READ COMMITTED" | "REPEATABLE READ" | "SERIALIZABLE";

/**
 * Configure automatic retry behavior for failed transactions.
 *
 * Uses exponential backoff with optional jitter to handle transient failures
 * such as serialization conflicts or deadlocks.
 */
export type RetryOptions = {
  /** Maximum number of retry attempts before propagating the error. */
  maxRetries?: number;
  /** Delay in milliseconds before the first retry. */
  initialDelayMs?: number;
  /** Upper bound on delay in milliseconds regardless of backoff growth. */
  maxDelayMs?: number;
  /** Multiplier applied to the delay after each retry. */
  backoffMultiplier?: number;
  /** Add random jitter to the delay to avoid thundering herd. */
  jitter?: boolean;
  /** Called before each retry attempt with the attempt number and error. */
  onRetry?: (attempt: number, error: unknown) => void;
};

/**
 * Configure transaction behavior for `ProteusSource.transaction()`.
 */
export type TransactionOptions = {
  /** SQL isolation level for the transaction. */
  isolation?: IsolationLevel;
  /** Automatic retry configuration for transient failures. */
  retry?: RetryOptions;
};
