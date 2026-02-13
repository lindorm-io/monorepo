import { MetaColumn } from "@lindorm/entity";
import { Primitive } from "@lindorm/json-kit";
import { Dict } from "@lindorm/types";

export const serializeHash = (
  document: Dict,
  columns: Array<MetaColumn>,
): Record<string, string> => {
  const typeMap = new Map<string, MetaColumn>();

  for (const column of columns) {
    typeMap.set(column.key, column);
  }

  const hash: Record<string, string> = {};

  for (const [key, value] of Object.entries(document)) {
    if (value === null || value === undefined) continue;

    const column = typeMap.get(key);
    const type = column?.type;

    switch (type) {
      case "array":
      case "object":
        hash[key] = new Primitive(value).toString();
        break;

      case "bigint":
        hash[key] = value.toString();
        break;

      case "boolean":
        hash[key] = value ? "true" : "false";
        break;

      case "date":
        hash[key] = value instanceof Date ? value.toISOString() : String(value);
        break;

      default:
        hash[key] = String(value);
        break;
    }
  }

  return hash;
};
