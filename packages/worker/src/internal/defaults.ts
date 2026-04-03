import { RetryConfig } from "@lindorm/retry";

export const RETRY_CONFIG: RetryConfig = {
  maxAttempts: 10,
  strategy: "exponential",
  timeout: 250,
  timeoutMax: 30000,
};
