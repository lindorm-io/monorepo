import type { Dict } from "@lindorm/types";
import type { MetaField, MetaRelation } from "#internal/entity/types/metadata";

/**
 * Serialize an entity row Dict into Redis HASH fields (Record<string, string>).
 *
 * Rules:
 * - null/undefined values are omitted (absent key = null on read)
 * - @Computed fields are skipped
 * - Embedded fields use `field.embedded.parentKey` prefix to read nested values
 * - FK columns from owning relations are serialized alongside regular fields
 * - All values are coerced to string representation
 */
export const serializeHash = (
  row: Dict,
  fields: Array<MetaField>,
  relations: Array<MetaRelation>,
): Record<string, string> => {
  const result: Record<string, string> = {};
  const handledKeys = new Set<string>();

  for (const field of fields) {
    if (field.computed) continue;

    const value = row[field.key];
    handledKeys.add(field.key);

    if (value == null) continue;

    // Encrypted fields are already string ciphertext after dehydrateToRow —
    // skip coerceToString which would JSON.stringify string values for json/array/object types.
    if (field.encrypted && typeof value === "string") {
      result[field.key] = value;
      continue;
    }

    result[field.key] = coerceToString(value, field.type);
  }

  for (const relation of relations) {
    if (!relation.joinKeys) continue;
    if (relation.type === "ManyToMany") continue;

    for (const localKey of Object.keys(relation.joinKeys)) {
      if (handledKeys.has(localKey)) continue;

      const value = row[localKey];
      handledKeys.add(localKey);

      if (value == null) continue;

      result[localKey] = String(value);
    }
  }

  return result;
};

const coerceToString = (value: unknown, type: string | null): string => {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return String(value);
  if (typeof value === "number") return String(value);

  if (type === "array" || type === "json" || type === "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
    return JSON.stringify(value);
  }

  return String(value);
};
