import { IrisSerializationError } from "../../../errors/IrisSerializationError";
import type { MetaField } from "../types/metadata";
import { deserialise } from "./deserialise";

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
        debug: { field: field.key, value, type: typeof value, error },
      },
    );
  }
};
