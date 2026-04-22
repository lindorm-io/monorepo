import type { AbortError } from "@lindorm/errors";
import { toAbortError as toSharedAbortError } from "../../../utils/abort.js";

/**
 * mysql errno for `Query execution was interrupted`. Emitted when a running
 * query is interrupted by a `KILL QUERY <thread-id>` on another session.
 * See: https://dev.mysql.com/doc/mysql-errors/8.0/en/server-error-reference.html#error_er_query_interrupted
 */
export const MYSQL_QUERY_INTERRUPTED_ERRNO = 1317;

export const toAbortError = (reason: unknown, cause?: unknown): AbortError =>
  toSharedAbortError(reason, cause, "MySQL query cancelled");

export const isMysqlQueryInterruptedError = (err: unknown): boolean =>
  typeof err === "object" &&
  err !== null &&
  (err as { errno?: unknown }).errno === MYSQL_QUERY_INTERRUPTED_ERRNO;
