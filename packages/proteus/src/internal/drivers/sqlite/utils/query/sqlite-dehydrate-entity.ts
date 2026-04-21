import type { IAmphora } from "@lindorm/amphora";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { defaultDehydrateEntity } from "../../../../entity/utils/default-dehydrate-entity.js";
import type { DehydrateMode } from "../../../../entity/utils/default-dehydrate-entity.js";
import { coerceWriteValue } from "./coerce-value.js";
import type { DehydratedColumn } from "./dehydrate-entity.js";

/**
 * SQLite-specific dehydration adapter.
 * 1. Calls defaultDehydrateEntity -> gets Dict (column-name keyed)
 * 2. Applies coerceWriteValue to each value (boolean -> 0/1, Date -> ISO string, etc.)
 * 3. Converts to Array<DehydratedColumn> (format compileInsert/compileUpdate consume)
 */
export const sqliteDehydrateEntity = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  mode: DehydrateMode,
  amphora?: IAmphora,
): Array<DehydratedColumn> => {
  const dict = defaultDehydrateEntity(entity, metadata, mode, amphora);

  const columns: Array<DehydratedColumn> = [];

  for (const [column, value] of Object.entries(dict)) {
    // Look up field type for SQLite-specific coercion
    const field = metadata.fields.find((f) => f.name === column);
    columns.push({ column, value: coerceWriteValue(value, field?.type ?? null) });
  }

  return columns;
};
