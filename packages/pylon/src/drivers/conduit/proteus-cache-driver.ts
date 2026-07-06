import type { IConduitCacheDriver } from "@lindorm/conduit";
import type { ILogger } from "@lindorm/logger";
import type { IProteusSource } from "@lindorm/proteus";
import type { ConduitCachedResponse } from "../../entities/ConduitCachedResponse.js";
import { cacheId } from "./canonical.js";

/**
 * Node-only conduit cache driver backed by a proteus (redis) `source`. Storage and
 * expiry are delegated to proteus: the `@ExpiryDateField` sets a native redis TTL
 * on `set`, so expired entries are dropped by the store and a `get` on an expired
 * key simply misses. An optional `logger` is threaded onto the proteus session.
 */
export const createProteusCacheDriver = (
  source: IProteusSource,
  logger?: ILogger,
): IConduitCacheDriver => {
  // Dynamically import the entity so the static module graph from index.js stays
  // free of @lindorm/proteus (iris/proteus optionality) — mirrors use-cache.ts.
  const getRepository = async () => {
    const { ConduitCachedResponse } =
      await import("../../entities/ConduitCachedResponse.js");

    return source.session({ logger }).repository(ConduitCachedResponse);
  };

  return {
    async get(key) {
      const repository = await getRepository();
      const found = await repository.findOne({ id: cacheId(key) });

      if (!found) return null;

      return { response: found.payload, storedAt: found.createdAt.getTime() };
    },

    async set(key, response, ttl) {
      const repository = await getRepository();
      const now = Date.now();

      await repository.upsert({
        id: cacheId(key),
        payload: response,
        expiresAt: ttl !== undefined ? new Date(now + ttl) : null,
      } as ConduitCachedResponse);
    },
  };
};
