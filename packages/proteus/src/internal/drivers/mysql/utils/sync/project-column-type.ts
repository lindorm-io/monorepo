import type { MetaField } from "../../../../entity/types/metadata.js";
import type { ProjectedColumnType } from "../../../../utils/sync/sync-dialect.js";
import { extractEnumValues } from "../../../../utils/extract-enum-values.js";
import { buildEnumColumnType } from "../build-enum-column-type.js";
import { mapFieldTypeMysql } from "../map-field-type-mysql.js";

const buildEnumValues = (field: MetaField): Array<string> | null => {
  if (field.type !== "enum" || !field.enum) return null;
  const values = extractEnumValues(field.enum);
  return values.length > 0 ? values : null;
};

/**
 * MySQL column-type projection: encrypted fields collapse to "text"; enum
 * fields become inline enum('a','b') types (via `buildEnumColumnType` —
 * snapshot-locked spelling) and also carry their values on the column;
 * everything else is `mapFieldTypeMysql` lowercased.
 */
export const projectColumnType = (field: MetaField): ProjectedColumnType => {
  const enumValues = buildEnumValues(field);

  let type: string;
  if (field.encrypted) {
    type = "text";
  } else if (enumValues) {
    type = buildEnumColumnType(field)!;
  } else {
    type = mapFieldTypeMysql(field).toLowerCase();
  }

  return { type, enumValues, checkExpr: null };
};
