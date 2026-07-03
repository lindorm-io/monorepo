import { isObject } from "@lindorm/is";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { OrderValue } from "../../../../../types/find-options.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { NotSupportedError } from "../../../../../errors/index.js";
import type { RawOrderByEntry } from "../../../../types/query.js";
import { compileRawOrderTerms } from "../../../../utils/sql/compile-raw-order-by.js";
import { mysqlDialect } from "../mysql-dialect.js";
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
 *
 * Raw ORDER BY fragments are appended verbatim after the field terms, in the
 * order the raw calls were made.
 */
export const compileOrderBy = <E extends IEntity>(
  orderBy: Partial<Record<keyof E, OrderValue>> | null,
  metadata: EntityMetadata,
  tableAlias: string,
  params: Array<unknown>,
  rawOrderBy: Array<RawOrderByEntry> = [],
): string => {
  const clauses: Array<string> = [];

  if (orderBy) {
    const entries = Object.entries(orderBy) as Array<[string, OrderValue]>;
    for (const [key, value] of entries) {
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
        clauses.push(`(${qualifiedCol} IS NULL)`, `${qualifiedCol} ASC`);
      } else {
        // NULLS FIRST for DESC: sort NULL rows to beginning
        clauses.push(`(${qualifiedCol} IS NOT NULL)`, `${qualifiedCol} DESC`);
      }
    }
  }

  clauses.push(...compileRawOrderTerms(rawOrderBy, params, mysqlDialect));

  if (clauses.length === 0) return "";

  return `ORDER BY ${clauses.join(", ")}`;
};
