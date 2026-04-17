import { ProteusError } from "../../../../errors";
import type { MetaField } from "../../../entity/types/metadata";

/**
 * Maps a metadata field to its MySQL column type string.
 *
 * MySQL uses strict types unlike SQLite affinities. Enum types are handled
 * separately in column DDL (inline ENUM('a','b','c')). Unsupported types
 * (geometric, vector, xml) throw a ProteusError.
 */
export const mapFieldTypeMysql = (field: MetaField): string => {
  const { type, key, max } = field;

  if (type === null) {
    throw new ProteusError(`Field "${key}" has no type — cannot map to MySQL type`);
  }

  switch (type) {
    // boolean — stored as TINYINT(1)
    case "boolean":
      return "TINYINT(1)";

    // numeric (integer)
    case "smallint":
      return "SMALLINT";
    case "integer":
      return "INT";
    case "bigint":
      return "BIGINT";

    // numeric (floating point)
    case "real":
      return "FLOAT";
    case "float":
      return "DOUBLE";
    case "decimal":
      if (field.precision != null && field.scale != null) {
        return `DECIMAL(${field.precision}, ${field.scale})`;
      }
      if (field.precision != null) {
        return `DECIMAL(${field.precision})`;
      }
      return "DECIMAL";

    // string
    case "string":
      return max ? `VARCHAR(${max})` : "TEXT";
    case "varchar":
      return max ? `VARCHAR(${max})` : "VARCHAR(255)";
    case "text":
      return "TEXT";
    case "uuid":
      return "CHAR(36)";
    case "enum":
      // Enum type mapping is handled in column DDL via inline ENUM('val1','val2')
      // This fallback returns VARCHAR(255) but callers should use the enum branch in column DDL
      return "VARCHAR(255)";

    // date/time
    case "date":
      return "DATE";
    case "time":
      return "TIME(3)";
    case "timestamp":
      return "DATETIME(3)";
    case "interval":
      return "VARCHAR(255)";

    // binary
    case "binary":
      return "BLOB";

    // structured — MySQL has native JSON
    case "json":
    case "object":
    case "array":
      return "JSON";

    // network — stored as strings
    case "inet":
    case "cidr":
      return "VARCHAR(45)";
    case "macaddr":
      return "CHAR(17)";

    // logical (app-validated)
    case "email":
      return "VARCHAR(320)";
    case "url":
      return "TEXT";

    // Unsupported types — PG-specific or not applicable to MySQL
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
        `Field type "${type}" (field "${key}") is not supported by the MySQL driver`,
      );

    default:
      throw new ProteusError(`Unsupported MetaFieldType: "${type as string}"`);
  }
};
