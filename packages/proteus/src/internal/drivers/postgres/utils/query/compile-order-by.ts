import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "../../../../entity/types/metadata";
import { quoteIdentifier } from "../quote-identifier";
import { resolveColumnName } from "../resolve-column-name";

export const compileOrderBy = <E extends IEntity>(
  orderBy: Partial<Record<keyof E, "ASC" | "DESC">> | null,
  metadata: EntityMetadata,
  tableAlias: string,
): string => {
  if (!orderBy) return "";

  const entries = Object.entries(orderBy) as Array<[string, "ASC" | "DESC"]>;
  if (entries.length === 0) return "";

  const clauses = entries.map(([key, direction]) => {
    const columnName = resolveColumnName(metadata.fields, key, metadata.relations);
    return `${quoteIdentifier(tableAlias)}.${quoteIdentifier(columnName)} ${direction}`;
  });

  return `ORDER BY ${clauses.join(", ")}`;
};
