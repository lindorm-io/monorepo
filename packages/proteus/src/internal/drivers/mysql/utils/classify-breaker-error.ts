import type { ErrorClassification } from "@lindorm/breaker";
import { AbortError } from "@lindorm/errors";

/**
 * MySQL error numbers that indicate infrastructure failures.
 * @see https://dev.mysql.com/doc/mysql-errors/8.0/en/server-error-reference.html
 */
const TRANSIENT_MYSQL_ERRNO = new Set([
  1040, // ER_CON_COUNT_ERROR (too many connections)
  1053, // ER_SERVER_SHUTDOWN
  1152, // ER_ABORTING_CONNECTION
  1153, // ER_NET_PACKET_TOO_LARGE (connection issue)
  1159, // ER_NET_READ_INTERRUPTED
  1160, // ER_NET_ERROR_ON_WRITE
  1161, // ER_NET_WRITE_INTERRUPTED
  2002, // CR_CONNECTION_ERROR
  2003, // CR_CONN_HOST_ERROR
  2006, // CR_SERVER_GONE_ERROR
  2013, // CR_SERVER_LOST
]);

const PERMANENT_MYSQL_ERRNO = new Set([
  1045, // ER_ACCESS_DENIED_ERROR
  1049, // ER_BAD_DB_ERROR
]);

const TRANSIENT_SYSTEM_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
]);

export const classifyMysqlError = (error: Error): ErrorClassification => {
  // Client-initiated cancellation is not a backend failure — never trip the
  // breaker on aborts.
  if (error instanceof AbortError) return "ignorable";

  const errno: number | undefined = (error as any).errno;
  const code: string | undefined = (error as any).code;

  if (errno) {
    if (TRANSIENT_MYSQL_ERRNO.has(errno)) return "transient";
    if (PERMANENT_MYSQL_ERRNO.has(errno)) return "permanent";
  }

  if (code && TRANSIENT_SYSTEM_CODES.has(code)) return "transient";

  if (error.message?.includes("Connection lost")) return "transient";

  return "ignorable";
};
