import { isObject } from "@lindorm/is";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { OrderValue } from "../../../../../types/find-options.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { NotSupportedError } from "../../../../../errors/index.js";
import { quoteIdentifier } from "../quote-identifier.js";
import { resolveColumnName } from "../resolve-column-name.js";

export const compileOrderBy = <E extends IEntity>(
  orderBy: Partial<Record<keyof E, OrderValue>> | null,
  metadata: EntityMetadata,
  tableAlias: string,
  _params: Array<unknown>,
): string => {
  if (!orderBy) return "";

  const entries = Object.entries(orderBy) as Array<[string, OrderValue]>;
  if (entries.length === 0) return "";

  const clauses = entries.map(([key, value]) => {
    if (isObject<{ $similarity: string }>(value)) {
      throw new NotSupportedError(
        "Ordering by trigram $similarity is only supported by the PostgreSQL driver",
        {
          code: "unsupported_operation",
          title: "Unsupported Operation",
          details:
            "Relevance ordering via $similarity relies on PostgreSQL's pg_trgm extension and is not available on SQLite.",
          data: { operator: "$similarity" },
        },
      );
    }
    const direction = value;
    const columnName = resolveColumnName(metadata.fields, key, metadata.relations);
    // SQLite defaults: ASC → NULLS FIRST, DESC → NULLS LAST (opposite of PostgreSQL)
    // Explicitly specify to match PostgreSQL convention expected by the TCK.
    const nullsClause = direction === "ASC" ? " NULLS LAST" : " NULLS FIRST";
    return `${quoteIdentifier(tableAlias)}.${quoteIdentifier(columnName)} ${direction}${nullsClause}`;
  });

  return `ORDER BY ${clauses.join(", ")}`;
};
