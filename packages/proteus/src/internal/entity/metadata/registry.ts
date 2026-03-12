import type { EntityMetadata } from "../types/metadata";

const entityRegistry = new Map<string, Function>();
const targetToName = new Map<Function, string>();
const metadataCache = new Map<Function, EntityMetadata>();

export const registerEntity = (name: string, target: Function): void => {
  const existing = entityRegistry.get(name);
  if (existing && existing !== target) {
    // In HMR or test environments, the same entity name may be re-decorated
    // with a new constructor reference. Allow re-registration by updating both maps.
    targetToName.delete(existing);
  }
  entityRegistry.set(name, target);
  targetToName.set(target, name);
};

export const findEntityByName = (name: string): Function | undefined =>
  entityRegistry.get(name);

export const findEntityByTarget = (target: Function): string | undefined =>
  targetToName.get(target);

export const getCachedMetadata = (target: Function): EntityMetadata | undefined =>
  metadataCache.get(target);

export const setCachedMetadata = (target: Function, metadata: EntityMetadata): void => {
  metadataCache.set(target, metadata);
};

/** Clear computed metadata cache. Call before inheritance resolution to prevent
 *  stale pre-setup() metadata from being permanently cached.
 *  Does NOT clear the entity name registry — that is populated at decorator
 *  evaluation time and must survive setup() calls. */
export const clearMetadataCache = (): void => {
  metadataCache.clear();
};
