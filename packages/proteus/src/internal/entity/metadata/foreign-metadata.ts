import type { MetadataResolver } from "../../interfaces/ProteusDriver.js";
import type { EntityMetadata } from "../types/metadata.js";
import { getEntityMetadata } from "./get-entity-metadata.js";

/**
 * Naming-aware foreign-metadata resolution.
 *
 * The source builds a single naming-aware `MetadataResolver` (none/snake/camel)
 * and resolves the *primary* target's metadata through it. Compilers and query
 * utilities, however, also need *foreign / parent / child* entity metadata.
 * Calling `getEntityMetadata(foreignTarget)` directly returns RAW (un-renamed)
 * metadata, which under a snake/camel strategy emits property-cased column
 * identifiers that don't exist in the physical (renamed) tables.
 *
 * This registry lets those call sites resolve foreign metadata under the SAME
 * strategy without threading the resolver through every signature. The source's
 * resolver registers each resolved metadata object — and each of its relation
 * objects — against itself. A call site that already holds a resolved metadata
 * (or relation) in scope keys off it to resolve the foreign target.
 *
 * Under "none" the resolver is identity, so registered objects resolve to the
 * same RAW metadata `getEntityMetadata` would have returned. When a key is not
 * registered (a path that never went through the resolver) we fall back to
 * `getEntityMetadata`, preserving raw behaviour.
 */
const registry = new WeakMap<object, MetadataResolver>();

export const registerMetadataResolver = (
  metadata: EntityMetadata,
  resolve: MetadataResolver,
): void => {
  registry.set(metadata, resolve);
  for (const relation of metadata.relations) {
    registry.set(relation, resolve);
  }
};

/**
 * Resolve a foreign target's metadata under the naming strategy associated with
 * `owner` (a resolved metadata or relation object already in scope). Falls back
 * to raw metadata when `owner` was never registered.
 */
export const getForeignMetadata = (
  owner: object,
  foreignTarget: Parameters<MetadataResolver>[0],
): EntityMetadata => {
  const resolve = registry.get(owner);
  return resolve ? resolve(foreignTarget) : getEntityMetadata(foreignTarget);
};
