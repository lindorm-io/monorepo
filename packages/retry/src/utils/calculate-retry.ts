import { RetryOptions } from "../types";
import { computeDelay } from "./compute-delay";

export const calculateRetry = (
  attempt: number,
  options: Partial<RetryOptions> = {},
): number => {
  const { strategy = "exponential", timeout = 100, timeoutMax = 10000 } = options;

  return computeDelay(attempt, {
    strategy,
    delay: timeout,
    delayMax: timeoutMax,
    multiplier: 2,
    jitter: false,
  });
};
