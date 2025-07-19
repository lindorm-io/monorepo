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
