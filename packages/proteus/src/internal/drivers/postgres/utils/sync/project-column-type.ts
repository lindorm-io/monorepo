import type { MetaField } from "../../../../entity/types/metadata.js";
import type { ProjectedColumnType } from "../../../../utils/sync/sync-dialect.js";
import { mapFieldType } from "../map-field-type.js";

/**
 * Postgres column-type projection: encrypted fields collapse to "text";
 * everything else goes through `mapFieldType` (which resolves named enum type
 * references). Enum values/checks ride on the named enum TYPE, not the column.
 */
export const projectColumnType = (
  field: MetaField,
  tableName: string,
  namespace: string | null,
): ProjectedColumnType => ({
  type: field.encrypted ? "text" : mapFieldType(field, tableName, namespace),
  enumValues: null,
  checkExpr: null,
});
