import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "../../../../entity/types/metadata";
import type {
  QueryState,
  RawWhereEntry,
  SubqueryPredicateSpec,
} from "../../../../types/query";
import { generateAutoFilters } from "../../../../entity/metadata/auto-filters";
import { mergeSystemFilterOverrides } from "../../../../utils/query/merge-system-filter-overrides";
import type { ResolvedFilter } from "../../../../utils/query/resolve-filters";
import { resolveFilters } from "../../../../utils/query/resolve-filters";
import { quoteIdentifier } from "../quote-identifier";
import { resolveColumnName } from "../resolve-column-name";
import {
  compilePredicate,
  compileWhere,
  type FieldAliasOverrides,
} from "./compile-where";
import type { InheritanceAliasMap } from "./compile-inheritance-join";

/**
 * Build a FieldAliasOverrides map from inheritance aliases.
 */
const buildFieldAliasOverrides = (
  inheritanceAliases?: Array<InheritanceAliasMap>,
): FieldAliasOverrides | undefined => {
  if (!inheritanceAliases || inheritanceAliases.length === 0) return undefined;

  const overrides: FieldAliasOverrides = new Map();
  for (const alias of inheritanceAliases) {
    for (const field of alias.childFields) {
      overrides.set(field.key, alias.tableAlias);
    }
  }

  return overrides.size > 0 ? overrides : undefined;
};

/**
 * Collect all effective filters for a query.
 */
const collectEffectiveFilters = <E extends IEntity>(
  state: QueryState<E>,
  metadata: EntityMetadata,
): Array<ResolvedFilter> => {
  const stateFilterNames = new Set(state.resolvedFilters.map((f) => f.name));

  const metaFilters = metadata.filters?.length
    ? metadata.filters
    : generateAutoFilters(metadata.fields);

  const qbOverrides =
    Object.keys(state.filterOverrides).length > 0 ? state.filterOverrides : undefined;
  const systemFilterOverrides = mergeSystemFilterOverrides(
    qbOverrides,
    state.withDeleted,
    state.withoutScope,
  );

  const systemFilters = resolveFilters(
    metaFilters,
    new Map(),
    systemFilterOverrides,
  ).filter((f) => f.name.startsWith("__") && !stateFilterNames.has(f.name));

  const userFilters = qbOverrides
    ? resolveFilters(metaFilters, new Map(), qbOverrides).filter(
        (f) => !f.name.startsWith("__") && !stateFilterNames.has(f.name),
      )
    : [];

  return [...systemFilters, ...userFilters, ...state.resolvedFilters];
};

export const compileWhereWithFilters = <E extends IEntity>(
  state: QueryState<E>,
  metadata: EntityMetadata,
  params: Array<unknown>,
  tableAlias: string | null = "t0",
  inheritanceAliases?: Array<InheritanceAliasMap>,
): string => {
  const fieldAliasOverrides = buildFieldAliasOverrides(inheritanceAliases);
  const userWhere = compileWhere(
    state.predicates,
    metadata,
    tableAlias,
    params,
    fieldAliasOverrides,
  );

  const systemConditions: Array<string> = [];

  const version = getVersionCondition(state, metadata, params, tableAlias ?? "t0");
  if (version) systemConditions.push(version);

  const systemClause = systemConditions.join(" AND ");

  let result = "";
  if (userWhere && systemClause) result = `${userWhere} AND ${systemClause}`;
  else if (userWhere) result = userWhere;
  else if (systemClause) result = `WHERE ${systemClause}`;

  const effectiveFilters = collectEffectiveFilters(state, metadata);
  if (effectiveFilters.length > 0) {
    result = appendFilters(
      result,
      effectiveFilters,
      metadata,
      tableAlias,
      params,
      fieldAliasOverrides,
    );
  }

  // Raw WHERE fragments -- no reindexing needed for MySQL positional `?` params
  if (state.rawWhere.length > 0) {
    result = appendRawWhere(result, state.rawWhere, params);
  }

  // Subquery predicates
  if (state.subqueryPredicates.length > 0) {
    result = appendSubqueryPredicates(
      result,
      state.subqueryPredicates,
      metadata,
      params,
      tableAlias,
    );
  }

  return result;
};

const appendFilters = (
  current: string,
  filters: Array<ResolvedFilter>,
  metadata: EntityMetadata,
  tableAlias: string | null,
  params: Array<unknown>,
  fieldAliasOverrides?: FieldAliasOverrides,
): string => {
  let result = current;

  for (const filter of filters) {
    const compiled = compilePredicate(
      filter.predicate,
      metadata,
      tableAlias,
      params,
      fieldAliasOverrides,
    );
    if (!compiled) continue;

    if (!result) {
      result = `WHERE ${compiled}`;
    } else {
      result = `${result} AND ${compiled}`;
    }
  }

  return result;
};

const appendRawWhere = (
  current: string,
  rawEntries: Array<RawWhereEntry>,
  params: Array<unknown>,
): string => {
  let result = current;

  for (const entry of rawEntries) {
    // No reindexing needed for MySQL -- just append params
    params.push(...entry.params);

    if (!result) {
      result = `WHERE ${entry.sql}`;
    } else {
      const conjunction = entry.conjunction === "or" ? "OR" : "AND";
      const lhs = conjunction === "OR" ? wrapInParens(result) : result;
      result = `${lhs} ${conjunction} ${entry.sql}`;
    }
  }

  return result;
};

const appendSubqueryPredicates = (
  current: string,
  entries: Array<SubqueryPredicateSpec>,
  metadata: EntityMetadata,
  params: Array<unknown>,
  tableAlias: string | null,
): string => {
  let result = current;

  for (const entry of entries) {
    let clause: string;

    // No reindexing needed for MySQL -- just append params
    params.push(...entry.params);

    if (entry.type === "exists") {
      clause = `EXISTS (${entry.sql})`;
    } else if (entry.type === "notExists") {
      clause = `NOT EXISTS (${entry.sql})`;
    } else if (entry.type === "in" || entry.type === "nin") {
      const colName = resolveColumnName(metadata.fields, entry.field, metadata.relations);
      const qualifiedCol = tableAlias
        ? `${quoteIdentifier(tableAlias)}.${quoteIdentifier(colName)}`
        : quoteIdentifier(colName);
      const keyword = entry.type === "in" ? "IN" : "NOT IN";
      clause = `${qualifiedCol} ${keyword} (${entry.sql})`;
    } else {
      continue;
    }

    if (!result) {
      result = `WHERE ${clause}`;
    } else {
      const conjunction = entry.conjunction === "or" ? "OR" : "AND";
      const lhs = conjunction === "OR" ? wrapInParens(result) : result;
      result = `${lhs} ${conjunction} ${clause}`;
    }
  }

  return result;
};

/** Wraps WHERE clause body in parens: `WHERE a AND b` -> `WHERE (a AND b)` */
const wrapInParens = (whereClause: string): string => {
  if (whereClause.startsWith("WHERE ")) {
    return `WHERE (${whereClause.slice(6)})`;
  }
  return whereClause;
};

export const getVersionCondition = <E extends IEntity>(
  state: QueryState<E>,
  metadata: EntityMetadata,
  params: Array<unknown>,
  tableAlias = "t0",
): string => {
  if (state.withAllVersions) return "";

  const startField = metadata.fields.find((f) => f.decorator === "VersionStartDate");
  const endField = metadata.fields.find((f) => f.decorator === "VersionEndDate");

  if (!startField || !endField) return "";

  const t = quoteIdentifier(tableAlias);
  const startCol = `${t}.${quoteIdentifier(startField.name)}`;
  const endCol = `${t}.${quoteIdentifier(endField.name)}`;

  if (state.versionTimestamp) {
    params.push(state.versionTimestamp, state.versionTimestamp);
    return `${startCol} <= ? AND (${endCol} IS NULL OR ${endCol} > ?)`;
  }

  return `${endCol} IS NULL`;
};
