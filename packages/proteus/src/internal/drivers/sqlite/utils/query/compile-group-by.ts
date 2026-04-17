import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "../../../../entity/types/metadata";
import { compileGroupBy as shared } from "../../../../utils/sql/compile-group-by";
import { sqliteDialect } from "../sqlite-dialect";

export const compileGroupBy = <E extends IEntity>(
  groupBy: Array<keyof E> | null,
  metadata: EntityMetadata,
  tableAlias: string,
): string => shared(groupBy, metadata, tableAlias, sqliteDialect);
