import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { compileGroupBy as shared } from "../../../../utils/sql/compile-group-by.js";
import { postgresDialect } from "../postgres-dialect.js";

export const compileGroupBy = <E extends IEntity>(
  groupBy: Array<keyof E> | null,
  metadata: EntityMetadata,
  tableAlias: string,
): string => shared(groupBy, metadata, tableAlias, postgresDialect);
