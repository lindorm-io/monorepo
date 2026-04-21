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
 * Compiles a DELETE with LIMIT using a CTE:
 *   WITH to_delete AS (SELECT pk FROM table WHERE ... LIMIT $N)
 *   DELETE FROM table WHERE pk IN (SELECT pk FROM to_delete)
 *
 * The CTE SELECT applies soft-delete and version filters so that
 * only active, current-version rows are candidates for deletion.
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
  const whereClause = compileWhereWithFilters(state, metadata, params);

  // Primary key columns — use resolveColumnName for correct key→column mapping
  const pkCols = metadata.primaryKeys.map((pk) =>
    quoteIdentifier(resolveColumnName(metadata.fields, pk)),
  );

  // LIMIT param
  params.push(limit);
  const limitPlaceholder = `$${params.length}`;

  // Inheritance JOIN for joined children (child-specific columns in criteria)
  const { aliases: inheritanceAliases } = buildInheritanceAliases(
    metadata,
    namespace ?? null,
    1,
  );
  const inheritanceJoinClause = compileInheritanceJoin(
    metadata,
    inheritanceAliases,
    "t0",
  );

  // CTE: SELECT pk FROM table [INNER JOIN child] WHERE ... LIMIT N
  const cteSelect = [
    `SELECT ${pkCols.join(", ")} FROM ${tableName} AS "t0"`,
    inheritanceJoinClause,
    whereClause,
    `LIMIT ${limitPlaceholder}`,
  ]
    .filter(Boolean)
    .join(" ");

  // Main DELETE: WHERE pk IN (SELECT pk FROM to_delete)
  const pkCondition =
    pkCols.length === 1
      ? `${pkCols[0]} IN (SELECT ${pkCols[0]} FROM "to_delete")`
      : `ROW(${pkCols.join(", ")}) IN (SELECT ${pkCols.join(", ")} FROM "to_delete")`;

  const text = `WITH "to_delete" AS (${cteSelect}) DELETE FROM ${tableName} WHERE ${pkCondition}`;

  return { text, params };
};
