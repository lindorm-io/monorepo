import type { ErrorClassification } from "@lindorm/breaker";

/**
 * PostgreSQL error codes that indicate infrastructure failures.
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const TRANSIENT_PG_CODES = new Set([
  "08000", // connection_exception
  "08003", // connection_does_not_exist
  "08006", // connection_failure
  "57P01", // admin_shutdown
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now
  "53300", // too_many_connections
  "53400", // configuration_limit_exceeded
]);

const PERMANENT_PG_CODES = new Set([
  "28000", // invalid_authorization_specification
  "28P01", // invalid_password
  "3D000", // invalid_catalog_name (database does not exist)
  "3F000", // invalid_schema_name
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

export const classifyPostgresError = (error: Error): ErrorClassification => {
  const code: string | undefined = (error as any).code;

  if (code) {
    if (TRANSIENT_PG_CODES.has(code)) return "transient";
    if (PERMANENT_PG_CODES.has(code)) return "permanent";
    if (TRANSIENT_SYSTEM_CODES.has(code)) return "transient";
  }

  // Connection terminated unexpectedly
  if (error.message?.includes("Connection terminated unexpectedly")) return "transient";
  if (error.message?.includes("connection timeout")) return "transient";

  // Everything else (constraint violations, deadlocks, etc.) — don't trip the breaker
  return "ignorable";
};
