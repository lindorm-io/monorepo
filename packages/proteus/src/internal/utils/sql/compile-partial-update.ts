import type { IAmphora } from "@lindorm/amphora";
import type { Dict } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/index.js";
import type { EntityMetadata } from "../../entity/types/metadata.js";
import { dehydrateFieldValue } from "../../entity/utils/dehydrate-field-value.js";
import { typedJsonChangedColumns } from "../../entity/utils/typed-json.js";
import { partitionJoinedFields } from "../query/partition-joined-fields.js";
import {
  buildDiscriminatorPredicateQualified,
  buildDiscriminatorPredicateUnqualified,
  buildPrimaryKeyConditions,
  buildPrimaryKeyConditionsQualified,
  getDiscriminatorColumnName,
} from "./compile-helpers.js";
import type { CompiledSql } from "./compiled-sql.js";
import { resolveTableName } from "./resolve-table-name.js";
import type { SqlDialect } from "./sql-dialect.js";
import type { CoerceWriteValueFn, QuoteChildTableNameFn } from "./write-compiler-deps.js";

export type JoinedPartialUpdateSql = {
  /** Always present — either an UPDATE with changed root columns or a SELECT to retrieve root values. */
  rootSql: CompiledSql;
  /** Always present — an UPDATE for changed child columns or a SELECT to retrieve child values. */
  childSql: CompiledSql;
  /** True when rootSql is an UPDATE (has SET clauses); false when it's a read-only SELECT. */
  rootIsUpdate: boolean;
};

export type CompilePartialUpdateDeps = {
  coerceWriteValue: CoerceWriteValueFn;
  quoteChildTableName: QuoteChildTableNameFn;
};

/**
 * Compile a partial UPDATE with only changed columns from a diff result.
 *
 * SET clause: changed user-data columns + Version (bumped) + UpdateDate.
 * WHERE clause: PK + old version (version - 1) for optimistic locking.
 *
 * Uses `dialect.singleRowUpdateAlias` to decide between an aliased UPDATE with
 * qualified WHERE conditions (PG) and an unaliased one (MySQL/SQLite), and
 * appends `RETURNING *` when the dialect supports it — otherwise the executor
 * must SELECT the row back.
 *
 * @param entity - the prepared entity (post-copy, post-bump)
 * @param metadata - entity metadata
 * @param changed - Dict of { columnName: value } from diffColumns
 * @param namespace - optional schema namespace
 */
export const compilePartialUpdate = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  changed: Dict,
  dialect: SqlDialect,
  deps: CompilePartialUpdateDeps,
  namespace?: string | null,
  amphora?: IAmphora,
): CompiledSql => {
  const resolved = resolveTableName(metadata, dialect, namespace);
  const tableName = dialect.quoteQualifiedName(resolved.schema, resolved.name);

  const params: Array<unknown> = [];
  const setClauses: Array<string> = [];

  // Resolve discriminator column name to exclude from SET (read-only after creation)
  const discriminatorColName = getDiscriminatorColumnName(metadata);

  // Add changed columns (apply transform.to() for fields with transforms)
  pushChangedColumns(
    changed,
    discriminatorColName,
    metadata,
    dialect,
    deps,
    params,
    setClauses,
    amphora,
  );

  // Always add Version (bumped) — unless already in changed dict
  const versionField = metadata.fields.find((f) => f.decorator === "Version");
  if (versionField && !(versionField.name in changed)) {
    params.push(deps.coerceWriteValue((entity as any)[versionField.key], versionField));
    setClauses.push(
      `${dialect.quoteIdentifier(versionField.name)} = ${dialect.placeholder(params)}`,
    );
  }

  // Always add UpdateDate — unless already in changed dict
  const updateDateField = metadata.fields.find((f) => f.decorator === "UpdateDate");
  if (updateDateField && !(updateDateField.name in changed)) {
    params.push(
      deps.coerceWriteValue((entity as any)[updateDateField.key], updateDateField),
    );
    setClauses.push(
      `${dialect.quoteIdentifier(updateDateField.name)} = ${dialect.placeholder(params)}`,
    );
  }

  const alias = dialect.singleRowUpdateAlias;

  // WHERE: PK + old version
  const conditions = alias
    ? buildPrimaryKeyConditionsQualified(entity, metadata, params, alias, dialect)
    : buildPrimaryKeyConditions(entity, metadata, params, dialect);

  if (versionField) {
    const currentVersion = (entity as any)[versionField.key];
    params.push(currentVersion - 1);
    conditions.push(
      `${qualify(versionField.name, alias, dialect)} = ${dialect.placeholder(params)}`,
    );
  }

  // Add discriminator predicate for single-table inheritance children
  const discPredicate = alias
    ? buildDiscriminatorPredicateQualified(metadata, alias, params, dialect)
    : buildDiscriminatorPredicateUnqualified(metadata, params, dialect);
  if (discPredicate) {
    conditions.push(discPredicate);
  }

  const text = `UPDATE ${tableName}${aliasSuffix(alias, dialect)} SET ${setClauses.join(", ")} WHERE ${conditions.join(" AND ")}${returning(dialect)}`;

  return { text, params };
};

/**
 * Compile a multi-table partial UPDATE for a joined inheritance child entity.
 *
 * Splits the changed Dict into root-table vs child-table columns using
 * partitionJoinedFields, then produces:
 *   1. rootSql: UPDATE root table with root-only changed columns + Version + UpdateDate,
 *      WHERE PK + old version + discriminator predicate (optimistic lock on root).
 *      If no root columns need updating (no Version/UpdateDate and no root user changes),
 *      a SELECT is emitted instead to retrieve root column values for hydration.
 *   2. childSql: UPDATE child table with child-only changed columns, WHERE PK.
 *      Null if no child columns changed.
 *
 * rootSql is always present. childSql may be null.
 * rootIsUpdate indicates whether rootSql is an UPDATE (true) or SELECT (false).
 *
 * Returns null for non-joined-child entities.
 */
export const compileJoinedPartialUpdate = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  changed: Dict,
  dialect: SqlDialect,
  deps: CompilePartialUpdateDeps,
  namespace?: string | null,
  amphora?: IAmphora,
): JoinedPartialUpdateSql | null => {
  const partition = partitionJoinedFields(metadata);
  if (!partition) return null;

  const discriminatorColName = getDiscriminatorColumnName(metadata);
  const rootFieldNames = new Set(partition.rootFields.map((f) => f.name));

  // Split changed columns into root vs child buckets
  const rootChanged: Dict = {};
  const childChanged: Dict = {};

  for (const [colName, value] of Object.entries(changed)) {
    // Skip discriminator column — read-only after creation
    if (discriminatorColName && colName === discriminatorColName) continue;

    if (rootFieldNames.has(colName)) {
      rootChanged[colName] = value;
    } else {
      childChanged[colName] = value;
    }
  }

  const alias = dialect.singleRowUpdateAlias;

  // ─── Root table UPDATE ───
  // Root always gets Version + UpdateDate even if no user columns changed
  const rootParams: Array<unknown> = [];
  const rootSetClauses: Array<string> = [];

  // Add root changed columns (apply transform.to() for fields with transforms)
  pushChangedColumns(
    rootChanged,
    null,
    metadata,
    dialect,
    deps,
    rootParams,
    rootSetClauses,
    amphora,
  );

  // Always add Version (bumped) — unless already in changed dict
  const versionField = metadata.fields.find((f) => f.decorator === "Version");
  if (versionField && !(versionField.name in rootChanged)) {
    rootParams.push(
      deps.coerceWriteValue((entity as any)[versionField.key], versionField),
    );
    rootSetClauses.push(
      `${dialect.quoteIdentifier(versionField.name)} = ${dialect.placeholder(rootParams)}`,
    );
  }

  // Always add UpdateDate — unless already in changed dict
  const updateDateField = metadata.fields.find((f) => f.decorator === "UpdateDate");
  if (updateDateField && !(updateDateField.name in rootChanged)) {
    rootParams.push(
      deps.coerceWriteValue((entity as any)[updateDateField.key], updateDateField),
    );
    rootSetClauses.push(
      `${dialect.quoteIdentifier(updateDateField.name)} = ${dialect.placeholder(rootParams)}`,
    );
  }

  const rootResolved = resolveTableName(metadata, dialect, namespace);
  const rootTableName = dialect.quoteQualifiedName(
    rootResolved.schema,
    rootResolved.name,
  );

  // When a version field exists, the root UPDATE must always be issued (even if
  // only child columns changed) so the optimistic lock check fires on the root row.
  const mustUpdateRoot = rootSetClauses.length > 0 || !!versionField;

  let rootSql: CompiledSql;
  if (mustUpdateRoot) {
    // Root has columns to update — emit UPDATE
    const rootConditions = alias
      ? buildPrimaryKeyConditionsQualified(entity, metadata, rootParams, alias, dialect)
      : buildPrimaryKeyConditions(entity, metadata, rootParams, dialect);

    if (versionField) {
      const currentVersion = (entity as any)[versionField.key];
      rootParams.push(currentVersion - 1);
      rootConditions.push(
        `${qualify(versionField.name, alias, dialect)} = ${dialect.placeholder(rootParams)}`,
      );
    }

    const discPredicate = alias
      ? buildDiscriminatorPredicateQualified(metadata, alias, rootParams, dialect)
      : buildDiscriminatorPredicateUnqualified(metadata, rootParams, dialect);
    if (discPredicate) {
      rootConditions.push(discPredicate);
    }

    const rootText = `UPDATE ${rootTableName}${aliasSuffix(alias, dialect)} SET ${rootSetClauses.join(", ")} WHERE ${rootConditions.join(" AND ")}${returning(dialect)}`;
    rootSql = { text: rootText, params: rootParams };
  } else {
    // No root columns to update (no Version/UpdateDate and no user root changes).
    // Emit a SELECT to retrieve root column values for hydration of the merged row.
    const rootConditions = alias
      ? buildPrimaryKeyConditionsQualified(entity, metadata, rootParams, alias, dialect)
      : buildPrimaryKeyConditions(entity, metadata, rootParams, dialect);

    const rootText = `SELECT * FROM ${rootTableName}${aliasSuffix(alias, dialect)} WHERE ${rootConditions.join(" AND ")}`;
    rootSql = { text: rootText, params: rootParams };
  }

  // ─── Child table UPDATE or SELECT ───
  // Always emit a child SQL statement so the merged row contains child-specific columns
  // for hydration, even when no child columns were changed.
  const childTableName = deps.quoteChildTableName(metadata, namespace);

  let childSql: CompiledSql;
  const hasChildChanges = Object.keys(childChanged).length > 0;

  if (hasChildChanges) {
    const childParams: Array<unknown> = [];
    const childSetClauses: Array<string> = [];

    pushChangedColumns(
      childChanged,
      null,
      metadata,
      dialect,
      deps,
      childParams,
      childSetClauses,
      amphora,
    );

    // WHERE: PK only (no version check on child — optimistic lock is on root)
    const childConditions = alias
      ? buildPrimaryKeyConditionsQualified(entity, metadata, childParams, alias, dialect)
      : buildPrimaryKeyConditions(entity, metadata, childParams, dialect);

    const childText = `UPDATE ${childTableName}${aliasSuffix(alias, dialect)} SET ${childSetClauses.join(", ")} WHERE ${childConditions.join(" AND ")}${returning(dialect)}`;
    childSql = { text: childText, params: childParams };
  } else {
    // No child columns changed — emit a SELECT to retrieve child column values for hydration.
    const childParams: Array<unknown> = [];
    const childConditions = alias
      ? buildPrimaryKeyConditionsQualified(entity, metadata, childParams, alias, dialect)
      : buildPrimaryKeyConditions(entity, metadata, childParams, dialect);

    const childText = `SELECT * FROM ${childTableName}${aliasSuffix(alias, dialect)} WHERE ${childConditions.join(" AND ")}`;
    childSql = { text: childText, params: childParams };
  }

  return { rootSql, childSql, rootIsUpdate: mustUpdateRoot };
};

/**
 * Append SET clauses for a changed-columns Dict. Both branches apply the same
 * three steps — transform.to(), optional encryption, the driver's write coercion
 * — but a typedJson field runs them through typedJsonChangedColumns, which splits
 * before it seals and expands into the data + sidecar pair. The typedJson branch
 * used to skip transform.to() outright, so a transform on a typed-json field was
 * silently dropped on every partial update while reads still applied `from`.
 */
const pushChangedColumns = (
  changed: Dict,
  skipColumn: string | null,
  metadata: EntityMetadata,
  dialect: SqlDialect,
  deps: CompilePartialUpdateDeps,
  params: Array<unknown>,
  setClauses: Array<string>,
  amphora?: IAmphora,
): void => {
  for (const [colName, value] of Object.entries(changed)) {
    // Skip discriminator column — it is read-only after creation
    if (skipColumn && colName === skipColumn) continue;

    const field = metadata.fields.find((f) => f.name === colName);
    if (field?.typedJson) {
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
    params.push(
      dehydrateFieldValue(value, field, metadata.entity.name, {
        amphora,
        coerce: (v) => deps.coerceWriteValue(v, field ?? null),
      }),
    );
    setClauses.push(
      `${dialect.quoteIdentifier(colName)} = ${dialect.placeholder(params)}`,
    );
  }
};

const qualify = (column: string, alias: string | null, dialect: SqlDialect): string =>
  alias
    ? `${dialect.quoteIdentifier(alias)}.${dialect.quoteIdentifier(column)}`
    : dialect.quoteIdentifier(column);

const aliasSuffix = (alias: string | null, dialect: SqlDialect): string =>
  alias ? ` AS ${dialect.quoteIdentifier(alias)}` : "";

const returning = (dialect: SqlDialect): string =>
  dialect.supportsReturning ? " RETURNING *" : "";
