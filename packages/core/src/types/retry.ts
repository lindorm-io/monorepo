export type RetryStrategy = "exponential" | "linear";

export type RetryOptions = {
  maximumAttempts: number;
  maximumMilliseconds: number;
  milliseconds: number;
  strategy: RetryStrategy;
};
