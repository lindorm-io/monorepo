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
