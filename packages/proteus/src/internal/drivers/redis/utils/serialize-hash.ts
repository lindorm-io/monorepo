import { isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { MetaField, MetaRelation } from "../../../entity/types/metadata.js";
import { typedJsonMetaDictKey } from "../../../entity/utils/typed-json.js";
import { coerceHashValue } from "./coerce-hash-value.js";

/**
 * Serialize an entity row Dict into Redis HASH fields (Record<string, string>).
 *
 * Rules:
 * - null/undefined values are omitted (absent key = null on read)
 * - @Computed fields are skipped
 * - Embedded fields use `field.embedded.parentKey` prefix to read nested values
 * - FK columns from owning relations are serialized alongside regular fields
 * - All values are coerced to string representation via `coerceHashValue`, the
 *   same coercion the partial-update paths use
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

    result[field.key] = coerceHashValue(value, field);

    // The sidecar is already a JSON string produced by splitTypedJson — write it
    // verbatim, since coerceHashValue would stringify the string a second time.
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
