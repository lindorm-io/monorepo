import { camelCase } from "@lindorm/case";
import { ProteusError } from "../../../errors/index.js";
import type { MetaField, MetaRelation } from "../../entity/types/metadata.js";

/**
 * Match a key against the join key columns of the owning-side relations.
 *
 * `joinKeys` keys are PHYSICAL column names (post naming strategy), but an
 * auto-generated FK has no MetaField, so hydration exposes its value under the
 * camelCase PROPERTY key instead (see `resolvePropertyKey`) — the two diverge
 * under the "snake" strategy (`parent_id` ↔ `parentId`). Both forms are
 * accepted so criteria read the same way the entity does, and so the physical
 * form keeps resolving for callers that already relied on it.
 *
 * The physical form is matched across ALL relations before any camelCase
 * fallback, so a hand-written `@JoinKey({ parent_id: … })` on one relation can
 * never shadow another relation's literal `parentId` column.
 */
const findJoinKeyColumn = (
  relations: Array<MetaRelation>,
  key: string,
): string | null => {
  const columns = relations.flatMap((relation) =>
    relation.joinKeys ? Object.keys(relation.joinKeys) : [],
  );

  return (
    columns.find((column) => column === key) ??
    columns.find((column) => camelCase(column) === key) ??
    null
  );
};

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
  // A declared field wins: its own key→name mapping is authoritative even when a
  // relation projects the same column.
  const field = fields.find((f) => f.key === key);
  if (field) return field.name;

  if (relations) {
    const column = findJoinKeyColumn(relations, key);
    if (column) return column;
  }

  throw new ProteusError(
    `Field "${key}" not found in metadata. Valid fields: ${fields.map((f) => f.key).join(", ") || "(none)"}`,
    {
      code: "unknown_field",
      title: "Unknown Field",
      details:
        "The referenced field is not declared on the entity and cannot be resolved to a column.",
      data: { field: key, validFields: fields.map((f) => f.key) },
    },
  );
};

/**
 * Resolves a field key to its column name, falling back to the key itself.
 * Used by DDL generators where keys may already be column names.
 */
export const resolveColumnNameSafe = (fields: Array<MetaField>, key: string): string =>
  fields.find((f) => f.key === key)?.name ?? key;
