import type { EntityMetadata } from "../../../entity/types/metadata.js";
import { getForeignMetadata } from "../../../entity/metadata/foreign-metadata.js";

/**
 * Resolve the MongoDB collection name for an entity.
 *
 * For single-table inheritance, all entities in the hierarchy share
 * the root entity's collection. Child entities (discriminatorValue != null)
 * use the root entity's name, not their own.
 *
 * For non-inheritance entities, simply returns metadata.entity.name.
 */
export const resolveCollectionName = (metadata: EntityMetadata): string => {
  if (
    metadata.inheritance &&
    metadata.inheritance.strategy === "single-table" &&
    metadata.inheritance.discriminatorValue != null
  ) {
    // Resolve the root through the child's own resolver: raw metadata carries
    // the un-renamed name, so under a renaming strategy the children addressed a
    // different collection than the root wrote to.
    const rootMetadata = getForeignMetadata(metadata, metadata.inheritance.root);
    return rootMetadata.entity.name;
  }

  return metadata.entity.name;
};
