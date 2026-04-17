import type { IAmphora } from "@lindorm/amphora";
import type { DeepPartial, Predicate } from "@lindorm/types";
import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "../../../../entity/types/metadata";
import { encryptFieldValue } from "../../../../entity/utils/encrypt-field-value";
import { getEntityName } from "../../../../entity/utils/get-entity-name";
import { ProteusRepositoryError } from "../../../../../errors/ProteusRepositoryError";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier";
import { coerceWriteValue } from "./coerce-value";
import type { CompiledSql } from "./compiled-sql";
import { compileWhere, type FieldAliasOverrides } from "./compile-where";
import { dehydrateEntity } from "./dehydrate-entity";
import { buildDiscriminatorPredicate, resolveTableName } from "./resolve-table-name";
import { buildJoinedChildContext } from "./joined-child-context";
import {
  buildDiscriminatorPredicateUnqualified,
  buildPrimaryKeyConditions,
  getDiscriminatorColumnName,
} from "./compile-helpers";

export const compileUpdate = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  namespace?: string | null,
  amphora?: IAmphora,
): CompiledSql => {
  const columns = dehydrateEntity(entity, metadata, "update", amphora);
  const resolved = resolveTableName(metadata, namespace);
  const tableName = quoteQualifiedName(resolved.schema, resolved.name);

  // Exclude discriminator column from SET — it is read-only after creation
  const discriminatorColName = getDiscriminatorColumnName(metadata);
  const filteredColumns = discriminatorColName
    ? columns.filter((c) => c.column !== discriminatorColName)
    : columns;

  const params: Array<unknown> = [];

  const setClauses = filteredColumns.map((c) => {
    params.push(c.value);
    return `${quoteIdentifier(c.column)} = ?`;
  });

  // SQLite does not support UPDATE ... AS "t0", so PK conditions use unqualified column names
  const primaryKeyConditions = buildPrimaryKeyConditions(entity, metadata, params);

  const versionField = metadata.fields.find((f) => f.decorator === "Version");
  if (versionField) {
    const currentVersion = (entity as any)[versionField.key];
    params.push(currentVersion - 1);
    primaryKeyConditions.push(`${quoteIdentifier(versionField.name)} = ?`);
  }

  // Add discriminator predicate for single-table inheritance children
  // SQLite has no table alias on UPDATE, so use null alias
  const discPredicate = buildDiscriminatorPredicateUnqualified(metadata, params);
  if (discPredicate) {
    primaryKeyConditions.push(discPredicate);
  }

  const text = `UPDATE ${tableName} SET ${setClauses.join(", ")} WHERE ${primaryKeyConditions.join(" AND ")} RETURNING *`;

  return { text, params };
};

/**
 * Compiles an `UPDATE ... SET ... WHERE` for bulk updates matching criteria.
 * Does not apply system filters (soft-delete, versioning) — uses plain `compileWhere`.
 * Throws if update object has no valid columns or if criteria resolves to an empty WHERE clause.
 *
 * For joined inheritance children where SET or WHERE references child-only columns,
 * a subquery approach is used since SQLite does not support UPDATE ... FROM.
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

  // Exclude discriminator column from SET — it is read-only after creation
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

  // SQLite does not support UPDATE ... AS alias — use null alias for unqualified column names
  const entries = [{ predicate: criteria, conjunction: "and" as const }];
  const whereClause = compileWhere(entries, metadata, null, params);

  if (!whereClause) {
    throw new ProteusRepositoryError(
      `updateMany: criteria must not be empty for entity "${metadata.entity.name}"`,
    );
  }

  // Add discriminator predicate for single-table inheritance children
  const discPredicate = buildDiscriminatorPredicateUnqualified(metadata, params);
  const discClause = discPredicate ? ` AND ${discPredicate}` : "";

  const text = `UPDATE ${tableName} SET ${setClauses.join(", ")} ${whereClause}${discClause}`;

  return { text, params };
};

/**
 * Compile an UPDATE for a joined inheritance child using a subquery approach.
 * SQLite does not support UPDATE ... FROM, so we use:
 *   UPDATE target_table SET col = ? WHERE pk IN (SELECT target.pk FROM target JOIN other ON ... WHERE ...)
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

  const childEntityName = getEntityName(metadata.target, {
    namespace: namespace ?? undefined,
  });
  const childQualified = quoteQualifiedName(
    null, // SQLite has no schemas
    childEntityName.name,
  );

  const discriminatorColName = getDiscriminatorColumnName(metadata);
  const params: Array<unknown> = [];

  // Partition SET clauses into root vs child
  const rootSetClauses: Array<string> = [];
  const childSetClauses: Array<string> = [];

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
      childSetClauses.push(`${quoteIdentifier(field.name)} = ?`);
    } else {
      rootSetClauses.push(`${quoteIdentifier(field.name)} = ?`);
    }
  }

  if (rootSetClauses.length === 0 && childSetClauses.length === 0) {
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

  // Determine target: if any child SET columns, UPDATE child table
  const updateChild = childSetClauses.length > 0;
  const targetTable = updateChild ? childQualified : rootQualified;
  const setClauses = updateChild ? childSetClauses : rootSetClauses;

  // Build WHERE clause for the subquery using aliases
  const aliasOverrides: FieldAliasOverrides = new Map();
  if (updateChild) {
    for (const field of metadata.fields) {
      if (
        !ctx.childFieldNames.has(field.name) &&
        !metadata.primaryKeys.includes(field.key)
      ) {
        aliasOverrides.set(field.key, "t1");
      }
    }
  } else {
    for (const [key, _] of ctx.fieldAliasOverrides) {
      aliasOverrides.set(key, "t1");
    }
  }

  const entries = [{ predicate: criteria, conjunction: "and" as const }];
  const subqueryParams: Array<unknown> = [];
  const whereClause = compileWhere(
    entries,
    metadata,
    "t0",
    subqueryParams,
    aliasOverrides,
  );

  if (!whereClause) {
    throw new ProteusRepositoryError(
      `updateMany: criteria must not be empty for entity "${metadata.entity.name}"`,
    );
  }

  // PK columns for the subquery SELECT
  const pkCols = metadata.primaryKeys.map((pk) => {
    const field = metadata.fields.find((f) => f.key === pk);
    const colName = field?.name ?? pk;
    return `"t0".${quoteIdentifier(colName)}`;
  });

  // PK join condition in the subquery
  const fromTable = updateChild ? rootQualified : childQualified;
  const pkJoinConditions = metadata.primaryKeys.map((pk) => {
    const field = metadata.fields.find((f) => f.key === pk);
    const colName = field?.name ?? pk;
    return `"t0".${quoteIdentifier(colName)} = "t1".${quoteIdentifier(colName)}`;
  });

  // Discriminator predicate: always on the root table
  const discAlias = updateChild ? "t1" : "t0";
  const discPredicate = buildDiscriminatorPredicate(metadata, discAlias, subqueryParams);
  const discClause = discPredicate ? ` AND ${discPredicate}` : "";

  // Build the subquery
  const subquery = `SELECT ${pkCols.join(", ")} FROM ${targetTable} AS "t0" INNER JOIN ${fromTable} AS "t1" ON ${pkJoinConditions.join(" AND ")} ${whereClause}${discClause}`;

  // Build the outer UPDATE with WHERE pk IN (subquery)
  params.push(...subqueryParams);

  const pkConditions = metadata.primaryKeys.map((pk) => {
    const field = metadata.fields.find((f) => f.key === pk);
    return quoteIdentifier(field?.name ?? pk);
  });

  const pkCondition =
    pkConditions.length === 1
      ? `${pkConditions[0]} IN (${subquery})`
      : `(${pkConditions.join(", ")}) IN (${subquery})`;

  const text = `UPDATE ${targetTable} SET ${setClauses.join(", ")} WHERE ${pkCondition}`;

  return { text, params };
};
