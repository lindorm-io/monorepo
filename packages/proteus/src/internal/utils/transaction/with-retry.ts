import { withRetry as _withRetry } from "@lindorm/retry";
import type { RetryOptions } from "../../../types/transaction-options.js";

export type { RetryOptions };

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 50;
const DEFAULT_MAX_DELAY_MS = 5000;

export const withRetry = async <T>(
  fn: () => Promise<T>,
  isRetryable: (error: unknown) => boolean,
  options?: RetryOptions,
): Promise<T> => {
  return _withRetry(fn, {
    maxAttempts: (options?.maxRetries ?? DEFAULT_MAX_RETRIES) + 1,
    delay: options?.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS,
    delayMax: options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS,
    multiplier: options?.backoffMultiplier,
    jitter: options?.jitter,
    isRetryable,
    onRetry: options?.onRetry,
  });
};
