import type { Predicate } from "@lindorm/types";
import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import { createEmptyState } from "../../../../../classes/QueryBuilder";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier";
import { resolveColumnName } from "../resolve-column-name";
import type { CompiledSql } from "./compiled-sql";
import {
  buildInheritanceAliases,
  compileInheritanceJoin,
} from "./compile-inheritance-join";
import { compileWhereWithFilters } from "./compile-system-filters";
import { resolveTableName } from "./resolve-table-name";

/**
 * Compile an atomic increment/decrement UPDATE for MySQL.
 *
 * MySQL supports UPDATE ... AS alias, so we use qualified column names.
 * For joined inheritance children, multi-table UPDATE is used.
 *
 * MySQL has no RETURNING clause. The executor must follow up with a SELECT-back
 * using compileSelectByPk if the updated row is needed.
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
    // Joined inheritance: use multi-table UPDATE syntax
    const whereClause = compileWhereWithFilters(
      state,
      metadata,
      params,
      "t0",
      inheritanceAliases,
    );
    const inheritanceJoinClause = compileInheritanceJoin(
      metadata,
      inheritanceAliases,
      "t0",
    );

    const text =
      `UPDATE ${tableName} AS ${quoteIdentifier("t0")} ${inheritanceJoinClause} SET ${quoteIdentifier("t0")}.${quoteIdentifier(columnName)} = ${quoteIdentifier("t0")}.${quoteIdentifier(columnName)} + ? ${whereClause}`.trim();
    return { text, params };
  }

  // Simple case: no joined inheritance
  const whereClause = compileWhereWithFilters(state, metadata, params, "t0");

  const text =
    `UPDATE ${tableName} AS ${quoteIdentifier("t0")} SET ${quoteIdentifier("t0")}.${quoteIdentifier(columnName)} = ${quoteIdentifier("t0")}.${quoteIdentifier(columnName)} + ? ${whereClause}`.trim();

  return { text, params };
};
