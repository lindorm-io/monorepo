import { Optional } from "@lindorm/types";

export type RetryStrategy = "exponential" | "linear" | "constant";

export type RetryConfig = {
  maxAttempts: number;
  strategy: RetryStrategy;
  timeout: number;
  timeoutMax: number;
};

export type RetryOptions = Optional<
  RetryConfig,
  "maxAttempts" | "strategy" | "timeout" | "timeoutMax"
>;

export type DelayOptions = {
  strategy?: RetryStrategy;
  delay?: number;
  delayMax?: number;
  multiplier?: number;
  jitter?: boolean;
};

export type WithRetryOptions = {
  maxAttempts?: number;
  strategy?: RetryStrategy;
  delay?: number;
  delayMax?: number;
  multiplier?: number;
  jitter?: boolean;
  isRetryable?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown) => void;
};
