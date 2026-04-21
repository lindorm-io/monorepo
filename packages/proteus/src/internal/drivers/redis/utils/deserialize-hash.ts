import type { Dict } from "@lindorm/types";
import type {
  MetaField,
  MetaFieldType,
  MetaRelation,
} from "../../../entity/types/metadata.js";
import { RedisDriverError } from "../errors/RedisDriverError.js";

/**
 * Deserialize a Redis HASH (Record<string, string>) back into an entity Dict.
 *
 * Rules:
 * - Empty hash `{}` returns null (key did not exist or was deleted)
 * - Absent key in hash maps to null in output
 * - Type dispatch reverses the serialization from serializeHash
 * - Applies `field.transform.from()` if present
 * - FK columns from owning relations are deserialized alongside regular fields
 */
export const deserializeHash = (
  hash: Record<string, string>,
  fields: Array<MetaField>,
  relations: Array<MetaRelation>,
): Dict | null => {
  const keys = Object.keys(hash);
  if (keys.length === 0) return null;

  const result: Dict = {};
  const handledKeys = new Set<string>();

  for (const field of fields) {
    if (field.computed) continue;

    const raw = hash[field.key];
    handledKeys.add(field.key);

    // Encrypted fields: pass ciphertext through as-is — defaultHydrateEntity
    // handles decryption and transform.from() uniformly for all drivers.
    if (field.encrypted) {
      result[field.key] = raw === undefined ? null : raw;
      continue;
    }

    let value: unknown;

    if (raw === undefined) {
      value = null;
    } else {
      value = coerceFromString(raw, field.type);
    }

    if (value != null && field.transform) {
      value = field.transform.from(value);
    }

    result[field.key] = value;
  }

  for (const relation of relations) {
    if (!relation.joinKeys) continue;
    if (relation.type === "ManyToMany") continue;

    for (const localKey of Object.keys(relation.joinKeys)) {
      if (handledKeys.has(localKey)) continue;

      const raw = hash[localKey];
      handledKeys.add(localKey);

      result[localKey] = raw === undefined ? null : raw;
    }
  }

  return result;
};

const coerceFromString = (raw: string, type: MetaFieldType | null): unknown => {
  switch (type) {
    case "boolean":
      return raw === "true";

    case "bigint":
      try {
        return BigInt(raw);
      } catch {
        throw new RedisDriverError(
          `Failed to deserialize bigint from value: ${JSON.stringify(raw)}`,
        );
      }

    case "integer":
    case "smallint": {
      const int = parseInt(raw, 10);
      if (Number.isNaN(int)) {
        throw new RedisDriverError(
          `Failed to deserialize ${type} from value: ${JSON.stringify(raw)}`,
        );
      }
      return int;
    }

    case "decimal":
    case "float":
    case "real": {
      const num = parseFloat(raw);
      if (Number.isNaN(num)) {
        throw new RedisDriverError(
          `Failed to deserialize ${type} from value: ${JSON.stringify(raw)}`,
        );
      }
      return num;
    }

    case "date":
    case "timestamp": {
      const dt = new Date(raw);
      if (isNaN(dt.getTime())) {
        throw new RedisDriverError(`Invalid date value: ${raw}`);
      }
      return dt;
    }

    case "array":
    case "json":
    case "object":
      return JSON.parse(raw);

    // All string-like types pass through unchanged
    case "string":
    case "text":
    case "varchar":
    case "uuid":
    case "enum":
    case "email":
    case "url":
    case "cidr":
    case "inet":
    case "macaddr":
    case "binary":
    case "time":
    case "interval":
    case "xml":
    case "box":
    case "circle":
    case "line":
    case "lseg":
    case "path":
    case "point":
    case "polygon":
    case "vector":
      return raw;

    default:
      return raw;
  }
};
