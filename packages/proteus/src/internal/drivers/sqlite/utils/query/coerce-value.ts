import { isString } from "@lindorm/is";
import type { MetaFieldType } from "#internal/entity/types/metadata";

/**
 * Coerce a value read from SQLite into the JavaScript type expected by the entity field.
 *
 * SQLite does not have native boolean, Date, or JSON types — they are stored as
 * INTEGER (0/1), TEXT (ISO 8601), and TEXT (JSON string) respectively.
 * bigint comes back as BigInt when safeIntegers mode is enabled on the Database instance.
 */
export const coerceReadValue = (
  value: unknown,
  fieldType: MetaFieldType | null,
): unknown => {
  if (value === null || value === undefined) return value;

  switch (fieldType) {
    case "boolean":
      // SQLite stores boolean as INTEGER 0/1; coerce back to boolean
      if (value === 0 || value === 0n) return false;
      if (value === 1 || value === 1n) return true;
      return Boolean(value);

    case "date":
    case "time":
    case "timestamp":
      // Stored as ISO 8601 TEXT; parse back to Date
      return isString(value) ? new Date(value) : value;

    case "json":
    case "object":
    case "array":
      // Stored as JSON TEXT; parse back
      return isString(value) ? JSON.parse(value) : value;

    case "bigint":
      // With safeIntegers=true, comes back as BigInt already; handle number fallback
      if (typeof value === "bigint") return value;
      if (isString(value)) return BigInt(value);
      if (typeof value === "number") return BigInt(value);
      return value;

    case "decimal":
    case "float":
    case "real":
      return typeof value === "bigint"
        ? Number(value)
        : isString(value)
          ? Number(value)
          : value;

    case "integer":
    case "smallint":
      return typeof value === "bigint"
        ? Number(value)
        : isString(value)
          ? Number(value)
          : value;

    default:
      return value;
  }
};

/**
 * Coerce a JavaScript value into a form SQLite can store.
 *
 * better-sqlite3 handles most types natively, but booleans, Dates,
 * objects/arrays, and bigints need explicit conversion.
 */
export const coerceWriteValue = (
  value: unknown,
  _fieldType: MetaFieldType | null,
): unknown => {
  if (value === null || value === undefined) return value;

  // Boolean → INTEGER 0/1
  if (typeof value === "boolean") return value ? 1 : 0;

  // Date → ISO 8601 string
  if (value instanceof Date) return value.toISOString();

  // Buffer/Uint8Array → pass through as BLOB (better-sqlite3 handles natively)
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return value;

  // Objects and arrays → JSON string
  if (typeof value === "object") return JSON.stringify(value);

  // bigint stays as bigint — better-sqlite3 handles it natively
  return value;
};
