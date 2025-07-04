import { RetryConfig, RetryStrategy } from "@lindorm/retry";

export const RETRY_CONFIG: RetryConfig = {
  maxAttempts: 10,
  strategy: RetryStrategy.Exponential,
  timeout: 250,
  timeoutMax: 30000,
};
