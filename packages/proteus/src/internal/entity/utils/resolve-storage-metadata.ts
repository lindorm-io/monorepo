import type { EntityMetadata } from "../types/metadata.js";
import { getForeignMetadata } from "../metadata/foreign-metadata.js";
import { resolveInheritanceRoot } from "./resolve-inheritance-root.js";

/**
 * Resolve the naming-aware metadata of an entity's STORAGE root — the single-table
 * inheritance root whose strategy-applied name is the physical table. For a
 * non-inherited entity this is the entity's own metadata; for an inheritance child
 * it is the root's metadata, resolved through the same source resolver so the table
 * name follows the naming strategy.
 */
export const resolveStorageMetadata = (metadata: EntityMetadata): EntityMetadata => {
  const root = resolveInheritanceRoot(metadata.target, metadata);
  return root === metadata.target ? metadata : getForeignMetadata(metadata, root);
};
