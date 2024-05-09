import { RetryStrategy } from "../enums";
import { RetryOptions } from "../types";

export const calculateRetry = (attempt: number, options: Partial<RetryOptions> = {}): number => {
  const { strategy = RetryStrategy.Exponential, timeout = 100, timeoutMax = 10000 } = options;

  if (strategy === RetryStrategy.Linear) {
    const value = timeout * attempt;
    return value > timeoutMax ? timeoutMax : value;
  }

  let value = timeout;

  for (let i = 1; i < attempt; i++) {
    value = value * 2;
  }

  return value > timeoutMax ? timeoutMax : value;
};
