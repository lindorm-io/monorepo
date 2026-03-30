import type { ErrorClassification } from "@lindorm/breaker";

const TRANSIENT_SYSTEM_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
]);

/**
 * MongoDB error codes indicating infrastructure failures.
 * @see https://www.mongodb.com/docs/manual/reference/error-codes/
 */
const TRANSIENT_MONGO_CODES = new Set([
  6, // HostUnreachable
  7, // HostNotFound
  89, // NetworkTimeout
  91, // ShutdownInProgress
  189, // PrimarySteppedDown
  10107, // NotWritablePrimary
  11600, // InterruptedAtShutdown
  11602, // InterruptedDueToReplStateChange
  13435, // NotPrimaryNoSecondaryOk
  13436, // NotPrimaryOrSecondary
]);

const PERMANENT_MONGO_CODES = new Set([
  13, // Unauthorized
  18, // AuthenticationFailed
]);

export const classifyMongoError = (error: Error): ErrorClassification => {
  const code: number | string | undefined = (error as any).code;
  const systemCode: string | undefined = (error as any).code;

  if (typeof code === "number") {
    if (TRANSIENT_MONGO_CODES.has(code)) return "transient";
    if (PERMANENT_MONGO_CODES.has(code)) return "permanent";
  }

  if (typeof systemCode === "string" && TRANSIENT_SYSTEM_CODES.has(systemCode)) {
    return "transient";
  }

  // MongoDB driver labels transient errors
  if ((error as any).hasErrorLabel?.("TransientTransactionError")) return "transient";
  if ((error as any).hasErrorLabel?.("RetryableWriteError")) return "transient";

  if (error.message?.includes("Server selection timed out")) return "transient";
  if (error.message?.includes("connection pool cleared")) return "transient";

  return "ignorable";
};
