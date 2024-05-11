import { RetryConfig, RetryStrategy } from "@lindorm/retry";

export const _RETRY_CONFIG: RetryConfig = {
  maxAttempts: 10,
  strategy: RetryStrategy.Exponential,
  timeout: 250,
  timeoutMax: 10000,
};
