import { MetaColumn } from "@lindorm/entity";
import { deserialise } from "@lindorm/json-kit";
import { Dict } from "@lindorm/types";

/**
 * Converts Redis HGETALL output back to a Dict suitable for this.create().
 *
 * Uses the shared deserialize() function for type coercion.
 * Missing hash fields are set to null for the entity constructor.
 * FK columns without column metadata are passed through as strings.
 */
export const deserializeHash = (
  hash: Record<string, string>,
  columns: Array<MetaColumn>,
): Dict => {
  const result: Dict = {};

  for (const column of columns) {
    const value = hash[column.key];

    if (value === undefined) {
      result[column.key] = null;
      continue;
    }

    result[column.key] = column.type ? deserialise(value, column.type) : value;
  }

  // Passthrough FK columns and other fields not in column metadata
  for (const [key, value] of Object.entries(hash)) {
    if (result[key] !== undefined) continue;
    result[key] = value;
  }

  return result;
};
