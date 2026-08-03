import type { Condition } from "@lindorm/match";
import type { IAmphora } from "@lindorm/amphora";
import type { DeepPartial } from "@lindorm/types";
import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError.js";
import type { IEntity } from "../../../interfaces/index.js";
import type { EntityMetadata, MetaField } from "../../entity/types/metadata.js";
import { dehydrateFieldValue } from "../../entity/utils/dehydrate-field-value.js";
import { typedJsonChangedColumns } from "../../entity/utils/typed-json.js";
import type { PredicateEntry } from "../../types/query.js";
import {
  buildDiscriminatorPredicateQualified,
  buildDiscriminatorPredicateUnqualified,
  buildPrimaryKeyConditions,
  buildPrimaryKeyConditionsQualified,
  getDiscriminatorColumnName,
} from "./compile-helpers.js";
import { compileWhere, type FieldAliasOverrides } from "./compile-where.js";
import type { CompiledSql } from "./compiled-sql.js";
import { resolveTableName } from "./resolve-table-name.js";
import type { SqlDialect } from "./sql-dialect.js";
import type {
  CoerceWriteValueFn,
  DehydrateEntityFn,
  QuoteChildTableNameFn,
} from "./write-compiler-deps.js";

/**
 * Joined inheritance context consumed by compileUpdateMany. Built per driver
 * (child table naming diverges); the shared strategies only need these members.
 */
export type JoinedChildUpdateContext = {
  /** PK join conditions, e.g. `["t1"."id" = "t0"."id"]` */
  joinConditions: Array<string>;
  /** Maps child-only field keys to the child table alias */
  fieldAliasOverrides: FieldAliasOverrides;
  /** Set of child-only field column names */
  childFieldNames: Set<string>;
};

export type CompileUpdateDeps = {
  dehydrateEntity: DehydrateEntityFn;
  coerceWriteValue: CoerceWriteValueFn;
  buildJoinedChildContext: (
    metadata: EntityMetadata,
    namespace?: string | null,
  ) => JoinedChildUpdateContext | null;
  quoteChildTableName: QuoteChildTableNameFn;
};

/**
 * Compiles an `UPDATE ... SET ... WHERE <pk> [AND <version>]` for a single entity.
 *
 * Uses `dialect.singleRowUpdateAlias` to decide between an aliased UPDATE with
 * qualified WHERE conditions (PG) and an unaliased one (MySQL/SQLite), and
 * appends `RETURNING *` when the dialect supports it.
 */
export const compileUpdate = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  dialect: SqlDialect,
  deps: CompileUpdateDeps,
  namespace?: string | null,
  amphora?: IAmphora,
): CompiledSql => {
  const columns = deps.dehydrateEntity(entity, metadata, "update", amphora);
  const resolved = resolveTableName(metadata, dialect, namespace);
  const tableName = dialect.quoteQualifiedName(resolved.schema, resolved.name);

  // Exclude discriminator column from SET — it is read-only after creation
  const discriminatorColName = getDiscriminatorColumnName(metadata);
  const filteredColumns = discriminatorColName
    ? columns.filter((c) => c.column !== discriminatorColName)
    : columns;

  const params: Array<unknown> = [];

  const setClauses = filteredColumns.map((c) => {
    params.push(c.value);
    return `${dialect.quoteIdentifier(c.column)} = ${dialect.placeholder(params)}`;
  });

  const alias = dialect.singleRowUpdateAlias;
  const conditions = alias
    ? buildPrimaryKeyConditionsQualified(entity, metadata, params, alias, dialect)
    : buildPrimaryKeyConditions(entity, metadata, params, dialect);

  const versionField = metadata.fields.find((f) => f.decorator === "Version");
  if (versionField) {
    const currentVersion = (entity as any)[versionField.key];
    params.push(currentVersion - 1);
    const versionCol = alias
      ? `${dialect.quoteIdentifier(alias)}.${dialect.quoteIdentifier(versionField.name)}`
      : dialect.quoteIdentifier(versionField.name);
    conditions.push(`${versionCol} = ${dialect.placeholder(params)}`);
  }

  // Add discriminator predicate for single-table inheritance children
  const discPredicate = alias
    ? buildDiscriminatorPredicateQualified(metadata, alias, params, dialect)
    : buildDiscriminatorPredicateUnqualified(metadata, params, dialect);
  if (discPredicate) {
    conditions.push(discPredicate);
  }

  const aliasSuffix = alias ? ` AS ${dialect.quoteIdentifier(alias)}` : "";
  const returning = dialect.supportsReturning ? " RETURNING *" : "";
  const text = `UPDATE ${tableName}${aliasSuffix} SET ${setClauses.join(", ")} WHERE ${conditions.join(" AND ")}${returning}`;

  return { text, params };
};

/**
 * Compiles an `UPDATE ... SET ... WHERE` for bulk updates matching criteria.
 * Does not apply system filters (soft-delete, versioning) — uses plain `compileWhere`.
 * Throws if update object has no valid columns or if criteria resolves to an empty WHERE clause.
 *
 * For joined inheritance children the statement shape follows
 * `dialect.joinedUpdateManySyntax`: UPDATE ... FROM (PG), a multi-table
 * UPDATE ... INNER JOIN (MySQL), or WHERE pk IN (subquery) (SQLite).
 */
export const compileUpdateMany = <E extends IEntity>(
  criteria: Condition<E>,
  update: DeepPartial<E>,
  metadata: EntityMetadata,
  dialect: SqlDialect,
  deps: CompileUpdateDeps,
  namespace?: string | null,
  amphora?: IAmphora,
): CompiledSql => {
  const joinedCtx = deps.buildJoinedChildContext(metadata, namespace);

  if (joinedCtx) {
    switch (dialect.joinedUpdateManySyntax) {
      case "from":
        return compileJoinedUpdateManyFrom(
          criteria,
          update,
          metadata,
          dialect,
          deps,
          joinedCtx,
          namespace,
          amphora,
        );
      case "multi-table":
        return compileJoinedUpdateManyMultiTable(
          criteria,
          update,
          metadata,
          dialect,
          deps,
          joinedCtx,
          namespace,
          amphora,
        );
      case "subquery":
        return compileJoinedUpdateManySubquery(
          criteria,
          update,
          metadata,
          dialect,
          deps,
          joinedCtx,
          namespace,
          amphora,
        );
      default:
        throw new ProteusRepositoryError("Unsupported joinedUpdateManySyntax", {
          code: "invalid_query",
          title: "Invalid Query",
          details:
            "The dialect declares a joined UPDATE syntax the shared compiler does not implement; falling through would silently drop child-table columns.",
          data: { syntax: dialect.joinedUpdateManySyntax },
        });
    }
  }

  const resolved = resolveTableName(metadata, dialect, namespace);
  const tableName = dialect.quoteQualifiedName(resolved.schema, resolved.name);

  const params: Array<unknown> = [];

  // Exclude discriminator column from SET — it is read-only after creation
  const discriminatorColName = getDiscriminatorColumnName(metadata);

  const setClauses: Array<string> = [];
  for (const [key, value] of Object.entries(update as Record<string, unknown>)) {
    const field = metadata.fields.find((f) => f.key === key);
    if (!field) continue;
    if (discriminatorColName && field.name === discriminatorColName) continue;

    if (field.typedJson) {
      for (const pair of typedJsonChangedColumns(
        field,
        value,
        (d) => deps.coerceWriteValue(d, field),
        amphora,
        metadata.entity.name,
      )) {
        params.push(pair.value);
        setClauses.push(
          `${dialect.quoteIdentifier(pair.column)} = ${dialect.placeholder(params)}`,
        );
      }
      continue;
    }

    params.push(coerceAndEncrypt(value, field, metadata, deps, amphora));
    setClauses.push(
      `${dialect.quoteIdentifier(field.name)} = ${dialect.placeholder(params)}`,
    );
  }

  if (setClauses.length === 0) {
    throwNoUpdatableColumns(metadata, update, false);
  }

  const alias = dialect.supportsUpdateAlias ? "t0" : null;
  const entries: Array<PredicateEntry<E>> = [{ predicate: criteria, conjunction: "and" }];
  const whereClause = compileWhere(entries, metadata, alias, params, dialect);

  if (!whereClause) {
    throwEmptyCriteria(metadata, false);
  }

  // Add discriminator predicate for single-table inheritance children
  const discPredicate = alias
    ? buildDiscriminatorPredicateQualified(metadata, alias, params, dialect)
    : buildDiscriminatorPredicateUnqualified(metadata, params, dialect);
  const discClause = discPredicate ? ` AND ${discPredicate}` : "";

  const aliasSuffix = alias ? ` AS ${dialect.quoteIdentifier(alias)}` : "";
  const text = `UPDATE ${tableName}${aliasSuffix} SET ${setClauses.join(", ")} ${whereClause}${discClause}`;

  return { text, params };
};

/**
 * Compile an UPDATE ... FROM for a joined inheritance child (PG).
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
const compileJoinedUpdateManyFrom = <E extends IEntity>(
  criteria: Condition<E>,
  update: DeepPartial<E>,
  metadata: EntityMetadata,
  dialect: SqlDialect,
  deps: CompileUpdateDeps,
  ctx: JoinedChildUpdateContext,
  namespace?: string | null,
  amphora?: IAmphora,
): CompiledSql => {
  const resolved = resolveTableName(metadata, dialect, namespace);
  const rootQualified = dialect.quoteQualifiedName(resolved.schema, resolved.name);
  const childQualified = deps.quoteChildTableName(metadata, namespace);

  const params: Array<unknown> = [];

  // Partition SET clauses into root vs child
  const { rootSetClauses, childSetClauses } = partitionSetClauses(
    update,
    metadata,
    dialect,
    deps,
    ctx,
    params,
    amphora,
  );

  if (rootSetClauses.length === 0 && childSetClauses.length === 0) {
    throwNoUpdatableColumns(metadata, update, true);
  }

  // Determine target: if any child SET columns, UPDATE child table
  const updateChild = childSetClauses.length > 0;

  // Target table is t0 (the table being updated)
  // Other table is the FROM table (aliased differently)
  const targetTable = updateChild ? childQualified : rootQualified;
  const fromTable = updateChild ? rootQualified : childQualified;
  const fromAlias = "t1";
  const setClauses = updateChild ? childSetClauses : rootSetClauses;

  const aliasOverrides = buildRoutedAliasOverrides(metadata, ctx, updateChild, fromAlias);

  // Build WHERE clause with alias overrides
  const entries: Array<PredicateEntry<E>> = [{ predicate: criteria, conjunction: "and" }];
  const whereClause = compileWhere(
    entries,
    metadata,
    "t0",
    params,
    dialect,
    aliasOverrides,
  );

  if (!whereClause) {
    throwEmptyCriteria(metadata, true);
  }

  // PK join condition: t0.pk = t1.pk
  const pkJoinConditions = metadata.primaryKeys.map((pk) => {
    const field = metadata.fields.find((f) => f.key === pk);
    const colName = field?.name ?? pk;
    return `${dialect.quoteIdentifier("t0")}.${dialect.quoteIdentifier(colName)} = ${dialect.quoteIdentifier(fromAlias)}.${dialect.quoteIdentifier(colName)}`;
  });

  // Discriminator predicate: always on the root table
  const discAlias = updateChild ? fromAlias : "t0";
  const discPredicate = buildDiscriminatorPredicateQualified(
    metadata,
    discAlias,
    params,
    dialect,
  );
  const discClause = discPredicate ? ` AND ${discPredicate}` : "";

  const text = [
    `UPDATE ${targetTable} AS ${dialect.quoteIdentifier("t0")}`,
    `SET ${setClauses.join(", ")}`,
    `FROM ${fromTable} AS ${dialect.quoteIdentifier(fromAlias)}`,
    `${whereClause} AND ${pkJoinConditions.join(" AND ")}${discClause}`,
  ].join(" ");

  return { text, params };
};

/**
 * Compile a multi-table UPDATE for a joined inheritance child (MySQL):
 *   UPDATE root AS t0 INNER JOIN child AS t1 ON t0.id = t1.id SET t0.col=?, t1.col=? WHERE ...
 */
const compileJoinedUpdateManyMultiTable = <E extends IEntity>(
  criteria: Condition<E>,
  update: DeepPartial<E>,
  metadata: EntityMetadata,
  dialect: SqlDialect,
  deps: CompileUpdateDeps,
  ctx: JoinedChildUpdateContext,
  namespace?: string | null,
  amphora?: IAmphora,
): CompiledSql => {
  const resolved = resolveTableName(metadata, dialect, namespace);
  const rootQualified = dialect.quoteQualifiedName(resolved.schema, resolved.name);
  const childQualified = deps.quoteChildTableName(metadata, namespace);

  const discriminatorColName = getDiscriminatorColumnName(metadata);
  const params: Array<unknown> = [];

  // Both tables are updated in place, so SET clauses carry qualified column names
  const setClauses: Array<string> = [];

  for (const [key, value] of Object.entries(update as Record<string, unknown>)) {
    const field = metadata.fields.find((f) => f.key === key);
    if (!field) continue;
    if (discriminatorColName && field.name === discriminatorColName) continue;

    const alias = ctx.childFieldNames.has(field.name) ? "t1" : "t0";

    if (field.typedJson) {
      for (const pair of typedJsonChangedColumns(
        field,
        value,
        (d) => deps.coerceWriteValue(d, field),
        amphora,
        metadata.entity.name,
      )) {
        params.push(pair.value);
        setClauses.push(
          `${dialect.quoteIdentifier(alias)}.${dialect.quoteIdentifier(pair.column)} = ${dialect.placeholder(params)}`,
        );
      }
      continue;
    }

    params.push(coerceAndEncrypt(value, field, metadata, deps, amphora));
    setClauses.push(
      `${dialect.quoteIdentifier(alias)}.${dialect.quoteIdentifier(field.name)} = ${dialect.placeholder(params)}`,
    );
  }

  if (setClauses.length === 0) {
    throwNoUpdatableColumns(metadata, update, true);
  }

  // Build WHERE clause with the context's alias overrides
  const entries: Array<PredicateEntry<E>> = [{ predicate: criteria, conjunction: "and" }];
  const whereClause = compileWhere(
    entries,
    metadata,
    "t0",
    params,
    dialect,
    ctx.fieldAliasOverrides,
  );

  if (!whereClause) {
    throwEmptyCriteria(metadata, true);
  }

  // Discriminator predicate on root table
  const discPredicate = buildDiscriminatorPredicateQualified(
    metadata,
    "t0",
    params,
    dialect,
  );
  const discClause = discPredicate ? ` AND ${discPredicate}` : "";

  // Multi-table UPDATE syntax
  const joinCond = ctx.joinConditions.join(" AND ");

  const text = `UPDATE ${rootQualified} AS ${dialect.quoteIdentifier("t0")} INNER JOIN ${childQualified} AS ${dialect.quoteIdentifier("t1")} ON ${joinCond} SET ${setClauses.join(", ")} ${whereClause}${discClause}`;

  return { text, params };
};

/**
 * Compile an UPDATE for a joined inheritance child using a subquery (SQLite):
 *   UPDATE target SET col = ? WHERE pk IN (SELECT t0.pk FROM target AS t0 INNER JOIN other AS t1 ON ... WHERE ...)
 */
const compileJoinedUpdateManySubquery = <E extends IEntity>(
  criteria: Condition<E>,
  update: DeepPartial<E>,
  metadata: EntityMetadata,
  dialect: SqlDialect,
  deps: CompileUpdateDeps,
  ctx: JoinedChildUpdateContext,
  namespace?: string | null,
  amphora?: IAmphora,
): CompiledSql => {
  const resolved = resolveTableName(metadata, dialect, namespace);
  const rootQualified = dialect.quoteQualifiedName(resolved.schema, resolved.name);
  const childQualified = deps.quoteChildTableName(metadata, namespace);

  const params: Array<unknown> = [];

  // Partition SET clauses into root vs child
  const { rootSetClauses, childSetClauses } = partitionSetClauses(
    update,
    metadata,
    dialect,
    deps,
    ctx,
    params,
    amphora,
  );

  if (rootSetClauses.length === 0 && childSetClauses.length === 0) {
    throwNoUpdatableColumns(metadata, update, true);
  }

  // Determine target: if any child SET columns, UPDATE child table
  const updateChild = childSetClauses.length > 0;
  const targetTable = updateChild ? childQualified : rootQualified;
  const setClauses = updateChild ? childSetClauses : rootSetClauses;

  const aliasOverrides = buildRoutedAliasOverrides(metadata, ctx, updateChild, "t1");

  // Build WHERE clause for the subquery using aliases
  const entries: Array<PredicateEntry<E>> = [{ predicate: criteria, conjunction: "and" }];
  const subqueryParams: Array<unknown> = [];
  const whereClause = compileWhere(
    entries,
    metadata,
    "t0",
    subqueryParams,
    dialect,
    aliasOverrides,
  );

  if (!whereClause) {
    throwEmptyCriteria(metadata, true);
  }

  // PK columns for the subquery SELECT
  const pkCols = metadata.primaryKeys.map((pk) => {
    const field = metadata.fields.find((f) => f.key === pk);
    const colName = field?.name ?? pk;
    return `${dialect.quoteIdentifier("t0")}.${dialect.quoteIdentifier(colName)}`;
  });

  // PK join condition in the subquery
  const fromTable = updateChild ? rootQualified : childQualified;
  const pkJoinConditions = metadata.primaryKeys.map((pk) => {
    const field = metadata.fields.find((f) => f.key === pk);
    const colName = field?.name ?? pk;
    return `${dialect.quoteIdentifier("t0")}.${dialect.quoteIdentifier(colName)} = ${dialect.quoteIdentifier("t1")}.${dialect.quoteIdentifier(colName)}`;
  });

  // Discriminator predicate: always on the root table
  const discAlias = updateChild ? "t1" : "t0";
  const discPredicate = buildDiscriminatorPredicateQualified(
    metadata,
    discAlias,
    subqueryParams,
    dialect,
  );
  const discClause = discPredicate ? ` AND ${discPredicate}` : "";

  // Build the subquery
  const subquery = `SELECT ${pkCols.join(", ")} FROM ${targetTable} AS ${dialect.quoteIdentifier("t0")} INNER JOIN ${fromTable} AS ${dialect.quoteIdentifier("t1")} ON ${pkJoinConditions.join(" AND ")} ${whereClause}${discClause}`;

  // Build the outer UPDATE with WHERE pk IN (subquery)
  params.push(...subqueryParams);

  const pkConditions = metadata.primaryKeys.map((pk) => {
    const field = metadata.fields.find((f) => f.key === pk);
    return dialect.quoteIdentifier(field?.name ?? pk);
  });

  const pkCondition =
    pkConditions.length === 1
      ? `${pkConditions[0]} IN (${subquery})`
      : `(${pkConditions.join(", ")}) IN (${subquery})`;

  const text = `UPDATE ${targetTable} SET ${setClauses.join(", ")} WHERE ${pkCondition}`;

  return { text, params };
};

/**
 * Apply `transform.to()`, the driver's write coercion, and field-level
 * encryption when configured.
 *
 * The transform runs FIRST, matching dehydrateEntity and compile-partial-update.
 * updateMany used to skip it entirely, so a transformed column was written raw
 * while every read still applied `transform.from()` — an asymmetric round-trip.
 */
const coerceAndEncrypt = (
  value: unknown,
  field: MetaField,
  metadata: EntityMetadata,
  deps: CompileUpdateDeps,
  amphora?: IAmphora,
): unknown =>
  dehydrateFieldValue(value, field, metadata.entity.name, {
    amphora,
    coerce: (v) => deps.coerceWriteValue(v, field),
  });

/**
 * Partition SET clauses of a joined inheritance update into root-table vs
 * child-table buckets (used by the "from" and "subquery" strategies, which
 * update a single table and join the other).
 */
const partitionSetClauses = <E extends IEntity>(
  update: DeepPartial<E>,
  metadata: EntityMetadata,
  dialect: SqlDialect,
  deps: CompileUpdateDeps,
  ctx: JoinedChildUpdateContext,
  params: Array<unknown>,
  amphora?: IAmphora,
): { rootSetClauses: Array<string>; childSetClauses: Array<string> } => {
  const discriminatorColName = getDiscriminatorColumnName(metadata);

  const rootSetClauses: Array<string> = [];
  const childSetClauses: Array<string> = [];

  for (const [key, value] of Object.entries(update as Record<string, unknown>)) {
    const field = metadata.fields.find((f) => f.key === key);
    if (!field) continue;
    if (discriminatorColName && field.name === discriminatorColName) continue;

    const target = ctx.childFieldNames.has(field.name) ? childSetClauses : rootSetClauses;

    if (field.typedJson) {
      for (const pair of typedJsonChangedColumns(
        field,
        value,
        (d) => deps.coerceWriteValue(d, field),
        amphora,
        metadata.entity.name,
      )) {
        params.push(pair.value);
        target.push(
          `${dialect.quoteIdentifier(pair.column)} = ${dialect.placeholder(params)}`,
        );
      }
      continue;
    }

    params.push(coerceAndEncrypt(value, field, metadata, deps, amphora));
    target.push(
      `${dialect.quoteIdentifier(field.name)} = ${dialect.placeholder(params)}`,
    );
  }

  return { rootSetClauses, childSetClauses };
};

/**
 * Route criteria fields to the joined table's alias. When updating the child
 * table (t0), root-only criteria fields route to the FROM/JOIN alias; when
 * updating the root table (t0), child-only criteria fields route there.
 */
const buildRoutedAliasOverrides = (
  metadata: EntityMetadata,
  ctx: JoinedChildUpdateContext,
  updateChild: boolean,
  fromAlias: string,
): FieldAliasOverrides => {
  const aliasOverrides: FieldAliasOverrides = new Map();
  if (updateChild) {
    for (const field of metadata.fields) {
      if (
        !ctx.childFieldNames.has(field.name) &&
        !metadata.primaryKeys.includes(field.key)
      ) {
        aliasOverrides.set(field.key, fromAlias);
      }
    }
  } else {
    for (const [key] of ctx.fieldAliasOverrides) {
      aliasOverrides.set(key, fromAlias);
    }
  }
  return aliasOverrides;
};

const throwNoUpdatableColumns = (
  metadata: EntityMetadata,
  update: DeepPartial<IEntity>,
  joined: boolean,
): never => {
  throw new ProteusRepositoryError(
    `updateMany: no valid columns in update object for entity "${metadata.entity.name}"`,
    {
      code: "invalid_query",
      title: "Invalid Query",
      details: joined
        ? `The updateMany payload for joined-inheritance entity "${metadata.entity.name}" maps to no root or child columns, so no SET clause can be generated.`
        : `The updateMany payload for "${metadata.entity.name}" maps to no updatable columns, so no SET clause can be generated.`,
      data: { entity: metadata.entity.name },
      debug: {
        updateKeys: Object.keys(update as Record<string, unknown>),
      },
    },
  );
};

const throwEmptyCriteria = (metadata: EntityMetadata, joined: boolean): never => {
  throw new ProteusRepositoryError(
    `updateMany: criteria must not be empty for entity "${metadata.entity.name}"`,
    {
      code: "invalid_query",
      title: "Invalid Query",
      details: joined
        ? `updateMany on joined-inheritance entity "${metadata.entity.name}" was rejected because its criteria compiled to an empty WHERE clause, which would update every row.`
        : `updateMany on "${metadata.entity.name}" was rejected because its criteria compiled to an empty WHERE clause, which would update every row.`,
      data: { entity: metadata.entity.name },
    },
  );
};
