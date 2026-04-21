import type { ICacheAdapter } from "../interfaces/CacheAdapter.js";

/**
 * Options for the in-memory cache adapter.
 */
export type MemoryCacheAdapterOptions = {
  /** Maximum number of entries before LRU eviction kicks in. Defaults to 1000. */
  maxEntries?: number;
};

type CacheEntry = {
  value: string;
  expiresAt: number;
};

/**
 * In-memory LRU cache adapter for query caching.
 *
 * Suitable for single-process applications or development. For production
 * multi-instance deployments, implement `ICacheAdapter` with Redis or similar.
 * Entries are lazily evicted on access when their TTL expires. When the cache
 * exceeds `maxEntries`, the least-recently-used entry is evicted.
 */
export class MemoryCacheAdapter implements ICacheAdapter {
  private readonly map = new Map<string, CacheEntry>();
  private readonly maxEntries: number;

  public constructor(options: MemoryCacheAdapterOptions = {}) {
    this.maxEntries = options.maxEntries ?? 1000;
  }

  public get = async (key: string): Promise<string | null> => {
    const entry = this.map.get(key);
    if (!entry) return null;

    if (Date.now() >= entry.expiresAt) {
      this.map.delete(key);
      return null;
    }

    // Promote to end of Map (LRU: most-recently-used)
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  };

  public set = async (key: string, value: string, ttlMs: number): Promise<void> => {
    if (ttlMs < 0) throw new Error(`Invalid ttlMs: ${ttlMs}`);
    if (ttlMs === 0) return; // Zero TTL means "don't cache"

    // Delete first to refresh LRU position (Map preserves insertion order)
    this.map.delete(key);

    this.map.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });

    if (this.maxEntries > 0 && this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) {
        this.map.delete(oldest);
      }
    }
  };

  public del = async (key: string): Promise<void> => {
    this.map.delete(key);
  };

  public delByPrefix = async (prefix: string): Promise<void> => {
    for (const key of [...this.map.keys()]) {
      if (key.startsWith(prefix)) {
        this.map.delete(key);
      }
    }
  };
}
