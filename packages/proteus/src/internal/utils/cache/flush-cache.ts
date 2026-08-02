import { isArray, isError, isUndefined } from "@lindorm/is";
import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import { ProteusError } from "../../../errors/ProteusError.js";
import type { ICacheAdapter } from "../../../interfaces/CacheAdapter.js";
import type { IEntity } from "../../../interfaces/Entity.js";
import type { MetadataResolver } from "../../interfaces/ProteusDriver.js";
import { buildCachePrefix, buildCacheRootPrefix } from "./build-cache-key.js";

export type FlushCacheOptions = {
  adapter: ICacheAdapter | undefined;
  namespace: string | null;
  logger: ILogger;
  resolveMetadata: MetadataResolver;
  hasEntity(target: Constructor<IEntity>): boolean;
  target: Constructor<IEntity> | Array<Constructor<IEntity>> | undefined;
};

/**
 * Every entity taking part in the same inheritance hierarchy as `target`.
 *
 * Subtypes that share a table still cache under their OWN entity name — one
 * repository per subtype, one cache prefix per repository — so flushing a
 * single participant would leave its siblings serving stale rows.
 */
const expandHierarchy = (
  target: Constructor<IEntity>,
  resolveMetadata: MetadataResolver,
): Array<Constructor<IEntity>> => {
  const { inheritance } = resolveMetadata(target);

  if (!inheritance) return [target];

  return [target, inheritance.root, ...inheritance.children.values()];
};

const resolvePrefixes = (
  target: Constructor<IEntity> | Array<Constructor<IEntity>> | undefined,
  namespace: string | null,
  resolveMetadata: MetadataResolver,
  hasEntity: (target: Constructor<IEntity>) => boolean,
): Array<string> => {
  // No target ⇒ flush everything under the namespace's cache root. Legal because
  // every cache key lives under that prefix — one round-trip, not one per entity.
  if (isUndefined(target)) return [buildCacheRootPrefix(namespace)];

  const prefixes = new Set<string>();

  for (const entity of isArray(target) ? target : [target]) {
    if (!hasEntity(entity)) {
      throw new ProteusError(
        `Cannot flush the cache for entity "${entity.name}" — it is not registered with this source`,
        {
          code: "entity_not_registered",
          title: "Entity Not Registered",
          details: `Entity "${entity.name}" is not registered with this source; register it via the source's entities option or addEntities().`,
          data: { target: entity.name },
        },
      );
    }

    for (const participant of expandHierarchy(entity, resolveMetadata)) {
      const { entity: entityMeta } = resolveMetadata(participant);

      prefixes.add(
        buildCachePrefix({
          sourceNamespace: namespace,
          entityNamespace: entityMeta.namespace,
          entityName: entityMeta.name,
        }),
      );
    }
  }

  return [...prefixes];
};

/**
 * Evict cached queries for the given entities — or, with no target, the entire
 * query cache of the namespace in a single adapter round-trip.
 *
 * Needed after any mutation that bypasses the ORM's implicit invalidation:
 * raw `client()` SQL and `queryBuilder()` writes.
 */
export const flushCache = async (options: FlushCacheOptions): Promise<void> => {
  const { adapter, namespace, logger, resolveMetadata, hasEntity, target } = options;

  if (!adapter) {
    // The same application code must run with and without caching configured,
    // so a flush without an adapter is a no-op rather than an error.
    logger.verbose("Cache flush skipped — no cache adapter configured");
    return;
  }

  const prefixes = resolvePrefixes(target, namespace, resolveMetadata, hasEntity);

  try {
    for (const prefix of prefixes) {
      await adapter.delByPrefix(prefix);
    }
  } catch (error) {
    // DELIBERATELY asymmetric with CachingRepository's implicit invalidate(),
    // which swallows adapter failures: an implicit post-write invalidation must
    // not fail a write that already succeeded. An EXPLICIT flushCache is the
    // caller asserting "make reads correct now" — resolving the promise while
    // the cache keeps serving stale rows is worse than an exception.
    throw new ProteusError("Failed to flush the query cache", {
      code: "cache_flush_failed",
      title: "Cache Flush Failed",
      details:
        "The cache adapter rejected the flush; cached queries may still serve stale data.",
      data: { prefixes },
      error: isError(error) ? error : undefined,
    });
  }

  logger.debug("Query cache flushed", { prefixes });
};
