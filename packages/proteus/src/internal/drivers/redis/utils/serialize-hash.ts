import { isBuffer, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { MetaField, MetaRelation } from "../../../entity/types/metadata.js";
import { stringifyForStorage } from "../../../entity/utils/stringify-for-storage.js";
import { typedJsonMetaDictKey } from "../../../entity/utils/typed-json.js";

/**
 * Serialize an entity row Dict into Redis HASH fields (Record<string, string>).
 *
 * Rules:
 * - null/undefined values are omitted (absent key = null on read)
 * - @Computed fields are skipped
 * - Embedded fields use `field.embedded.parentKey` prefix to read nested values
 * - FK columns from owning relations are serialized alongside regular fields
 * - All values are coerced to string representation
 * - A @TypedJson field additionally emits its sidecar hash field, keyed by
 *   `typedJsonMetaDictKey` so read-back needs no name mapping
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

    // The sidecar is already a JSON string produced by splitTypedJson — write it
    // verbatim, since coerceToString would stringify the string a second time.
    if (field.typedJson) {
      const meta = row[typedJsonMetaDictKey(field.key)];
      if (isString(meta)) {
        result[typedJsonMetaDictKey(field.key)] = meta;
      }
    }
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
  // A Redis hash value is read back as a UTF-8 string, so raw bytes cannot be
  // stored verbatim — they are base64-encoded. NOT the `{"type":"Buffer",
  // "data":[…]}` shape a plain stringify emits: that string cannot be decoded
  // back into the original bytes, so binary columns round-tripped to garbage.
  if (type === "binary" && isBuffer(value)) return value.toString("base64");

  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return String(value);
  if (typeof value === "number") return String(value);

  // Bigint-hardened stringify: a typed bigint array (@Field("array", { arrayType:
  // "bigint" })) stores each element as a decimal string rather than throwing;
  // deserialise restores the exact BigInt on read.
  if (type === "array" || type === "json" || type === "object") {
    return stringifyForStorage(value);
  }

  if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
    return stringifyForStorage(value);
  }

  return String(value);
};
