import type { PostgresQueryClient } from "../types/postgres-query-client.js";

/**
 * Run `fn` while holding a TRANSACTION-scoped advisory lock. The caller must
 * already be inside a transaction: postgres releases the lock at COMMIT or
 * ROLLBACK, so there is no unlock to forget and nothing that can leak back
 * into a pooled connection.
 *
 * Distinct from `withAdvisoryLock`, which try-locks and returns null so the
 * caller can SKIP work a peer is already doing. This one WAITS, because it
 * guards work the caller depends on having been DONE before it continues. The
 * wait is bounded by the transaction's `lock_timeout` (SQLSTATE 55P03) —
 * unbounded only when the caller left the timeout unset.
 */
export const withAdvisoryXactLock = async <T>(
  client: PostgresQueryClient,
  key1: number,
  key2: number,
  fn: () => Promise<T>,
): Promise<T> => {
  await client.query(`SELECT pg_advisory_xact_lock($1, $2)`, [key1, key2]);

  return fn();
};
