import { isString } from "@lindorm/is";
import type { MetaField, MetaFieldType } from "../../../../entity/types/metadata.js";

export const coerceReadValue = (
  value: unknown,
  fieldType: MetaFieldType | null,
): unknown => {
  if (value === null || value === undefined) return value;

  switch (fieldType) {
    case "bigint":
      return isString(value) ? BigInt(value) : value;

    case "decimal":
    case "float":
    case "real":
      return isString(value) ? Number(value) : value;

    case "integer":
    case "smallint":
      return isString(value) ? Number(value) : value;

    default:
      return value;
  }
};

export const coerceWriteValue = (value: unknown, field?: MetaField | null): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  // JSONB-backed array fallback (@Field("array") with no arrayType → JSONB column).
  // node-postgres serializes a JS array as a Postgres array literal `{a,b}`, which is
  // invalid for jsonb; JSON-stringify so it round-trips as a JSON array `["a","b"]`.
  // Native arrays (arrayType set → ::type[] column) must stay raw arrays.
  if (field?.type === "array" && !field.arrayType && Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return value;
};
