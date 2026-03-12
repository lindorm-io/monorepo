import type { Predicate } from "@lindorm/types";
import type { IEntity } from "../../../interfaces";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import type { PredicateEntry } from "#internal/types/query";
import { ProteusError } from "../../../errors/ProteusError";
import type { CompiledSql } from "./compiled-sql";
import {
  buildDiscriminatorPredicateQualified,
  buildDiscriminatorPredicateUnqualified,
} from "./compile-helpers";
import { compileWhere } from "./compile-where";
import { resolveTableName } from "./resolve-table-name";
import type { SqlDialect } from "./sql-dialect";

/**
 * Compiles an `UPDATE ... SET <deleteDate> = <dateNow>` for soft-delete.
 * Throws `ProteusError` if the entity has no `@DeleteDate` field.
 *
 * Uses `dialect.supportsUpdateAlias` to determine whether to use table alias
 * and qualified column names.
 */
export const compileSoftDelete = <E extends IEntity>(
  criteria: Predicate<E>,
  metadata: EntityMetadata,
  dialect: SqlDialect,
  namespace?: string | null,
): CompiledSql => {
  const resolved = resolveTableName(metadata, dialect, namespace);
  const tableName = dialect.quoteQualifiedName(resolved.schema, resolved.name);
  const deleteField = metadata.fields.find((f) => f.decorator === "DeleteDate");
  if (!deleteField) {
    throw new ProteusError(
      `compileSoftDelete: entity "${metadata.entity.name}" has no @DeleteDate field`,
    );
  }

  const params: Array<unknown> = [];
  const entries: Array<PredicateEntry<E>> = [{ predicate: criteria, conjunction: "and" }];
  const alias = dialect.supportsUpdateAlias ? "t0" : null;
  const whereClause = compileWhere(entries, metadata, alias, params, dialect);

  const discPredicate = alias
    ? buildDiscriminatorPredicateQualified(metadata, alias, params, dialect)
    : buildDiscriminatorPredicateUnqualified(metadata, params, dialect);
  const discClause = discPredicate ? ` AND ${discPredicate}` : "";

  const aliasSuffix = alias ? ` AS ${dialect.quoteIdentifier(alias)}` : "";
  const text = `UPDATE ${tableName}${aliasSuffix} SET ${dialect.quoteIdentifier(deleteField.name)} = ${dialect.dateNowExpression()} ${whereClause}${discClause}`;

  return { text, params };
};

/**
 * Compiles an `UPDATE ... SET <deleteDate> = NULL` to restore soft-deleted rows.
 * Throws `ProteusError` if the entity has no `@DeleteDate` field.
 */
export const compileRestore = <E extends IEntity>(
  criteria: Predicate<E>,
  metadata: EntityMetadata,
  dialect: SqlDialect,
  namespace?: string | null,
): CompiledSql => {
  const resolved = resolveTableName(metadata, dialect, namespace);
  const tableName = dialect.quoteQualifiedName(resolved.schema, resolved.name);
  const deleteField = metadata.fields.find((f) => f.decorator === "DeleteDate");
  if (!deleteField) {
    throw new ProteusError(
      `compileRestore: entity "${metadata.entity.name}" has no @DeleteDate field`,
    );
  }

  const params: Array<unknown> = [];
  const entries: Array<PredicateEntry<E>> = [{ predicate: criteria, conjunction: "and" }];
  const alias = dialect.supportsUpdateAlias ? "t0" : null;
  const whereClause = compileWhere(entries, metadata, alias, params, dialect);

  const discPredicate = alias
    ? buildDiscriminatorPredicateQualified(metadata, alias, params, dialect)
    : buildDiscriminatorPredicateUnqualified(metadata, params, dialect);
  const discClause = discPredicate ? ` AND ${discPredicate}` : "";

  const aliasSuffix = alias ? ` AS ${dialect.quoteIdentifier(alias)}` : "";
  const text = `UPDATE ${tableName}${aliasSuffix} SET ${dialect.quoteIdentifier(deleteField.name)} = NULL ${whereClause}${discClause}`;

  return { text, params };
};
