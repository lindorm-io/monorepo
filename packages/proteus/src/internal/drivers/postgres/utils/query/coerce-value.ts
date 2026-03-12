import { isString } from "@lindorm/is";
import type { MetaFieldType } from "#internal/entity/types/metadata";

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

export const coerceWriteValue = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  return value;
};
