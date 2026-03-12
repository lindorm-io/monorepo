import type { LockMode } from "../../../../types/find-options";
import { NotSupportedError } from "../../../../errors/NotSupportedError";

const EXTENDED_LOCK_MODES = new Set<LockMode>([
  "pessimistic_read_skip",
  "pessimistic_read_fail",
  "pessimistic_write_skip",
  "pessimistic_write_fail",
]);

/**
 * Throws `NotSupportedError` for extended lock modes (SKIP LOCKED / NOWAIT)
 * that have no meaningful semantics in a single-process in-memory store.
 *
 * Basic `pessimistic_read` and `pessimistic_write` are silently accepted
 * (no-op) because they can be safely ignored in a non-concurrent environment.
 */
export const guardMemoryLockMode = (mode: LockMode): void => {
  if (EXTENDED_LOCK_MODES.has(mode)) {
    throw new NotSupportedError(
      `Lock mode "${mode}" is not supported by the Memory driver`,
    );
  }
};
