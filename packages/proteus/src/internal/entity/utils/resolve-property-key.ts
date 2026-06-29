import { camelCase } from "@lindorm/case";
import type { EntityMetadata } from "../types/metadata.js";

/**
 * Resolve the entity *property* key for a relation join column.
 *
 * Relation `joinKeys` / `findKeys` keys are physical COLUMN names (after the
 * naming strategy is applied). For reading/writing the corresponding value on an
 * entity instance we need the PROPERTY key instead, which diverges from the
 * column under the "snake" strategy (e.g. column `author_id` ↔ property
 * `authorId`, column `parent_id` ↔ implicit FK property `parentId`).
 *
 * Resolution order:
 * 1. A declared field whose column name matches → its property key.
 * 2. Otherwise the camelCase form of the column (implicit FK pseudo-columns are
 *    generated as camelCase property keys by `calculateJoinKeys`).
 *
 * Under "none"/"camel" the column already equals the property key, so this is a
 * no-op (declared fields match by name; implicit keys are already camelCase).
 */
export const resolvePropertyKey = (
  metadata: EntityMetadata,
  columnKey: string,
): string => {
  const field = metadata.fields.find((f) => f.name === columnKey);
  if (field) return field.key;
  return camelCase(columnKey);
};
