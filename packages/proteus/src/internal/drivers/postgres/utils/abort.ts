import { AbortError } from "@lindorm/errors";

/**
 * Postgres-specific sqlstate for `canceling statement due to user request`.
 * Emitted by a backend when it receives a `pg_cancel_backend` while running
 * a query. See: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export const PG_QUERY_CANCELLED_SQLSTATE = "57014";

/**
 * Build an AbortError carrying the signal's reason and (optionally) wrapping
 * the underlying pg error that caused the cancel. The resulting error has
 * `status === 499` via the `AbortError` base.
 */
export const toAbortError = (reason: unknown, cause?: unknown): AbortError =>
  new AbortError("Postgres query cancelled", {
    reason,
    error: cause instanceof Error ? cause : undefined,
  });

/**
 * Duck-type check for pg driver errors that indicate a server-side cancel.
 */
export const isPgQueryCancelledError = (err: unknown): boolean =>
  typeof err === "object" &&
  err !== null &&
  (err as { code?: unknown }).code === PG_QUERY_CANCELLED_SQLSTATE;
