import type { Dict } from "@lindorm/types";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";

/**
 * Extract a flat Dict keyed by field key from a raw RETURNING row.
 * Maps DB column names (field.name) → entity property names (field.key).
 * Raw values are passed through — type coercion is handled by defaultHydrateEntity's deserialise.
 *
 * Also handles FK columns from owning relations.
 */
export const extractFieldDictFromReturning = (
  row: Record<string, unknown>,
  metadata: EntityMetadata,
): Dict => {
  const dict: Dict = {};

  for (const field of metadata.fields) {
    const rawValue = row[field.name];
    // RETURNING * always includes all columns; treat absent as null
    dict[field.key] = rawValue === undefined ? null : rawValue;
  }

  // FK columns from owning-side relations
  for (const relation of metadata.relations) {
    if (!relation.joinKeys || relation.type === "ManyToMany") continue;

    for (const [localKey] of Object.entries(relation.joinKeys)) {
      if (localKey in dict) continue;
      if (row[localKey] !== undefined) {
        dict[localKey] = row[localKey] ?? null;
      }
    }
  }

  return dict;
};

/**
 * Extract a flat Dict keyed by field key from a SELECT row with table aliases.
 * Maps aliased column names (e.g., "t0_userId") → entity property names ("userId").
 * Raw values are passed through — type coercion is handled by defaultHydrateEntity's deserialise.
 *
 * Also handles FK columns from owning relations.
 */
export const extractFieldDictFromAliased = (
  row: Dict,
  metadata: EntityMetadata,
  tableAlias: string,
): Dict => {
  const dict: Dict = {};

  for (const field of metadata.fields) {
    const alias = `${tableAlias}_${field.key}`;
    const rawValue = row[alias];
    // Always include all fields; default absent aliases to null (matches old hydrateEntity behaviour)
    dict[field.key] = rawValue === undefined ? null : rawValue;
  }

  // FK columns from owning-side relations
  for (const relation of metadata.relations) {
    if (!relation.joinKeys || relation.type === "ManyToMany") continue;

    for (const [localKey] of Object.entries(relation.joinKeys)) {
      if (localKey in dict) continue;
      const alias = `${tableAlias}_${localKey}`;
      if (row[alias] !== undefined) {
        dict[localKey] = row[alias] ?? null;
      }
    }
  }

  return dict;
};
