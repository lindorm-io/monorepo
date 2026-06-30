import { isObject } from "@lindorm/is";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { OrderValue } from "../../../../../types/find-options.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { quoteIdentifier } from "../quote-identifier.js";
import { resolveColumnName } from "../resolve-column-name.js";

export const compileOrderBy = <E extends IEntity>(
  orderBy: Partial<Record<keyof E, OrderValue>> | null,
  metadata: EntityMetadata,
  tableAlias: string,
  params: Array<unknown>,
): string => {
  if (!orderBy) return "";

  const entries = Object.entries(orderBy) as Array<[string, OrderValue]>;
  if (entries.length === 0) return "";

  const clauses = entries.map(([key, value]) => {
    const columnName = resolveColumnName(metadata.fields, key, metadata.relations);
    const qualifiedCol = `${quoteIdentifier(tableAlias)}.${quoteIdentifier(columnName)}`;

    if (isObject<{ $similarity: string; dir?: "ASC" | "DESC" }>(value)) {
      params.push(value.$similarity);
      return `similarity(${qualifiedCol}, $${params.length}) ${value.dir ?? "DESC"}`;
    }

    return `${qualifiedCol} ${value}`;
  });

  return `ORDER BY ${clauses.join(", ")}`;
};
