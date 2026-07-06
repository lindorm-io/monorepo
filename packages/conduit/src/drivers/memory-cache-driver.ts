import { canonicalCacheKey } from "../internal/utils/canonical-cache-key.js";
import type { IConduitCacheDriver } from "../interfaces/index.js";
import type { ConduitResponse } from "../types/index.js";

type StoredEntry = {
  response: ConduitResponse;
  storedAt: number;
  expiresAt: number | null;
};

/**
 * Default cache driver: an in-process LRU Map with per-entry TTL. Browser-safe.
 */
export const createMemoryCacheDriver = (maxEntries = 1000): IConduitCacheDriver => {
  const store = new Map<string, StoredEntry>();

  return {
    async get(key) {
      const id = canonicalCacheKey(key);
      const entry = store.get(id);

      if (!entry) return null;

      if (entry.expiresAt !== null && Date.now() >= entry.expiresAt) {
        store.delete(id);
        return null;
      }

      // Refresh recency (LRU): re-insert at the tail.
      store.delete(id);
      store.set(id, entry);

      return { response: entry.response, storedAt: entry.storedAt };
    },

    async set(key, response, ttl) {
      const id = canonicalCacheKey(key);

      if (!store.has(id) && store.size >= maxEntries) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }

      store.set(id, {
        response,
        storedAt: Date.now(),
        expiresAt: ttl !== undefined ? Date.now() + ttl : null,
      });
    },
  };
};
