import { isObject } from "@lindorm/is";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { OrderValue } from "../../../../../types/find-options.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { RawOrderByEntry } from "../../../../types/query.js";
import { compileRawOrderTerms } from "../../../../utils/sql/compile-raw-order-by.js";
import { postgresDialect } from "../postgres-dialect.js";
import { quoteIdentifier } from "../quote-identifier.js";
import { resolveColumnName } from "../resolve-column-name.js";

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
      const columnName = resolveColumnName(metadata.fields, key, metadata.relations);
      const qualifiedCol = `${quoteIdentifier(tableAlias)}.${quoteIdentifier(columnName)}`;

      if (isObject<{ $similarity: string; dir?: "ASC" | "DESC" }>(value)) {
        params.push(value.$similarity);
        clauses.push(
          `similarity(${qualifiedCol}, $${params.length}) ${value.dir ?? "DESC"}`,
        );
      } else {
        clauses.push(`${qualifiedCol} ${value}`);
      }
    }
  }

  clauses.push(...compileRawOrderTerms(rawOrderBy, params, postgresDialect));

  if (clauses.length === 0) return "";

  return `ORDER BY ${clauses.join(", ")}`;
};
