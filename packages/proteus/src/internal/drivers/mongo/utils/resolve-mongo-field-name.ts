import type { EntityMetadata } from "../../../entity/types/metadata.js";
import { resolvePropertyKey } from "../../../entity/utils/resolve-property-key.js";
import { resolveColumnNameSafe } from "../../../utils/sql/resolve-column-name.js";

/**
 * Resolve the document key a field KEY is stored under.
 *
 * - Single primary key: `_id`
 * - Composite primary key: `_id.<fieldKey>`, so a partial lookup still addresses
 *   one component of the compound id
 * - Anything else: the shared key→column resolver, relation join keys included so
 *   a criterion on an auto-projected foreign key addresses the real document key
 */
export const resolveMongoFieldName = (
  fieldKey: string,
  metadata: EntityMetadata,
): string => {
  if (metadata.primaryKeys.includes(fieldKey)) {
    return metadata.primaryKeys.length === 1 ? "_id" : `_id.${fieldKey}`;
  }

  return resolveColumnNameSafe(metadata.fields, fieldKey, metadata.relations);
};

/**
 * Resolve the document key a physical COLUMN is stored under.
 *
 * Relation `joinKeys` / `findKeys` name columns, not property keys, and a column
 * that happens to BE the primary key lands in `_id` rather than under its own
 * name — a shared-primary-key one-to-one joins on `_id`, not on `id`.
 */
export const resolveMongoColumnName = (
  column: string,
  metadata: EntityMetadata,
): string => {
  const key = resolvePropertyKey(metadata.fields, column);
  if (metadata.primaryKeys.includes(key)) {
    return metadata.primaryKeys.length === 1 ? "_id" : `_id.${key}`;
  }
  return column;
};
