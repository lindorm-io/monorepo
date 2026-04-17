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
import { reindexParams } from "./reindex-params";

/**
 * Build a FieldAliasOverrides map from inheritance aliases.
 * Maps each child-only field key to its table alias so that WHERE clauses
 * reference the correct table in joined inheritance queries.
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
 * Collect all effective filters for a query, merging:
 * 1. System filters from metadata (e.g. __softDelete), respecting state.withDeleted
 * 2. Pre-resolved filters from state (from findOptionsToQueryState or QB)
 *
 * The repository path pre-resolves filters in findOptionsToQueryState (including __softDelete).
 * The QB path has state.resolvedFilters empty, so we resolve system filters here.
 * Deduplication by name prevents double-applying when coming from the repository path.
 *
 * Handles the case where metadata.filters may not contain auto-generated system filters
 * (e.g. test fixtures with manual metadata). Falls back to generating from fields.
 */
const collectEffectiveFilters = <E extends IEntity>(
  state: QueryState<E>,
  metadata: EntityMetadata,
): Array<ResolvedFilter> => {
  const stateFilterNames = new Set(state.resolvedFilters.map((f) => f.name));

  // Use metadata.filters if available, otherwise generate auto-filters from fields
  const metaFilters = metadata.filters?.length
    ? metadata.filters
    : generateAutoFilters(metadata.fields);

  // Merge QB-level filter overrides with system flag overrides (withDeleted, withoutScope)
  const qbOverrides =
    Object.keys(state.filterOverrides).length > 0 ? state.filterOverrides : undefined;
  const systemFilterOverrides = mergeSystemFilterOverrides(
    qbOverrides,
    state.withDeleted,
    state.withoutScope,
  );

  // Resolve system filters that aren't already in state.resolvedFilters
  const systemFilters = resolveFilters(
    metaFilters,
    new Map(),
    systemFilterOverrides,
  ).filter((f) => f.name.startsWith("__") && !stateFilterNames.has(f.name));

  // Resolve user-defined @Filter predicates from QB .setFilter() overrides
  const userFilters = qbOverrides
    ? resolveFilters(metaFilters, new Map(), qbOverrides).filter(
        (f) => !f.name.startsWith("__") && !stateFilterNames.has(f.name),
      )
    : [];

  // Combine: system filters first, then user QB filters, then state filters
  return [...systemFilters, ...userFilters, ...state.resolvedFilters];
};

export const compileWhereWithFilters = <E extends IEntity>(
  state: QueryState<E>,
  metadata: EntityMetadata,
  params: Array<unknown>,
  tableAlias = "t0",
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

  const version = getVersionCondition(state, metadata, params, tableAlias);
  if (version) systemConditions.push(version);

  const systemClause = systemConditions.join(" AND ");

  // Start with user WHERE + system filters
  let result = "";
  if (userWhere && systemClause) result = `${userWhere} AND ${systemClause}`;
  else if (userWhere) result = userWhere;
  else if (systemClause) result = `WHERE ${systemClause}`;

  // Append all filter predicates (system __softDelete + user-defined @Filter)
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

  // Append raw WHERE fragments (S1)
  if (state.rawWhere.length > 0) {
    result = appendRawWhere(result, state.rawWhere, params);
  }

  // Append subquery predicates (S3)
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

/**
 * Append filter predicates (system + user-defined) to the WHERE clause.
 * Each resolved filter is compiled as a Predicate and ANDed in.
 */
const appendFilters = (
  current: string,
  filters: Array<ResolvedFilter>,
  metadata: EntityMetadata,
  tableAlias: string,
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
    const reindexed = reindexParams(entry.sql, entry.params, params);

    if (!result) {
      result = `WHERE ${reindexed}`;
    } else {
      const conjunction = entry.conjunction === "or" ? "OR" : "AND";
      // Wrap existing clause in parens before OR to preserve system filter precedence
      const lhs = conjunction === "OR" ? wrapInParens(result) : result;
      result = `${lhs} ${conjunction} ${reindexed}`;
    }
  }

  return result;
};

const appendSubqueryPredicates = (
  current: string,
  entries: Array<SubqueryPredicateSpec>,
  metadata: EntityMetadata,
  params: Array<unknown>,
  tableAlias: string,
): string => {
  let result = current;

  for (const entry of entries) {
    let clause: string;

    if (entry.type === "exists") {
      const reindexed = reindexParams(entry.sql, entry.params, params);
      clause = `EXISTS (${reindexed})`;
    } else if (entry.type === "notExists") {
      const reindexed = reindexParams(entry.sql, entry.params, params);
      clause = `NOT EXISTS (${reindexed})`;
    } else if (entry.type === "in" || entry.type === "nin") {
      const colName = resolveColumnName(metadata.fields, entry.field, metadata.relations);
      const qualifiedCol = `${quoteIdentifier(tableAlias)}.${quoteIdentifier(colName)}`;
      const reindexed = reindexParams(entry.sql, entry.params, params);
      const keyword = entry.type === "in" ? "IN" : "NOT IN";
      clause = `${qualifiedCol} ${keyword} (${reindexed})`;
    } else {
      continue;
    }

    if (!result) {
      result = `WHERE ${clause}`;
    } else {
      const conjunction = entry.conjunction === "or" ? "OR" : "AND";
      // Wrap existing clause in parens before OR to preserve system filter precedence
      const lhs = conjunction === "OR" ? wrapInParens(result) : result;
      result = `${lhs} ${conjunction} ${clause}`;
    }
  }

  return result;
};

/** Wraps WHERE clause body in parens: `WHERE a AND b` → `WHERE (a AND b)` */
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

  // Both decorators must be present -- skip if only one found
  if (!startField || !endField) return "";

  const t = quoteIdentifier(tableAlias);
  const startCol = `${t}.${quoteIdentifier(startField.name)}`;
  const endCol = `${t}.${quoteIdentifier(endField.name)}`;

  if (state.versionTimestamp) {
    // Point-in-time: half-open interval [start, end)
    params.push(state.versionTimestamp);
    const idx = `$${params.length}`;
    return `${startCol} <= ${idx} AND (${endCol} IS NULL OR ${endCol} > ${idx})`;
  }

  // Default: current version only
  return `${endCol} IS NULL`;
};
