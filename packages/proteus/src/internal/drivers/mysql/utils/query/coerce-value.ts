import type { MetaFieldType } from "../../../../entity/types/metadata.js";

/**
 * Coerce a JavaScript value into a form MySQL can store.
 *
 * mysql2 handles most types natively, but booleans, Dates,
 * objects/arrays, and bigints need explicit conversion.
 */
export const coerceWriteValue = (
  value: unknown,
  _fieldType: MetaFieldType | null,
): unknown => {
  if (value === null || value === undefined) return value;

  // Boolean -> TINYINT(1) 0/1
  if (typeof value === "boolean") return value ? 1 : 0;

  // Date -> MySQL DATETIME(3) format: 'YYYY-MM-DD HH:MM:SS.mmm'
  // MySQL rejects ISO 8601 (with 'T' and 'Z'); must use space separator, no trailing 'Z'.
  if (value instanceof Date)
    return value.toISOString().replace("T", " ").replace("Z", "");

  // Buffer/Uint8Array -> pass through as BLOB (mysql2 handles natively)
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return value;

  // Objects and arrays -> JSON string
  if (typeof value === "object") return JSON.stringify(value);

  // bigint -> string (mysql2 handles bigint natively but string is safer)
  if (typeof value === "bigint") return String(value);

  return value;
};
