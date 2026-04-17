import type { IAmphora } from "@lindorm/amphora";
import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "../../../../entity/types/metadata";
import { defaultDehydrateEntity } from "../../../../entity/utils/default-dehydrate-entity";
import type { DehydrateMode } from "../../../../entity/utils/default-dehydrate-entity";
import { coerceWriteValue } from "./coerce-value";
import type { DehydratedColumn } from "./dehydrate-entity";

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
