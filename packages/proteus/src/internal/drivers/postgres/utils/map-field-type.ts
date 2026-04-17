import { getEnumTypeName } from "../../../drivers/postgres/utils/get-enum-type-name";
import { ProteusError } from "../../../../errors";
import type { MetaField } from "../../../entity/types/metadata";
import { quoteQualifiedName } from "./quote-identifier";

/**
 * Maps a metadata field to its PostgreSQL type string. Handles all supported types
 * including precision/scale for decimal, max-length for varchar/string/vector,
 * enum type references, native array types (falling back to JSONB when `arrayType`
 * is unset), and logical types (email/url → TEXT).
 */
export const mapFieldType = (
  field: MetaField,
  tableName: string,
  namespace: string | null,
): string => {
  const { type, key, max } = field;

  if (type === null) {
    throw new ProteusError(`Field "${key}" has no type — cannot map to PostgreSQL type`);
  }

  switch (type) {
    // boolean
    case "boolean":
      return "BOOLEAN";

    // numeric (integer)
    case "smallint":
      return "SMALLINT";
    case "integer":
      return "INTEGER";
    case "bigint":
      return "BIGINT";

    // numeric (floating point)
    case "real":
      return "REAL";
    case "float":
      return "DOUBLE PRECISION";
    case "decimal":
      if (field.precision != null && field.scale != null) {
        return `NUMERIC(${field.precision}, ${field.scale})`;
      }
      if (field.precision != null) {
        return `NUMERIC(${field.precision})`;
      }
      return "NUMERIC";

    // string
    case "string":
      return max ? `VARCHAR(${max})` : "TEXT";
    case "varchar":
      if (!max) {
        throw new ProteusError(`Field "${key}" uses "varchar" type but "max" is not set`);
      }
      return `VARCHAR(${max})`;
    case "text":
      return "TEXT";
    case "uuid":
      return "UUID";
    case "enum":
      return quoteQualifiedName(namespace, getEnumTypeName(tableName, field.name));

    // date/time
    case "date":
      return "DATE";
    case "time":
      return "TIME";
    case "timestamp":
      return "TIMESTAMPTZ(3)";
    case "interval":
      return "INTERVAL";

    // binary
    case "binary":
      return "BYTEA";

    // structured
    case "json":
    case "object":
      return "JSONB";
    case "array":
      if (field.arrayType) {
        // Create a temporary field-like object to map the element type
        const elementType = mapFieldType(
          { ...field, type: field.arrayType, arrayType: null },
          tableName,
          namespace,
        );
        return `${elementType}[]`;
      }
      // When arrayType is not specified, JSONB is used as a flexible fallback.
      // For native PostgreSQL array operators (ANY, @>, GIN indexing), set arrayType on the field.
      return "JSONB";

    // network
    case "inet":
      return "INET";
    case "cidr":
      return "CIDR";
    case "macaddr":
      return "MACADDR";

    // geometric
    case "point":
      return "POINT";
    case "line":
      return "LINE";
    case "lseg":
      return "LSEG";
    case "box":
      return "BOX";
    case "path":
      return "PATH";
    case "polygon":
      return "POLYGON";
    case "circle":
      return "CIRCLE";

    // vector
    case "vector":
      return max ? `VECTOR(${max})` : "VECTOR";

    // xml
    case "xml":
      return "XML";

    // logical (app-validated, stored as TEXT)
    case "email":
    case "url":
      return "TEXT";

    default:
      throw new ProteusError(`Unsupported MetaFieldType: "${type as string}"`);
  }
};
