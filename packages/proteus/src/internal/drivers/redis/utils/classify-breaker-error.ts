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

const TRANSIENT_REDIS_MESSAGES = [
  "LOADING", // Redis is loading the dataset in memory
  "BUSY", // Redis is busy with a background operation
  "Connection is closed",
  "Stream isn't writeable",
];

const PERMANENT_REDIS_MESSAGES = [
  "NOAUTH", // Authentication required
  "NOPERM", // No permission
];

export const classifyRedisError = (error: Error): ErrorClassification => {
  const code: string | undefined = (error as any).code;

  if (code && TRANSIENT_SYSTEM_CODES.has(code)) return "transient";

  const msg = error.message ?? "";

  for (const pattern of PERMANENT_REDIS_MESSAGES) {
    if (msg.includes(pattern)) return "permanent";
  }

  for (const pattern of TRANSIENT_REDIS_MESSAGES) {
    if (msg.includes(pattern)) return "transient";
  }

  return "ignorable";
};
