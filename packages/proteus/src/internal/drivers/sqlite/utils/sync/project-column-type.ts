import type { MetaField } from "../../../../entity/types/metadata.js";
import type { ProjectedColumnType } from "../../../../utils/sync/sync-dialect.js";
import { extractEnumValues } from "../../../../utils/extract-enum-values.js";
import { mapFieldTypeSqlite } from "../map-field-type-sqlite.js";
import { quoteIdentifier } from "../quote-identifier.js";

const buildEnumCheckExpr = (field: MetaField, colName: string): string | null => {
  if (field.type !== "enum" || !field.enum) return null;
  const values = extractEnumValues(field.enum);
  if (values.length === 0) return null;
  const escaped = values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
  return `CHECK(${quoteIdentifier(colName)} IN (${escaped}))`;
};

/**
 * SQLite column-type projection: encrypted fields collapse to "TEXT";
 * everything else is a `mapFieldTypeSqlite` affinity. Enum fields get an
 * inline CHECK("col" IN ('a', 'b')) expression (comma-space joined —
 * snapshot-locked spelling).
 */
export const projectColumnType = (field: MetaField): ProjectedColumnType => ({
  type: field.encrypted ? "TEXT" : mapFieldTypeSqlite(field),
  enumValues: null,
  checkExpr: buildEnumCheckExpr(field, field.name),
});
