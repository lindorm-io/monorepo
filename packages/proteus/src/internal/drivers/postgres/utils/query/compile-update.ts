import type { IAmphora } from "@lindorm/amphora";
import type { DeepPartial, Predicate } from "@lindorm/types";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { encryptFieldValue } from "../../../../entity/utils/encrypt-field-value.js";
import { getEntityName } from "../../../../entity/utils/get-entity-name.js";
import { ProteusRepositoryError } from "../../../../../errors/ProteusRepositoryError.js";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier.js";
import { coerceWriteValue } from "./coerce-value.js";
import type { CompiledSql } from "./compiled-sql.js";
import { compileWhere, type FieldAliasOverrides } from "./compile-where.js";
import { dehydrateEntity } from "./dehydrate-entity.js";
import { buildDiscriminatorPredicate, resolveTableName } from "./resolve-table-name.js";
import { buildJoinedChildContext } from "./joined-child-context.js";

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
    return `${quoteIdentifier(c.column)} = $${params.length}`;
  });

  const primaryKeyConditions = buildPrimaryKeyConditions(entity, metadata, params);

  const versionField = metadata.fields.find((f) => f.decorator === "Version");
  if (versionField) {
    const currentVersion = (entity as any)[versionField.key];
    params.push(currentVersion - 1);
    primaryKeyConditions.push(
      `"t0".${quoteIdentifier(versionField.name)} = $${params.length}`,
    );
  }

  // Add discriminator predicate for single-table inheritance children
  const discPredicate = buildDiscriminatorPredicate(metadata, "t0", params);
  if (discPredicate) {
    primaryKeyConditions.push(discPredicate);
  }

  const text = `UPDATE ${tableName} AS "t0" SET ${setClauses.join(", ")} WHERE ${primaryKeyConditions.join(" AND ")} RETURNING *`;

  return { text, params };
};

/**
 * Compiles an `UPDATE ... SET ... WHERE` for bulk updates matching criteria.
 * Does not apply system filters (soft-delete, versioning) — uses plain `compileWhere`.
 * Throws if update object has no valid columns or if criteria resolves to an empty WHERE clause.
 *
 * For joined inheritance children, columns may span root and child tables. When the SET
 * or WHERE references child-only columns, a FROM clause joins the other table.
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

    let coerced = coerceWriteValue(value);
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
    setClauses.push(`${quoteIdentifier(field.name)} = $${params.length}`);
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

  const text = `UPDATE ${tableName} AS "t0" SET ${setClauses.join(", ")} ${whereClause}${discClause}`;

  return { text, params };
};

/**
 * Compile an UPDATE for a joined inheritance child that may reference child-only columns
 * in both SET and WHERE clauses.
 *
 * Strategy:
 * - If SET has child-only columns: UPDATE child_table FROM root_table
 * - If SET has root-only columns: UPDATE root_table FROM child_table
 * - Mixed: UPDATE child_table FROM root_table (child columns only; root columns not yet supported)
 *
 * WHERE criteria route to the correct table alias via fieldAliasOverrides.
 * The discriminator predicate is always applied to the root table.
 * PK join conditions link root and child tables.
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
    childEntityName.namespace ?? null,
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

    let coerced = coerceWriteValue(value);
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
      childSetClauses.push(`${quoteIdentifier(field.name)} = $${params.length}`);
    } else {
      rootSetClauses.push(`${quoteIdentifier(field.name)} = $${params.length}`);
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

  // Target table is t0 (the table being updated)
  // Other table is the FROM table (aliased differently)
  const targetTable = updateChild ? childQualified : rootQualified;
  const fromTable = updateChild ? rootQualified : childQualified;
  const fromAlias = "t1";
  const setClauses = updateChild ? childSetClauses : rootSetClauses;

  // Build field alias overrides: child-only fields route to the child table alias
  // If we're updating the child table (t0), child fields are on t0 and root fields on t1
  // If we're updating the root table (t0), root fields are on t0 and child fields on t1
  const aliasOverrides: FieldAliasOverrides = new Map();
  if (updateChild) {
    // Child table is t0, root table is t1 — no overrides needed since child criteria
    // fields default to t0. But root criteria fields need to route to t1.
    for (const field of metadata.fields) {
      if (
        !ctx.childFieldNames.has(field.name) &&
        !metadata.primaryKeys.includes(field.key)
      ) {
        aliasOverrides.set(field.key, fromAlias);
      }
    }
  } else {
    // Root table is t0, child table is t1 — child criteria fields route to t1
    for (const [key, _] of ctx.fieldAliasOverrides) {
      aliasOverrides.set(key, fromAlias);
    }
  }

  // Build WHERE clause with alias overrides
  const entries = [{ predicate: criteria, conjunction: "and" as const }];
  const whereClause = compileWhere(entries, metadata, "t0", params, aliasOverrides);

  if (!whereClause) {
    throw new ProteusRepositoryError(
      `updateMany: criteria must not be empty for entity "${metadata.entity.name}"`,
    );
  }

  // PK join condition: t0.pk = t1.pk
  const pkJoinConditions = metadata.primaryKeys.map((pk) => {
    const field = metadata.fields.find((f) => f.key === pk);
    const colName = field?.name ?? pk;
    return `"t0".${quoteIdentifier(colName)} = ${quoteIdentifier(fromAlias)}.${quoteIdentifier(colName)}`;
  });

  // Discriminator predicate: always on the root table
  const discAlias = updateChild ? fromAlias : "t0";
  const discPredicate = buildDiscriminatorPredicate(metadata, discAlias, params);
  const discClause = discPredicate ? ` AND ${discPredicate}` : "";

  const text = [
    `UPDATE ${targetTable} AS "t0"`,
    `SET ${setClauses.join(", ")}`,
    `FROM ${fromTable} AS ${quoteIdentifier(fromAlias)}`,
    `${whereClause} AND ${pkJoinConditions.join(" AND ")}${discClause}`,
  ].join(" ");

  return { text, params };
};

const buildPrimaryKeyConditions = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  params: Array<unknown>,
): Array<string> => {
  return metadata.primaryKeys.map((primaryKey) => {
    const field = metadata.fields.find((f) => f.key === primaryKey);
    const colName = field?.name ?? primaryKey;
    params.push((entity as any)[primaryKey]);
    return `"t0".${quoteIdentifier(colName)} = $${params.length}`;
  });
};

/**
 * Get the column name of the discriminator field, if this entity is a
 * single-table inheritance child. Returns null otherwise.
 */
const getDiscriminatorColumnName = (metadata: EntityMetadata): string | null => {
  if (!metadata.inheritance) return null;
  if (metadata.inheritance.discriminatorValue == null) return null;

  const field = metadata.fields.find(
    (f) => f.key === metadata.inheritance!.discriminatorField,
  );
  return field?.name ?? null;
};
