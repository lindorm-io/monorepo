import type { EntityMetadata } from "../types/metadata.js";

const entityRegistry = new Map<string, Function>();
const targetToName = new Map<Function, string>();
const metadataCache = new Map<Function, EntityMetadata>();

// Every target ever decorated, name collisions included. `entityRegistry` keeps
// only the newest class per name (lookup by name must resolve to one class), but
// a same-named class registered later must not make the earlier one vanish: two
// sources in one process can legitimately hold distinct classes under the same
// entity name, and a consumer scanning the registry (memory referential
// integrity) has to see both or it silently stops matching one source's rows.
const allTargets = new Set<Function>();

export const registerEntity = (name: string, target: Function): void => {
  const existing = entityRegistry.get(name);
  if (existing && existing !== target) {
    // In HMR or test environments, the same entity name may be re-decorated
    // with a new constructor reference. Allow re-registration by updating both maps.
    targetToName.delete(existing);
  }
  entityRegistry.set(name, target);
  targetToName.set(target, name);
  allTargets.add(target);
};

export const findEntityByName = (name: string): Function | undefined =>
  entityRegistry.get(name);

export const getRegisteredTargets = (): Array<Function> => [...allTargets];

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
