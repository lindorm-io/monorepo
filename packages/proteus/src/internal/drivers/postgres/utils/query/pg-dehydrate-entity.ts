import type { IAmphora } from "@lindorm/amphora";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { defaultDehydrateEntity } from "../../../../entity/utils/default-dehydrate-entity.js";
import type { DehydrateMode } from "../../../../entity/utils/default-dehydrate-entity.js";
import { coerceWriteValue } from "./coerce-value.js";
import type { DehydratedColumn } from "./dehydrate-entity.js";

/**
 * Postgres-specific dehydration adapter.
 * 1. Calls defaultDehydrateEntity → gets Dict (column-name keyed)
 * 2. Applies coerceWriteValue to each value (bigint → string, etc.)
 * 3. Converts to Array<DehydratedColumn> (format compileInsert/compileUpdate consume)
 */
export const pgDehydrateEntity = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  mode: DehydrateMode,
  amphora?: IAmphora,
): Array<DehydratedColumn> => {
  const dict = defaultDehydrateEntity(entity, metadata, mode, amphora);

  const columns: Array<DehydratedColumn> = [];

  for (const [column, value] of Object.entries(dict)) {
    columns.push({ column, value: coerceWriteValue(value) });
  }

  return columns;
};
