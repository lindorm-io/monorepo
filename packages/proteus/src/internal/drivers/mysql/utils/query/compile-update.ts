import type { IAmphora } from "@lindorm/amphora";
import type { DeepPartial, Predicate } from "@lindorm/types";
import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import { encryptFieldValue } from "#internal/entity/utils/encrypt-field-value";
import { ProteusRepositoryError } from "../../../../../errors/ProteusRepositoryError";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier";
import { coerceWriteValue } from "./coerce-value";
import type { CompiledSql } from "./compiled-sql";
import { compileWhere } from "./compile-where";
import { dehydrateEntity } from "./dehydrate-entity";
import { buildDiscriminatorPredicate, resolveTableName } from "./resolve-table-name";
import { buildJoinedChildContext } from "./joined-child-context";
import {
  buildDiscriminatorPredicateUnqualified,
  buildPrimaryKeyConditions,
  getDiscriminatorColumnName,
} from "./compile-helpers";
import { mysqlDialect } from "../mysql-dialect";
import {
  compileSoftDelete as sharedCompileSoftDelete,
  compileRestore as sharedCompileRestore,
} from "#internal/utils/sql/compile-soft-delete";
import { compileDeleteExpired as sharedCompileDeleteExpired } from "#internal/utils/sql/compile-delete-expired";

/**
 * Compile an UPDATE statement for a single entity.
 *
 * MySQL has no RETURNING clause. The executor must follow up with a SELECT-back
 * using compileSelectByPk to retrieve the hydrated row.
 *
 * MySQL supports UPDATE ... AS alias, so we use qualified predicates for consistency.
 */
export const compileUpdate = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  namespace?: string | null,
  amphora?: IAmphora,
): CompiledSql => {
  const columns = dehydrateEntity(entity, metadata, "update", amphora);
  const resolved = resolveTableName(metadata, namespace);
  const tableName = quoteQualifiedName(resolved.schema, resolved.name);

  // Exclude discriminator column from SET -- it is read-only after creation
  const discriminatorColName = getDiscriminatorColumnName(metadata);
  const filteredColumns = discriminatorColName
    ? columns.filter((c) => c.column !== discriminatorColName)
    : columns;

  const params: Array<unknown> = [];

  const setClauses = filteredColumns.map((c) => {
    params.push(c.value);
    return `${quoteIdentifier(c.column)} = ?`;
  });

  // MySQL supports UPDATE ... AS alias, but for single-entity updates
  // we use unqualified PK conditions for simplicity
  const primaryKeyConditions = buildPrimaryKeyConditions(entity, metadata, params);

  const versionField = metadata.fields.find((f) => f.decorator === "Version");
  if (versionField) {
    const currentVersion = (entity as any)[versionField.key];
    params.push(currentVersion - 1);
    primaryKeyConditions.push(`${quoteIdentifier(versionField.name)} = ?`);
  }

  // Add discriminator predicate for single-table inheritance children
  const discPredicate = buildDiscriminatorPredicateUnqualified(metadata, params);
  if (discPredicate) {
    primaryKeyConditions.push(discPredicate);
  }

  const text = `UPDATE ${tableName} SET ${setClauses.join(", ")} WHERE ${primaryKeyConditions.join(" AND ")}`;

  return { text, params };
};

/**
 * Compiles an `UPDATE ... SET ... WHERE` for bulk updates matching criteria.
 * Does not apply system filters (soft-delete, versioning) -- uses plain `compileWhere`.
 * Throws if update object has no valid columns or if criteria resolves to an empty WHERE clause.
 *
 * For joined inheritance children, MySQL supports multi-table UPDATE:
 * `UPDATE root AS t0 INNER JOIN child AS t1 ON t0.id = t1.id SET ...`
 */
export const compileUpdateMany = <E extends IEntity>(
  criteria: Predicate<E>,
  update: DeepPartial<E>,
  metadata: EntityMetadata,
  namespace?: string | null,
  amphora?: IAmphora,
): CompiledSql => {
  const joinedCtx = buildJoinedChildContext(metadata, namespace);

  if (joinedCtx) {
    return compileJoinedUpdateMany(
      criteria,
      update,
      metadata,
      namespace,
      joinedCtx,
      amphora,
    );
  }

  const resolved = resolveTableName(metadata, namespace);
  const tableName = quoteQualifiedName(resolved.schema, resolved.name);

  const params: Array<unknown> = [];

  // Exclude discriminator column from SET -- it is read-only after creation
  const discriminatorColName = getDiscriminatorColumnName(metadata);

  const setClauses: Array<string> = [];
  for (const [key, value] of Object.entries(update as Record<string, unknown>)) {
    const field = metadata.fields.find((f) => f.key === key);
    if (!field) continue;
    if (discriminatorColName && field.name === discriminatorColName) continue;

    let coerced = coerceWriteValue(value, field.type);
    if (coerced != null && field.encrypted && amphora) {
      coerced = encryptFieldValue(
        coerced,
        field.encrypted.predicate,
        amphora,
        field.key,
        metadata.entity.name,
      );
    }
    params.push(coerced);
    setClauses.push(`${quoteIdentifier(field.name)} = ?`);
  }

  if (setClauses.length === 0) {
    throw new ProteusRepositoryError(
      `updateMany: no valid columns in update object for entity "${metadata.entity.name}"`,
      {
        debug: {
          entityName: metadata.entity.name,
          updateKeys: Object.keys(update as Record<string, unknown>),
        },
      },
    );
  }

  // MySQL supports UPDATE ... AS alias -- use alias for qualified column names
  const entries = [{ predicate: criteria, conjunction: "and" as const }];
  const whereClause = compileWhere(entries, metadata, "t0", params);

  if (!whereClause) {
    throw new ProteusRepositoryError(
      `updateMany: criteria must not be empty for entity "${metadata.entity.name}"`,
    );
  }

  // Add discriminator predicate for single-table inheritance children
  const discPredicate = buildDiscriminatorPredicate(metadata, "t0", params);
  const discClause = discPredicate ? ` AND ${discPredicate}` : "";

  const text = `UPDATE ${tableName} AS ${quoteIdentifier("t0")} SET ${setClauses.join(", ")} ${whereClause}${discClause}`;

  return { text, params };
};

/**
 * Compile a multi-table UPDATE for a joined inheritance child.
 * MySQL supports:
 *   UPDATE root AS t0 INNER JOIN child AS t1 ON t0.id = t1.id SET t0.col=?, t1.col=? WHERE ...
 */
const compileJoinedUpdateMany = <E extends IEntity>(
  criteria: Predicate<E>,
  update: DeepPartial<E>,
  metadata: EntityMetadata,
  namespace: string | null | undefined,
  ctx: ReturnType<typeof buildJoinedChildContext> & {},
  amphora?: IAmphora,
): CompiledSql => {
  const resolved = resolveTableName(metadata, namespace);
  const rootQualified = quoteQualifiedName(resolved.schema, resolved.name);

  const discriminatorColName = getDiscriminatorColumnName(metadata);
  const params: Array<unknown> = [];

  // Partition SET clauses into root vs child with qualified column names
  const setClauses: Array<string> = [];

  for (const [key, value] of Object.entries(update as Record<string, unknown>)) {
    const field = metadata.fields.find((f) => f.key === key);
    if (!field) continue;
    if (discriminatorColName && field.name === discriminatorColName) continue;

    let coerced = coerceWriteValue(value, field.type);
    if (coerced != null && field.encrypted && amphora) {
      coerced = encryptFieldValue(
        coerced,
        field.encrypted.predicate,
        amphora,
        field.key,
        metadata.entity.name,
      );
    }
    params.push(coerced);
    if (ctx.childFieldNames.has(field.name)) {
      setClauses.push(`${quoteIdentifier("t1")}.${quoteIdentifier(field.name)} = ?`);
    } else {
      setClauses.push(`${quoteIdentifier("t0")}.${quoteIdentifier(field.name)} = ?`);
    }
  }

  if (setClauses.length === 0) {
    throw new ProteusRepositoryError(
      `updateMany: no valid columns in update object for entity "${metadata.entity.name}"`,
      {
        debug: {
          entityName: metadata.entity.name,
          updateKeys: Object.keys(update as Record<string, unknown>),
        },
      },
    );
  }

  // Build WHERE clause with proper alias overrides
  const entries = [{ predicate: criteria, conjunction: "and" as const }];
  const whereClause = compileWhere(
    entries,
    metadata,
    "t0",
    params,
    ctx.fieldAliasOverrides,
  );

  if (!whereClause) {
    throw new ProteusRepositoryError(
      `updateMany: criteria must not be empty for entity "${metadata.entity.name}"`,
    );
  }

  // Discriminator predicate on root table
  const discPredicate = buildDiscriminatorPredicate(metadata, "t0", params);
  const discClause = discPredicate ? ` AND ${discPredicate}` : "";

  // Multi-table UPDATE syntax
  const joinCond = ctx.joinConditions.join(" AND ");

  const text = `UPDATE ${rootQualified} AS ${quoteIdentifier("t0")} INNER JOIN ${ctx.childTableQualified} AS ${quoteIdentifier("t1")} ON ${joinCond} SET ${setClauses.join(", ")} ${whereClause}${discClause}`;

  return { text, params };
};

export const compileSoftDelete = <E extends IEntity>(
  criteria: Predicate<E>,
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledSql => sharedCompileSoftDelete(criteria, metadata, mysqlDialect, namespace);

export const compileRestore = <E extends IEntity>(
  criteria: Predicate<E>,
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledSql => sharedCompileRestore(criteria, metadata, mysqlDialect, namespace);

export const compileDeleteExpired = (
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledSql => sharedCompileDeleteExpired(metadata, mysqlDialect, namespace);
