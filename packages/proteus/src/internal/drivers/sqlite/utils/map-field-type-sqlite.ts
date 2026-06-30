import { NotSupportedError } from "../../../../errors/index.js";
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
    throw new NotSupportedError(
      `Field "${key}" has no type — cannot map to SQLite type`,
      {
        code: "unsupported_column_type",
        title: "Unsupported Column Type",
        details:
          "The field has no declared type and cannot be mapped to a SQLite affinity.",
        data: { column: key },
      },
    );
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

    // decimal: number mode uses NUMERIC affinity (stored as REAL/INTEGER, which
    // is lossless within JS-number range). String mode needs TEXT affinity —
    // NUMERIC affinity would coerce a high-precision string to a lossy REAL,
    // defeating the exact arbitrary-precision contract.
    case "decimal":
      return field.mode === "string" ? "TEXT" : "NUMERIC";

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
      throw new NotSupportedError(
        `Field type "${type}" (field "${key}") is not supported by the SQLite driver`,
        {
          code: "unsupported_column_type",
          title: "Unsupported Column Type",
          details:
            "This field type is PostgreSQL-specific and not supported by the SQLite driver.",
          data: { column: key, type },
        },
      );

    default:
      throw new NotSupportedError(`Unsupported MetaFieldType: "${type as string}"`, {
        code: "unsupported_column_type",
        title: "Unsupported Column Type",
        details:
          "The field declares a MetaFieldType the SQLite driver does not recognize.",
        data: { type: type as string },
      });
  }
};
