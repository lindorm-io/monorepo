import type { Predicate } from "@lindorm/types";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { createEmptyState } from "../../../../../classes/QueryBuilder.js";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier.js";
import { resolveColumnName } from "../resolve-column-name.js";
import type { CompiledSql } from "./compiled-sql.js";
import { buildInheritanceAliases } from "./compile-inheritance-join.js";
import { compileWhereWithFilters } from "./compile-system-filters.js";
import { resolveTableName } from "./resolve-table-name.js";
import { removeTableAlias } from "./compile-helpers.js";

/**
 * Compile an atomic increment/decrement UPDATE for SQLite.
 *
 * SQLite does not support UPDATE ... AS alias or UPDATE ... FROM for joins.
 * For joined inheritance children, a subquery approach is used to filter
 * by child-table columns.
 */
export const compileIncrement = <E extends IEntity>(
  criteria: Predicate<E>,
  property: keyof E,
  value: number,
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledSql => {
  const resolved = resolveTableName(metadata, namespace);
  const tableName = quoteQualifiedName(resolved.schema, resolved.name);
  const columnName = resolveColumnName(metadata.fields, property as string);

  const params: Array<unknown> = [];
  params.push(value);

  const state = createEmptyState<E>();
  state.predicates = [{ predicate: criteria, conjunction: "and" }];

  // Check for joined inheritance
  const { aliases: inheritanceAliases } = buildInheritanceAliases(
    metadata,
    namespace ?? null,
    1,
  );

  if (inheritanceAliases.length > 0) {
    // Joined inheritance: use subquery approach
    // Build WHERE with aliases for the subquery
    const subqueryParams: Array<unknown> = [];
    const whereClause = compileWhereWithFilters(
      state,
      metadata,
      subqueryParams,
      "t0",
      inheritanceAliases,
    );

    // Build subquery: SELECT pk FROM table AS t0 INNER JOIN child AS t1 ON ... WHERE ...
    const pkCols = metadata.primaryKeys.map((pk) => {
      const field = metadata.fields.find((f) => f.key === pk);
      return `"t0".${quoteIdentifier(field?.name ?? pk)}`;
    });

    // Build inheritance JOIN manually
    const inh = metadata.inheritance!;
    const joinParts: Array<string> = [];
    for (const alias of inheritanceAliases) {
      const qualifiedName = quoteIdentifier(alias.tableName);
      const conditions = metadata.primaryKeys.map((pk) => {
        const rootCol = metadata.fields.find((f) => f.key === pk)?.name ?? pk;
        const childCol = alias.metadata.fields.find((f) => f.key === pk)?.name ?? pk;
        return `${quoteIdentifier(alias.tableAlias)}.${quoteIdentifier(childCol)} = "t0".${quoteIdentifier(rootCol)}`;
      });
      const joinType = inh.discriminatorValue != null ? "INNER JOIN" : "LEFT JOIN";
      joinParts.push(
        `${joinType} ${qualifiedName} AS ${quoteIdentifier(alias.tableAlias)} ON ${conditions.join(" AND ")}`,
      );
    }

    const subquery = [
      `SELECT ${pkCols.join(", ")} FROM ${tableName} AS "t0"`,
      ...joinParts,
      whereClause,
    ]
      .filter(Boolean)
      .join(" ");

    params.push(...subqueryParams);

    const pkConditions = metadata.primaryKeys.map((pk) => {
      const field = metadata.fields.find((f) => f.key === pk);
      return quoteIdentifier(field?.name ?? pk);
    });

    const pkCondition =
      pkConditions.length === 1
        ? `${pkConditions[0]} IN (${subquery})`
        : `(${pkConditions.join(", ")}) IN (${subquery})`;

    const text = `UPDATE ${tableName} SET ${quoteIdentifier(columnName)} = ${quoteIdentifier(columnName)} + ? ${pkCondition ? `WHERE ${pkCondition}` : ""}`;
    return { text, params };
  }

  // Simple case: no joined inheritance
  const whereClause = compileWhereWithFilters(state, metadata, params);

  // Remove table alias from WHERE clause since SQLite UPDATE doesn't support aliases
  const unqualifiedWhere = removeTableAlias(whereClause, "t0");

  const text =
    `UPDATE ${tableName} SET ${quoteIdentifier(columnName)} = ${quoteIdentifier(columnName)} + ? ${unqualifiedWhere}`.trim();

  return { text, params };
};
