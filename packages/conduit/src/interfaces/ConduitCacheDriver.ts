import type {
  ConduitCacheEntry,
  ConduitCacheKey,
  ConduitResponse,
} from "../types/index.js";

export interface IConduitCacheDriver {
  /** Return the entry for a request, or null if absent or expired. */
  get(key: ConduitCacheKey): Promise<ConduitCacheEntry | null>;
  /** Store a response for a request. `ttl` in ms; omit for no expiry. */
  set(key: ConduitCacheKey, response: ConduitResponse, ttl?: number): Promise<void>;
}
