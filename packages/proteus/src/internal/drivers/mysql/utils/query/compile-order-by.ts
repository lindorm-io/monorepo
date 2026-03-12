import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import { quoteIdentifier } from "../quote-identifier";
import { resolveColumnName } from "../resolve-column-name";

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
  orderBy: Partial<Record<keyof E, "ASC" | "DESC">> | null,
  metadata: EntityMetadata,
  tableAlias: string,
): string => {
  if (!orderBy) return "";

  const entries = Object.entries(orderBy) as Array<[string, "ASC" | "DESC"]>;
  if (entries.length === 0) return "";

  const clauses = entries.flatMap(([key, direction]) => {
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
