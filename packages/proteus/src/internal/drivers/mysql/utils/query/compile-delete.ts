import type { Predicate } from "@lindorm/types";
import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "../../../../entity/types/metadata";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier";
import type { CompiledSql } from "./compiled-sql";
import { compileWhere } from "./compile-where";
import { buildDiscriminatorPredicate, resolveTableName } from "./resolve-table-name";
import { buildJoinedChildContext } from "./joined-child-context";
import { buildDiscriminatorPredicateUnqualified } from "./compile-helpers";
import { mysqlDialect } from "../mysql-dialect";
import { compileJoinedChildDelete as sharedCompileJoinedChildDelete } from "../../../../utils/sql/compile-joined-child-delete";

/**
 * Compiles a hard `DELETE FROM` statement. Does not apply system filters -- the caller
 * is responsible for scope/soft-delete filtering.
 *
 * For joined inheritance children, MySQL supports multi-table DELETE:
 * ```sql
 * DELETE `t0` FROM `root_table` AS `t0`
 * INNER JOIN `child_table` AS `t1` ON `t1`.`id` = `t0`.`id`
 * WHERE ...
 * ```
 * Child table rows are removed by FK CASCADE.
 */
export const compileDelete = <E extends IEntity>(
  criteria: Predicate<E>,
  metadata: EntityMetadata,
  namespace?: string | null,
  options?: { skipJoinedContext?: boolean },
): CompiledSql => {
  const resolved = resolveTableName(metadata, namespace);
  const tableName = quoteQualifiedName(resolved.schema, resolved.name);

  const joinedCtx = options?.skipJoinedContext
    ? null
    : buildJoinedChildContext(metadata, namespace);

  const params: Array<unknown> = [];
  const entries = [{ predicate: criteria, conjunction: "and" as const }];

  if (joinedCtx) {
    // Joined inheritance child: use MySQL multi-table DELETE
    const whereClause = compileWhere(
      entries,
      metadata,
      "t0",
      params,
      joinedCtx.fieldAliasOverrides,
    );

    const discPredicate = buildDiscriminatorPredicate(metadata, "t0", params);
    const discClause = discPredicate ? ` AND ${discPredicate}` : "";

    const joinCond = joinedCtx.joinConditions.join(" AND ");

    // MySQL multi-table DELETE: DELETE t0 FROM root AS t0 INNER JOIN child AS t1 ON ... WHERE ...
    const text = `DELETE ${quoteIdentifier("t0")} FROM ${tableName} AS ${quoteIdentifier("t0")} INNER JOIN ${joinedCtx.childTableQualified} AS ${quoteIdentifier(joinedCtx.childAlias)} ON ${joinCond} ${whereClause}${discClause}`;
    return { text, params };
  }

  // Simple case: MySQL supports DELETE FROM table AS alias WHERE ...
  // but for non-joined entities we use simple unqualified delete
  const whereClause = compileWhere(entries, metadata, null, params);

  // Add discriminator predicate for single-table inheritance children
  const discPredicate = buildDiscriminatorPredicateUnqualified(metadata, params);
  const discClause = discPredicate ? ` AND ${discPredicate}` : "";

  const text = `DELETE FROM ${tableName} ${whereClause}${discClause}`;

  return { text, params };
};

export const compileJoinedChildDelete = <E extends IEntity>(
  criteria: Predicate<E>,
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledSql | null =>
  sharedCompileJoinedChildDelete(criteria, metadata, mysqlDialect, namespace);
