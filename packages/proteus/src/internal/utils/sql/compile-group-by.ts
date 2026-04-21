import type { IEntity } from "../../../interfaces/index.js";
import type { EntityMetadata } from "../../entity/types/metadata.js";
import { resolveColumnName } from "./resolve-column-name.js";
import type { SqlDialect } from "./sql-dialect.js";

export const compileGroupBy = <E extends IEntity>(
  groupBy: Array<keyof E> | null,
  metadata: EntityMetadata,
  tableAlias: string,
  dialect: SqlDialect,
): string => {
  if (!groupBy || groupBy.length === 0) return "";

  const columns = groupBy.map((key) => {
    const colName = resolveColumnName(metadata.fields, key as string, metadata.relations);
    return `${dialect.quoteIdentifier(tableAlias)}.${dialect.quoteIdentifier(colName)}`;
  });

  return `GROUP BY ${columns.join(", ")}`;
};
