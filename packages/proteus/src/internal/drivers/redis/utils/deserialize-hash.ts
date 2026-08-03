import type { Dict } from "@lindorm/types";
import type {
  MetaField,
  MetaFieldMode,
  MetaFieldType,
  MetaRelation,
} from "../../../entity/types/metadata.js";
import { deserialiseForeignKey } from "../../../entity/utils/deserialise-foreign-key.js";
import { typedJsonMetaDictKey } from "../../../entity/utils/typed-json.js";
import { RedisDriverError } from "../errors/RedisDriverError.js";

/**
 * Deserialize a Redis HASH (Record<string, string>) back into an entity Dict.
 *
 * Rules:
 * - Empty hash `{}` returns null (key did not exist or was deleted)
 * - Absent key in hash maps to null in output
 * - Type dispatch reverses the serialization from serializeHash
 * - `field.transform.from()` is NOT applied here — `defaultHydrateEntity` owns it
 *   for every driver, so applying it here too transformed the value twice
 * - FK columns from owning relations are deserialized alongside regular fields
 * - A @TypedJson sidecar hash field is carried through raw for
 *   `defaultHydrateEntity` to rejoin with the data half
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
    // handles decryption uniformly for all drivers.
    if (field.encrypted) {
      result[field.key] = raw === undefined ? null : raw;
      continue;
    }

    result[field.key] =
      raw === undefined ? null : coerceFromString(raw, field.type, field.mode);

    if (field.typedJson) {
      const rawMeta = hash[typedJsonMetaDictKey(field.key)];
      result[typedJsonMetaDictKey(field.key)] = rawMeta === undefined ? null : rawMeta;
    }
  }

  for (const relation of relations) {
    if (!relation.joinKeys) continue;
    if (relation.type === "ManyToMany") continue;

    for (const [localKey, foreignPk] of Object.entries(relation.joinKeys)) {
      if (handledKeys.has(localKey)) continue;

      const raw = hash[localKey];
      handledKeys.add(localKey);

      // A projected FK has no MetaField, so `coerceFromString` has no type to
      // dispatch on — it borrows the referenced PK's type instead, exactly as the
      // hydrate path does. Redis matches criteria in memory against this row, so
      // handing back the raw hash string would leave a bigint/date FK criterion
      // silently matching nothing (and ordering it lexicographically).
      result[localKey] =
        raw === undefined ? null : deserialiseForeignKey(raw, relation, foreignPk);
    }
  }

  return result;
};

const coerceFromString = (
  raw: string,
  type: MetaFieldType | null,
  mode?: MetaFieldMode | null,
): unknown => {
  switch (type) {
    case "boolean":
      return raw === "true";

    case "bigint":
      try {
        return BigInt(raw);
      } catch {
        throw new RedisDriverError(
          `Failed to deserialize bigint from value: ${JSON.stringify(raw)}`,
          {
            code: "serialization_failure",
            title: "Serialization Failure",
            details:
              "A stored hash field typed as bigint could not be parsed into a BigInt during deserialization.",
          },
        );
      }

    case "integer":
    case "smallint": {
      const int = parseInt(raw, 10);
      if (Number.isNaN(int)) {
        throw new RedisDriverError(
          `Failed to deserialize ${type} from value: ${JSON.stringify(raw)}`,
          {
            code: "serialization_failure",
            title: "Serialization Failure",
            details: `A stored hash field typed as ${type} could not be parsed into an integer during deserialization.`,
          },
        );
      }
      return int;
    }

    case "decimal":
    case "float":
    case "real": {
      // `@Field("decimal", { mode: "string" })` exists to carry digits a JS
      // double cannot hold, so the stored string IS the value — parsing it
      // would truncate exactly the precision the mode was chosen for.
      if (type === "decimal" && mode === "string") return raw;

      const num = parseFloat(raw);
      if (Number.isNaN(num)) {
        throw new RedisDriverError(
          `Failed to deserialize ${type} from value: ${JSON.stringify(raw)}`,
          {
            code: "serialization_failure",
            title: "Serialization Failure",
            details: `A stored hash field typed as ${type} could not be parsed into a number during deserialization.`,
          },
        );
      }
      return num;
    }

    case "date":
    case "timestamp": {
      const dt = new Date(raw);
      if (isNaN(dt.getTime())) {
        throw new RedisDriverError(`Invalid date value: ${raw}`, {
          code: "serialization_failure",
          title: "Serialization Failure",
          details: `A stored hash field typed as ${type} could not be parsed into a valid Date during deserialization.`,
        });
      }
      return dt;
    }

    case "array":
    case "json":
    case "object":
      return JSON.parse(raw);

    // Bytes are stored base64-encoded by serializeHash, because a Redis hash
    // value is read back as a UTF-8 string.
    case "binary":
      return Buffer.from(raw, "base64");

    // All string-like types pass through unchanged
    case "string":
    case "text":
    case "varchar":
    case "uuid":
    case "enum":
    case "email":
    case "lindorm_id":
    case "url":
    case "cidr":
    case "inet":
    case "macaddr":
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
