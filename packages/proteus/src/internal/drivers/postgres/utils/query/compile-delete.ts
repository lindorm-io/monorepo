import type { Predicate } from "@lindorm/types";
import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "../../../../entity/types/metadata";
import { quoteQualifiedName } from "../quote-identifier";
import type { CompiledSql } from "./compiled-sql";
import { compileWhere } from "./compile-where";
import { buildDiscriminatorPredicate, resolveTableName } from "./resolve-table-name";
import { buildJoinedChildContext } from "./joined-child-context";
import { postgresDialect } from "../postgres-dialect";
import {
  compileSoftDelete as sharedCompileSoftDelete,
  compileRestore as sharedCompileRestore,
} from "../../../../utils/sql/compile-soft-delete";
import { compileDeleteExpired as sharedCompileDeleteExpired } from "../../../../utils/sql/compile-delete-expired";
import { compileJoinedChildDelete as sharedCompileJoinedChildDelete } from "../../../../utils/sql/compile-joined-child-delete";

/**
 * Compiles a hard `DELETE FROM` statement. Does not apply system filters — the caller
 * is responsible for scope/soft-delete filtering. Use `compileDeleteWithLimit` for
 * filter-aware deletion with a row cap.
 *
 * For joined inheritance children where criteria reference child-only fields:
 * ```sql
 * DELETE FROM "root_table" AS "t0" USING "child_table" AS "t1"
 * WHERE "t1"."id" = "t0"."id" AND "t1"."breed" = $1 AND "t0"."kind" = $2
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
    // Joined inheritance child: DELETE root USING child WHERE join + criteria + discriminator
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
    const text = `DELETE FROM ${tableName} AS "t0" USING ${joinedCtx.childTableRef} ${whereClause} AND ${joinCond}${discClause}`;

    return { text, params };
  }

  const whereClause = compileWhere(entries, metadata, "t0", params);

  // Add discriminator predicate for single-table inheritance children
  const discPredicate = buildDiscriminatorPredicate(metadata, "t0", params);
  const discClause = discPredicate ? ` AND ${discPredicate}` : "";

  const text = `DELETE FROM ${tableName} AS "t0" ${whereClause}${discClause}`;

  return { text, params };
};

export const compileJoinedChildDelete = <E extends IEntity>(
  criteria: Predicate<E>,
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledSql | null =>
  sharedCompileJoinedChildDelete(criteria, metadata, postgresDialect, namespace);

export const compileSoftDelete = <E extends IEntity>(
  criteria: Predicate<E>,
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledSql => sharedCompileSoftDelete(criteria, metadata, postgresDialect, namespace);

export const compileRestore = <E extends IEntity>(
  criteria: Predicate<E>,
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledSql => sharedCompileRestore(criteria, metadata, postgresDialect, namespace);

export const compileDeleteExpired = (
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledSql => sharedCompileDeleteExpired(metadata, postgresDialect, namespace);
