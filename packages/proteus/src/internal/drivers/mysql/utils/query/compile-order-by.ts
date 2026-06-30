import { isObject } from "@lindorm/is";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { OrderValue } from "../../../../../types/find-options.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { NotSupportedError } from "../../../../../errors/index.js";
import { quoteIdentifier } from "../quote-identifier.js";
import { resolveColumnName } from "../resolve-column-name.js";

/**
 * Compile ORDER BY clause for MySQL.
 *
 * MySQL does not support NULLS LAST / NULLS FIRST natively.
 * Emulation:
 *   ASC  + NULLS LAST:  ORDER BY (`col` IS NULL), `col` ASC
 *   DESC + NULLS FIRST: ORDER BY (`col` IS NOT NULL), `col` DESC
 *
 * This matches the PostgreSQL convention expected by the TCK.
 */
export const compileOrderBy = <E extends IEntity>(
  orderBy: Partial<Record<keyof E, OrderValue>> | null,
  metadata: EntityMetadata,
  tableAlias: string,
  _params: Array<unknown>,
): string => {
  if (!orderBy) return "";

  const entries = Object.entries(orderBy) as Array<[string, OrderValue]>;
  if (entries.length === 0) return "";

  const clauses = entries.flatMap(([key, value]) => {
    if (isObject<{ $similarity: string }>(value)) {
      throw new NotSupportedError(
        "Ordering by trigram $similarity is only supported by the PostgreSQL driver",
        {
          code: "unsupported_operation",
          title: "Unsupported Operation",
          details:
            "Relevance ordering via $similarity relies on PostgreSQL's pg_trgm extension and is not available on MySQL.",
          data: { operator: "$similarity" },
        },
      );
    }
    const direction = value;
    const columnName = resolveColumnName(metadata.fields, key, metadata.relations);
    const qualifiedCol = `${quoteIdentifier(tableAlias)}.${quoteIdentifier(columnName)}`;

    if (direction === "ASC") {
      // NULLS LAST for ASC: sort NULL rows to end
      return [`(${qualifiedCol} IS NULL)`, `${qualifiedCol} ASC`];
    }
    // NULLS FIRST for DESC: sort NULL rows to beginning
    return [`(${qualifiedCol} IS NOT NULL)`, `${qualifiedCol} DESC`];
  });

  return `ORDER BY ${clauses.join(", ")}`;
};
