import type { Predicate } from "@lindorm/types";
import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "../../../../entity/types/metadata";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier";
import type { CompiledSql } from "./compiled-sql";
import { compileWhere } from "./compile-where";
import { buildDiscriminatorPredicate, resolveTableName } from "./resolve-table-name";
import { buildJoinedChildContext } from "./joined-child-context";
import { buildDiscriminatorPredicateUnqualified } from "./compile-helpers";
import { sqliteDialect } from "../sqlite-dialect";
import {
  compileSoftDelete as sharedCompileSoftDelete,
  compileRestore as sharedCompileRestore,
} from "../../../../utils/sql/compile-soft-delete";
import { compileDeleteExpired as sharedCompileDeleteExpired } from "../../../../utils/sql/compile-delete-expired";
import { compileJoinedChildDelete as sharedCompileJoinedChildDelete } from "../../../../utils/sql/compile-joined-child-delete";

/**
 * Compiles a hard `DELETE FROM` statement. Does not apply system filters -- the caller
 * is responsible for scope/soft-delete filtering.
 *
 * For joined inheritance children where criteria reference child-only fields,
 * SQLite does not support `DELETE ... USING`, so a subquery approach is used:
 * ```sql
 * DELETE FROM "root_table" WHERE "id" IN (
 *   SELECT "t0"."id" FROM "root_table" AS "t0"
 *   INNER JOIN "child_table" AS "t1" ON "t1"."id" = "t0"."id"
 *   WHERE ...
 * )
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
    // Joined inheritance child: use subquery approach
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

    // PK columns for the subquery
    const pkCols = metadata.primaryKeys.map((pk) => {
      const field = metadata.fields.find((f) => f.key === pk);
      return `"t0".${quoteIdentifier(field?.name ?? pk)}`;
    });

    const subquery = `SELECT ${pkCols.join(", ")} FROM ${tableName} AS "t0" INNER JOIN ${joinedCtx.childTableRef.replace(/ AS "t1"$/, "")} AS ${quoteIdentifier(joinedCtx.childAlias)} ON ${joinCond} ${whereClause}${discClause}`;

    // Outer DELETE with WHERE pk IN (subquery)
    const pkConditions = metadata.primaryKeys.map((pk) => {
      const field = metadata.fields.find((f) => f.key === pk);
      return quoteIdentifier(field?.name ?? pk);
    });

    const pkCondition =
      pkConditions.length === 1
        ? `${pkConditions[0]} IN (${subquery})`
        : `(${pkConditions.join(", ")}) IN (${subquery})`;

    const text = `DELETE FROM ${tableName} WHERE ${pkCondition}`;
    return { text, params };
  }

  // SQLite does not support DELETE FROM ... AS alias -- use null alias for unqualified column names
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
  sharedCompileJoinedChildDelete(criteria, metadata, sqliteDialect, namespace);

export const compileSoftDelete = <E extends IEntity>(
  criteria: Predicate<E>,
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledSql => sharedCompileSoftDelete(criteria, metadata, sqliteDialect, namespace);

export const compileRestore = <E extends IEntity>(
  criteria: Predicate<E>,
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledSql => sharedCompileRestore(criteria, metadata, sqliteDialect, namespace);

export const compileDeleteExpired = (
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledSql => sharedCompileDeleteExpired(metadata, sqliteDialect, namespace);
