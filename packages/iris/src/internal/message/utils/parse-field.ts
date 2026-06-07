import { IrisSerializationError } from "../../../errors/IrisSerializationError.js";
import type { MetaField } from "../types/metadata.js";
import { deserialise } from "./deserialise.js";

export const parseField = (field: MetaField, message: any, options: any): any => {
  const hasExplicitOption = field.key in options;
  const value = hasExplicitOption ? options[field.key] : message[field.key];

  if (value === null || value === undefined) {
    // Explicit null from caller on a nullable field — respect it
    if (value === null && field.nullable) return null;

    // No value provided — apply default if available
    if (field.default !== null) {
      return typeof field.default === "function" ? field.default() : field.default;
    }

    // Nullable with no default — return null
    if (field.nullable) return null;

    return value;
  }

  try {
    return deserialise(value, field.type);
  } catch (error) {
    throw new IrisSerializationError(
      `Failed to parse field "${field.key}" of type ${field.type}`,
      {
        code: "field_parse_failed",
        data: { field: field.key, type: field.type },
        debug: { value, valueType: typeof value },
        error: error instanceof Error ? error : undefined,
      },
    );
  }
};
