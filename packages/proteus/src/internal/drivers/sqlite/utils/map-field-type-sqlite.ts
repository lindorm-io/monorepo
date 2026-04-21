import { ProteusError } from "../../../../errors/index.js";
import type { MetaField } from "../../../entity/types/metadata.js";

/**
 * Maps a metadata field to its SQLite type affinity string.
 *
 * SQLite uses type affinities, not strict types. The affinity determines
 * how values are stored and compared. Enum types use TEXT with an inline
 * CHECK constraint generated separately.
 *
 * Unsupported PG-specific types (inet, cidr, vector, geometric, xml)
 * throw a ProteusError — they are not applicable to SQLite.
 */
export const mapFieldTypeSqlite = (field: MetaField): string => {
  const { type, key } = field;

  if (type === null) {
    throw new ProteusError(`Field "${key}" has no type — cannot map to SQLite type`);
  }

  switch (type) {
    // INTEGER affinity
    case "boolean":
    case "integer":
    case "smallint":
    case "bigint":
      return "INTEGER";

    // REAL affinity
    case "real":
    case "float":
      return "REAL";

    // NUMERIC affinity (stores exactly, no precision/scale in SQLite)
    case "decimal":
      return "NUMERIC";

    // TEXT affinity — strings, identifiers, temporal values stored as ISO strings
    case "string":
    case "varchar":
    case "text":
    case "uuid":
    case "enum":
    case "email":
    case "url":
    case "date":
    case "time":
    case "timestamp":
      return "TEXT";

    // INTERVAL — no native SQLite type; store as TEXT (ISO 8601 duration string)
    case "interval":
      return "TEXT";

    // JSON — stored as TEXT
    case "json":
    case "object":
    case "array":
      return "TEXT";

    // BLOB affinity
    case "binary":
      return "BLOB";

    // Unsupported types — PG-specific or not applicable
    case "inet":
    case "cidr":
    case "macaddr":
    case "point":
    case "line":
    case "lseg":
    case "box":
    case "path":
    case "polygon":
    case "circle":
    case "vector":
    case "xml":
      throw new ProteusError(
        `Field type "${type}" (field "${key}") is not supported by the SQLite driver`,
      );

    default:
      throw new ProteusError(`Unsupported MetaFieldType: "${type as string}"`);
  }
};
