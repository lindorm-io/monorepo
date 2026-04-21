import type { Dict } from "@lindorm/types";
import type { EntityMetadata } from "../types/metadata.js";
import { getEntityMetadata } from "../metadata/get-entity-metadata.js";

/**
 * For a single-table inheritance root entity, resolve the correct child
 * metadata based on the discriminator value found in a row.
 *
 * - If the entity has no inheritance, returns the original metadata unchanged.
 * - If the entity is a child (discriminatorValue is set), returns unchanged
 *   (child queries are already type-scoped via auto-filter).
 * - If the entity is a root (discriminatorValue is null) with children,
 *   reads the discriminator column from the row and returns the matching
 *   child metadata. Falls back to root metadata for unknown values.
 */
export const resolvePolymorphicMetadata = (
  row: Dict,
  metadata: EntityMetadata,
): EntityMetadata => {
  const { inheritance } = metadata;

  // No inheritance or entity is a child (already type-scoped) — use as-is
  if (!inheritance || inheritance.discriminatorValue != null) {
    return metadata;
  }

  // Root entity — check if row has a discriminator value pointing to a child
  const discriminatorValue = row[inheritance.discriminatorField];

  if (discriminatorValue == null) {
    // No discriminator value in row — treat as root type
    return metadata;
  }

  const childConstructor = inheritance.children.get(discriminatorValue);

  if (!childConstructor) {
    // Unknown discriminator value — fall back to root metadata
    return metadata;
  }

  return getEntityMetadata(childConstructor);
};
