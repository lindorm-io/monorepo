import { ProteusError } from "../../../errors";
import type { MetaField, MetaRelation } from "#internal/entity/types/metadata";

/**
 * Resolves a field key to its column name.
 * Throws ProteusError when the field is not found (query-layer safety).
 *
 * When `relations` is provided, join key columns from owning-side relations
 * are also checked. This allows WHERE clauses to reference FK columns that
 * are auto-generated (not explicitly declared with @Field).
 */
export const resolveColumnName = (
  fields: Array<MetaField>,
  key: string,
  relations?: Array<MetaRelation>,
): string => {
  const field = fields.find((f) => f.key === key);
  if (field) return field.name;

  if (relations) {
    for (const relation of relations) {
      if (!relation.joinKeys) continue;
      if (Object.prototype.hasOwnProperty.call(relation.joinKeys, key)) return key;
    }
  }

  throw new ProteusError(
    `Field "${key}" not found in metadata. Valid fields: ${fields.map((f) => f.key).join(", ") || "(none)"}`,
  );
};

/**
 * Resolves a field key to its column name, falling back to the key itself.
 * Used by DDL generators where keys may already be column names.
 */
export const resolveColumnNameSafe = (fields: Array<MetaField>, key: string): string =>
  fields.find((f) => f.key === key)?.name ?? key;
