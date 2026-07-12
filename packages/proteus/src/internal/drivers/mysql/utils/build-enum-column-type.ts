import type { MetaField } from "../../../entity/types/metadata.js";
import { extractEnumValues } from "../../../utils/extract-enum-values.js";

/**
 * Builds the inline MySQL enum column type — enum('a','b') with single-quote
 * escaping, comma-joined without spaces (snapshot-locked spelling) — or null
 * when the field is not an enum. Single-sourced so PK columns and the FK
 * columns referencing them spell the type identically (InnoDB requires FK and
 * referenced column types to match).
 */
export const buildEnumColumnType = (field: MetaField): string | null => {
  if (field.type !== "enum" || !field.enum) return null;
  const values = extractEnumValues(field.enum);
  if (values.length === 0) return null;
  const escaped = values.map((v) => `'${v.replace(/'/g, "''")}'`).join(",");
  return `enum(${escaped})`;
};
