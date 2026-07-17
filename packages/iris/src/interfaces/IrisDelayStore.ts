import type { DelayedEntry } from "../types/index.js";

export interface IDelayStore {
  schedule(entry: DelayedEntry): Promise<void>;
  /**
   * Return all entries due at or before `now` WITHOUT removing them. The caller
   * removes each entry via `cancel()` only after its delivery has succeeded, so a
   * delivery failure (e.g. a connection dropped at fire time) leaves the entry in
   * the store for the next poll to retry instead of losing it.
   */
  peek(now: number): Promise<Array<DelayedEntry>>;
  /** Remove an entry by id. Returns true if it was present. */
  cancel(id: string): Promise<boolean>;
  size(): Promise<number>;
  clear(): Promise<void>;
  close(): Promise<void>;
}
