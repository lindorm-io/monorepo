import type { EntityMetadata, MetaRelation } from "../../../../entity/types/metadata";
import type { IncludeSpec } from "../../../../types/query";
import { generateAutoFilters } from "../../../../entity/metadata/auto-filters";
import { mergeSystemFilterOverrides } from "../../../../utils/query/merge-system-filter-overrides";
import { resolveFilters } from "../../../../utils/query/resolve-filters";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier";
import { resolveColumnNameSafe } from "../resolve-column-name";
import { findRelationByKey, getRelationMetadata } from "./get-relation-metadata";
import { compilePredicate } from "./compile-where";

export type CompiledRelationQuery = {
  text: string;
  params: Array<unknown>;
  relation: MetaRelation;
  foreignMetadata: EntityMetadata;
  include: IncludeSpec;
};

export type RelationQueryContext = {
  rootMetadata: EntityMetadata;
  namespace: string | null;
  withDeleted: boolean;
  versionTimestamp: Date | null;
};

export const compileRelationQuery = (
  include: IncludeSpec,
  rootPkValues: Array<Array<unknown>>,
  ctx: RelationQueryContext,
): CompiledRelationQuery => {
  const relation = findRelationByKey(ctx.rootMetadata, include.relation);
  const foreignMeta = getRelationMetadata(relation);
  const params: Array<unknown> = [];
  // SQLite has no schemas
  const schema: string | null = null;

  if (
    relation.type === "ManyToMany" &&
    relation.joinTable &&
    typeof relation.joinTable === "string"
  ) {
    return compileManyToManyQuery(
      include,
      relation,
      foreignMeta,
      rootPkValues,
      ctx,
      schema,
      params,
    );
  }

  if (relation.joinKeys) {
    return compileOwningQuery(
      include,
      relation,
      foreignMeta,
      rootPkValues,
      ctx,
      schema,
      params,
    );
  }

  return compileInverseQuery(
    include,
    relation,
    foreignMeta,
    rootPkValues,
    ctx,
    schema,
    params,
  );
};

const compileOwningQuery = (
  include: IncludeSpec,
  relation: MetaRelation,
  foreignMeta: EntityMetadata,
  rootPkValues: Array<Array<unknown>>,
  ctx: RelationQueryContext,
  schema: string | null,
  params: Array<unknown>,
): CompiledRelationQuery => {
  const tableName = quoteQualifiedName(schema, foreignMeta.entity.name);
  const columns = buildSelectColumns(foreignMeta, include);

  const foreignPkKeys = Object.values(relation.joinKeys!);

  const conditions = buildInCondition(foreignMeta, foreignPkKeys, rootPkValues, params);
  const filters = buildFilters(foreignMeta, include, ctx, params);
  const allConditions = [conditions, ...filters].filter(Boolean).join(" AND ");
  const orderBy = buildRelationOrderBy(relation, foreignMeta);

  const text = `SELECT ${columns} FROM ${tableName} WHERE ${allConditions}${orderBy}`;

  return { text, params, relation, foreignMetadata: foreignMeta, include };
};

const compileInverseQuery = (
  include: IncludeSpec,
  relation: MetaRelation,
  foreignMeta: EntityMetadata,
  rootPkValues: Array<Array<unknown>>,
  ctx: RelationQueryContext,
  schema: string | null,
  params: Array<unknown>,
): CompiledRelationQuery => {
  const tableName = quoteQualifiedName(schema, foreignMeta.entity.name);
  const columns = buildSelectColumns(foreignMeta, include);

  const foreignFkKeys = Object.keys(relation.findKeys!);

  const fkExtraColumns = foreignFkKeys
    .filter((k) => !foreignMeta.fields.some((f) => f.key === k))
    .map((k) => quoteIdentifier(k));
  const allColumns =
    fkExtraColumns.length > 0 ? `${columns}, ${fkExtraColumns.join(", ")}` : columns;

  const conditions = buildInCondition(foreignMeta, foreignFkKeys, rootPkValues, params);
  const filters = buildFilters(foreignMeta, include, ctx, params);
  const allConditions = [conditions, ...filters].filter(Boolean).join(" AND ");
  const orderBy = buildRelationOrderBy(relation, foreignMeta);

  const text = `SELECT ${allColumns} FROM ${tableName} WHERE ${allConditions}${orderBy}`;

  return { text, params, relation, foreignMetadata: foreignMeta, include };
};

const compileManyToManyQuery = (
  include: IncludeSpec,
  relation: MetaRelation,
  foreignMeta: EntityMetadata,
  rootPkValues: Array<Array<unknown>>,
  ctx: RelationQueryContext,
  schema: string | null,
  params: Array<unknown>,
): CompiledRelationQuery => {
  const foreignTable = quoteQualifiedName(schema, foreignMeta.entity.name);
  const joinTableName = quoteQualifiedName(
    null, // SQLite has no schemas
    relation.joinTable as string,
  );
  const columns = buildSelectColumns(foreignMeta, include, "f");

  const joinKeys = relation.joinKeys!;

  const inverseRelation = foreignMeta.relations.find(
    (r) =>
      r.type === "ManyToMany" &&
      r.foreignKey === relation.key &&
      r.key === relation.foreignKey,
  );
  const foreignJoinKeys = inverseRelation?.joinKeys ?? relation.findKeys ?? {};

  const joinTableRootCols = Object.entries(joinKeys).map(
    ([joinCol]) =>
      `${quoteIdentifier("j")}.${quoteIdentifier(joinCol)} AS ${quoteIdentifier(`__jt_${joinCol}`)}`,
  );

  const joinConditions = Object.entries(foreignJoinKeys).map(
    ([joinCol, foreignPkKey]) => {
      const foreignPkCol = resolveColumnNameSafe(foreignMeta.fields, foreignPkKey);
      return `${quoteIdentifier("j")}.${quoteIdentifier(joinCol)} = ${quoteIdentifier("f")}.${quoteIdentifier(foreignPkCol)}`;
    },
  );

  const rootJoinCols = Object.keys(joinKeys);
  const inCondition = buildInCondition(null, rootJoinCols, rootPkValues, params, "j");
  const filters = buildFilters(foreignMeta, include, ctx, params, "f");
  const allWhereConditions = [inCondition, ...filters].filter(Boolean).join(" AND ");

  const orderBy = buildRelationOrderBy(relation, foreignMeta, "f");

  const selectCols = [columns, ...joinTableRootCols].join(", ");
  const text = `SELECT ${selectCols} FROM ${foreignTable} AS ${quoteIdentifier("f")} INNER JOIN ${joinTableName} AS ${quoteIdentifier("j")} ON ${joinConditions.join(" AND ")} WHERE ${allWhereConditions}${orderBy}`;

  return { text, params, relation, foreignMetadata: foreignMeta, include };
};

const buildRelationOrderBy = (
  relation: MetaRelation,
  foreignMeta: EntityMetadata,
  tableAlias?: string,
): string => {
  if (!relation.orderBy) return "";
  const prefix = tableAlias ? `${quoteIdentifier(tableAlias)}.` : "";
  const clauses = Object.entries(relation.orderBy).map(([key, dir]) => {
    const colName = resolveColumnNameSafe(foreignMeta.fields, key);
    return `${prefix}${quoteIdentifier(colName)} ${dir}`;
  });
  return ` ORDER BY ${clauses.join(", ")}`;
};

const buildSelectColumns = (
  metadata: EntityMetadata,
  include: IncludeSpec,
  tableAlias?: string,
): string => {
  const fields = include.select
    ? metadata.fields.filter((f) => include.select!.includes(f.key))
    : metadata.fields;

  const prefix = tableAlias ? `${quoteIdentifier(tableAlias)}.` : "";

  return fields.map((f) => `${prefix}${quoteIdentifier(f.name)}`).join(", ");
};

const buildInCondition = (
  metadata: EntityMetadata | null,
  fieldKeys: Array<string>,
  pkValues: Array<Array<unknown>>,
  params: Array<unknown>,
  tableAlias?: string,
): string => {
  const prefix = tableAlias ? `${quoteIdentifier(tableAlias)}.` : "";

  if (fieldKeys.length === 1) {
    const colName = metadata
      ? resolveColumnNameSafe(metadata.fields, fieldKeys[0])
      : fieldKeys[0];
    const placeholders = pkValues.map((vals) => {
      params.push(vals[0]);
      return "?";
    });
    return `${prefix}${quoteIdentifier(colName)} IN (${placeholders.join(", ")})`;
  }

  // Composite key: (col1, col2) IN ((v1, v2), ...)
  // SQLite supports this syntax
  const cols = fieldKeys.map((k) => {
    const colName = metadata ? resolveColumnNameSafe(metadata.fields, k) : k;
    return `${prefix}${quoteIdentifier(colName)}`;
  });
  const tuples = pkValues.map((vals) => {
    const placeholders = vals.map((v) => {
      params.push(v);
      return "?";
    });
    return `(${placeholders.join(", ")})`;
  });
  return `(${cols.join(", ")}) IN (${tuples.join(", ")})`;
};

const buildFilters = (
  foreignMeta: EntityMetadata,
  include: IncludeSpec,
  ctx: RelationQueryContext,
  params: Array<unknown>,
  tableAlias?: string,
): Array<string> => {
  const conditions: Array<string> = [];
  const prefix = tableAlias ? `${quoteIdentifier(tableAlias)}.` : "";

  // Soft-delete filter via unified filter infrastructure
  const metaFilters = foreignMeta.filters?.length
    ? foreignMeta.filters
    : generateAutoFilters(foreignMeta.fields);
  const filterOverrides = mergeSystemFilterOverrides(undefined, ctx.withDeleted);
  const resolved = resolveFilters(metaFilters, new Map(), filterOverrides);
  for (const filter of resolved) {
    const compiled = compilePredicate(
      filter.predicate,
      foreignMeta,
      tableAlias ?? null,
      params,
    );
    if (compiled) conditions.push(compiled);
  }

  // Version filter
  const startField = foreignMeta.fields.find((f) => f.decorator === "VersionStartDate");
  const endField = foreignMeta.fields.find((f) => f.decorator === "VersionEndDate");
  if (startField && endField) {
    const startCol = `${prefix}${quoteIdentifier(startField.name)}`;
    const endCol = `${prefix}${quoteIdentifier(endField.name)}`;

    if (ctx.versionTimestamp) {
      params.push(ctx.versionTimestamp, ctx.versionTimestamp);
      conditions.push(`${startCol} <= ? AND (${endCol} IS NULL OR ${endCol} > ?)`);
    } else {
      conditions.push(`${endCol} IS NULL`);
    }
  }

  // User-provided WHERE
  if (include.where) {
    const extra = compilePredicate(
      include.where,
      foreignMeta,
      tableAlias ?? null,
      params,
    );
    if (extra) conditions.push(extra);
  }

  return conditions;
};
