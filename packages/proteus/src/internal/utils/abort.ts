import { AbortError } from "@lindorm/errors";

/**
 * Build an AbortError carrying the signal's reason and (optionally) wrapping
 * the underlying driver error that caused the cancel. The resulting error has
 * `status === 499` via the `AbortError` base.
 *
 * Shared across all Proteus drivers so per-driver rewraps stay consistent.
 */
export const toAbortError = (
  reason: unknown,
  cause?: unknown,
  message: string = "Query cancelled",
): AbortError =>
  new AbortError(message, {
    reason,
    error: cause instanceof Error ? cause : undefined,
  });

/**
 * Race a pending promise against an AbortSignal. When the signal fires first
 * the race rejects with an AbortError carrying the signal reason; the original
 * promise still resolves/rejects in the background. When no signal is
 * provided the input promise is returned unchanged.
 *
 * Used by drivers that have no native AbortSignal support (e.g. ioredis) to
 * let callers unwind while the underlying driver command completes in the
 * background.
 */
export const raceWithSignal = async <T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
  message: string = "Query cancelled",
): Promise<T> => {
  if (!signal) return promise;
  if (signal.aborted) {
    throw toAbortError(signal.reason, undefined, message);
  }

  let disposeAbort!: () => void;
  const abortRace = new Promise<never>((_, reject) => {
    const onAbort = (): void => {
      reject(toAbortError(signal.reason, undefined, message));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    disposeAbort = () => signal.removeEventListener("abort", onAbort);
  });

  try {
    return await Promise.race([promise, abortRace]);
  } finally {
    disposeAbort();
  }
};
