/**
 * Interface for query cache storage backends.
 *
 * Implement this to provide custom caching (e.g. Redis, Memcached).
 * See `MemoryCacheAdapter` for the built-in in-memory implementation.
 */
export interface ICacheAdapter {
  /** Retrieve a cached value by key. Return `null` on cache miss. */
  get(key: string): Promise<string | null>;
  /** Store a value with the given TTL in milliseconds.
   *  A ttlMs of 0 means "do not cache" (no-op). Negative ttlMs must throw. */
  set(key: string, value: string, ttlMs: number): Promise<void>;
  /** Delete a single cached entry by key. */
  del(key: string): Promise<void>;
  /** Delete all entries whose key starts with the given prefix. Used for entity-level nuclear invalidation. */
  delByPrefix(prefix: string): Promise<void>;
  /** Open the adapter's connection, if it owns one. No-op if the adapter was given an external client. */
  connect?(): Promise<void>;
  /** Close the adapter's connection, if it owns one. No-op if the adapter was given an external client. */
  disconnect?(): Promise<void>;
}
