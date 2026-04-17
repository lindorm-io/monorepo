import type { EntityMetadata } from "../../../entity/types/metadata";
import { getEntityMetadata } from "../../../entity/metadata/get-entity-metadata";

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
    const rootMetadata = getEntityMetadata(metadata.inheritance.root);
    return rootMetadata.entity.name;
  }

  return metadata.entity.name;
};
