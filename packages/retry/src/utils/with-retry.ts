import type { WithRetryOptions } from "../types/index.js";
import { computeDelay } from "./compute-delay.js";
import { sleep } from "./sleep.js";

export const withRetry = async <T>(
  fn: () => Promise<T>,
  options: WithRetryOptions = {},
): Promise<T> => {
  const {
    maxAttempts = 3,
    strategy,
    delay,
    delayMax,
    multiplier,
    jitter = true,
    isRetryable = (): boolean => true,
    onRetry,
  } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryable(error) || attempt === maxAttempts) {
        throw error;
      }

      onRetry?.(attempt, error);

      await sleep(
        computeDelay(attempt, { strategy, delay, delayMax, multiplier, jitter }),
      );
    }
  }

  throw new Error("withRetry: unexpected loop exit");
};
