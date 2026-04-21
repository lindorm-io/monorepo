import type { Predicate } from "@lindorm/types";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { createEmptyState } from "../../../../../classes/QueryBuilder.js";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier.js";
import { resolveColumnName } from "../resolve-column-name.js";
import type { CompiledSql } from "./compiled-sql.js";
import {
  buildInheritanceAliases,
  compileInheritanceJoin,
} from "./compile-inheritance-join.js";
import { compileWhereWithFilters } from "./compile-system-filters.js";
import { resolveTableName } from "./resolve-table-name.js";

/**
 * Compiles a DELETE with LIMIT for MySQL.
 *
 * MySQL natively supports DELETE ... WHERE ... ORDER BY ... LIMIT ?,
 * but only for single-table deletes. For joined inheritance, a CTE approach is used.
 */
export const compileDeleteWithLimit = <E extends IEntity>(
  criteria: Predicate<E>,
  limit: number,
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledSql => {
  const resolved = resolveTableName(metadata, namespace);
  const tableName = quoteQualifiedName(resolved.schema, resolved.name);

  const params: Array<unknown> = [];

  // Build minimal QueryState so compileWhereWithFilters applies system filters
  const state = createEmptyState<E>();
  state.predicates = [{ predicate: criteria, conjunction: "and" }];

  // Primary key columns -- use resolveColumnName for correct key->column mapping
  const pkCols = metadata.primaryKeys.map((pk) =>
    quoteIdentifier(resolveColumnName(metadata.fields, pk)),
  );

  // Inheritance JOIN for joined children (child-specific columns in criteria)
  const { aliases: inheritanceAliases } = buildInheritanceAliases(
    metadata,
    namespace ?? null,
    1,
  );

  if (inheritanceAliases.length > 0) {
    // Joined inheritance: use CTE approach (MySQL 8.0+ supports CTEs)
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

    params.push(limit);

    const cteSelect = [
      `SELECT ${pkCols.map((c) => `${quoteIdentifier("t0")}.${c}`).join(", ")} FROM ${tableName} AS ${quoteIdentifier("t0")}`,
      inheritanceJoinClause,
      whereClause,
      `LIMIT ?`,
    ]
      .filter(Boolean)
      .join(" ");

    const pkCondition =
      pkCols.length === 1
        ? `${pkCols[0]} IN (SELECT ${pkCols[0]} FROM ${quoteIdentifier("to_delete")})`
        : `(${pkCols.join(", ")}) IN (SELECT ${pkCols.join(", ")} FROM ${quoteIdentifier("to_delete")})`;

    const text = `WITH ${quoteIdentifier("to_delete")} AS (${cteSelect}) DELETE FROM ${tableName} WHERE ${pkCondition}`;

    return { text, params };
  }

  // Simple case: MySQL natively supports DELETE ... WHERE ... LIMIT ?
  // Pass null alias so columns are unqualified from the start (no table alias prefix).
  const whereClause = compileWhereWithFilters(state, metadata, params, null);

  params.push(limit);

  const text = `DELETE FROM ${tableName} ${whereClause} LIMIT ?`;

  return { text, params };
};
