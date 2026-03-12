import { sleep } from "@lindorm/utils";
import { ProteusError } from "../../../errors/ProteusError";
import type { RetryOptions } from "../../../types/transaction-options";

export type { RetryOptions };

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 50;
const DEFAULT_MAX_DELAY_MS = 5000;
const DEFAULT_BACKOFF_MULTIPLIER = 2;
const DEFAULT_JITTER = true;

export const computeDelay = (
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number,
  jitter: boolean,
): number => {
  const base = initialDelayMs * Math.pow(backoffMultiplier, attempt);
  const capped = Math.min(base, maxDelayMs);
  if (!jitter) return capped;
  return Math.round(capped * (0.5 + Math.random() * 0.5));
};

export const withRetry = async <T>(
  fn: () => Promise<T>,
  isRetryable: (error: unknown) => boolean,
  options?: RetryOptions,
): Promise<T> => {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const initialDelayMs = options?.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  const maxDelayMs = options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const backoffMultiplier = options?.backoffMultiplier ?? DEFAULT_BACKOFF_MULTIPLIER;
  const jitter = options?.jitter ?? DEFAULT_JITTER;
  const onRetry = options?.onRetry;

  if (maxRetries < 0) throw new ProteusError("maxRetries must be >= 0");
  if (initialDelayMs <= 0) throw new ProteusError("initialDelayMs must be > 0");
  if (maxDelayMs <= 0) throw new ProteusError("maxDelayMs must be > 0");
  if (backoffMultiplier <= 0) throw new ProteusError("backoffMultiplier must be > 0");

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryable(error) || attempt === maxRetries) {
        throw error;
      }

      onRetry?.(attempt + 1, error);

      await sleep(
        computeDelay(attempt, initialDelayMs, maxDelayMs, backoffMultiplier, jitter),
      );
    }
  }

  // Unreachable: validation ensures maxRetries >= 0, so the loop runs at least once
  // and always either returns (try) or throws (catch when !retryable || last attempt)
  throw new ProteusError("withRetry: unexpected loop exit");
};
