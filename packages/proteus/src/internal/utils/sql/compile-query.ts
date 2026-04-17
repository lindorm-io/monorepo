import { ProteusError } from "../../../errors";
import type { IEntity } from "../../../interfaces";
import type { EntityMetadata } from "../../entity/types/metadata";
import type {
  CteSpec,
  IncludeSpec,
  PredicateEntry,
  RawSelectEntry,
  RawWhereEntry,
  SetOperationEntry,
  WindowSpec,
} from "../../types/query";
import type { QueryState } from "../../types/query";
import type { SqlDialect } from "./sql-dialect";
import type { AliasMap, InheritanceAliasMap } from "./types";

export type CompileQueryResult = {
  text: string;
  params: Array<unknown>;
  aliasMap: Array<AliasMap>;
};

export type CompileQueryDeps<E extends IEntity> = {
  buildAliasMap: (
    metadata: EntityMetadata,
    includes: Array<IncludeSpec>,
    namespace?: string | null,
  ) => { aliasMap: Array<AliasMap>; inheritanceAliases: Array<InheritanceAliasMap> };
  compileSelect: (
    metadata: EntityMetadata,
    aliasMap: Array<AliasMap>,
    selections: Array<keyof E> | null,
    includes: Array<IncludeSpec>,
    distinct: boolean,
    rawSelections?: Array<RawSelectEntry>,
    windows?: Array<WindowSpec<E>>,
    params?: Array<unknown>,
    inheritanceAliases?: Array<InheritanceAliasMap>,
  ) => string;
  compileFrom: (aliasMap: Array<AliasMap>, cteFrom?: string | null) => string;
  compileCtes: (ctes: Array<CteSpec>, params: Array<unknown>) => string;
  compileInheritanceJoin: (
    metadata: EntityMetadata,
    inheritanceAliases: Array<InheritanceAliasMap>,
    rootAlias: string,
  ) => string;
  compileJoin: (
    includes: Array<IncludeSpec>,
    rootMetadata: EntityMetadata,
    aliasMap: Array<AliasMap>,
    params: Array<unknown>,
    versionTimestamp?: Date | null,
  ) => string;
  compileWhereWithFilters: (
    state: QueryState<E>,
    metadata: EntityMetadata,
    params: Array<unknown>,
    tableAlias: string,
    inheritanceAliases?: Array<InheritanceAliasMap>,
  ) => string;
  compileGroupBy: (
    groupBy: Array<keyof E> | null,
    metadata: EntityMetadata,
    tableAlias: string,
  ) => string;
  compileHaving: (
    entries: Array<PredicateEntry<E>>,
    rawEntries: Array<RawWhereEntry>,
    metadata: EntityMetadata,
    tableAlias: string,
    params: Array<unknown>,
  ) => string;
  compileOrderBy: (
    orderBy: Partial<Record<keyof E, "ASC" | "DESC">> | null,
    metadata: EntityMetadata,
    tableAlias: string,
  ) => string;
  compileLimitOffset: (
    skip: number | null,
    take: number | null,
    params: Array<unknown>,
  ) => string;
  compileSetOperations: (
    entries: Array<SetOperationEntry>,
    params: Array<unknown>,
  ) => string;
};

const compilePrimaryKeyExpression = (
  metadata: EntityMetadata,
  tableAlias: string,
  dialect: SqlDialect,
): string => {
  const primaryKeyFields = metadata.primaryKeys.map((primaryKey) => {
    const field = metadata.fields.find((f) => f.key === primaryKey);
    const colName = field?.name ?? primaryKey;
    return `${dialect.quoteIdentifier(tableAlias)}.${dialect.quoteIdentifier(colName)}`;
  });

  if (primaryKeyFields.length === 1) {
    return primaryKeyFields[0];
  }
  return dialect.compileCompositePkExpression(primaryKeyFields);
};

export const compileQuery = <E extends IEntity>(
  state: QueryState<E>,
  metadata: EntityMetadata,
  dialect: SqlDialect,
  deps: CompileQueryDeps<E>,
  namespace?: string | null,
): CompileQueryResult => {
  const params: Array<unknown> = [];
  const { aliasMap, inheritanceAliases } = deps.buildAliasMap(
    metadata,
    state.includes,
    namespace,
  );

  // Validate: FOR UPDATE/SHARE is not allowed with UNION/INTERSECT/EXCEPT
  if (state.lock && state.setOperations.length > 0) {
    throw new ProteusError("FOR UPDATE/SHARE is not allowed with UNION/INTERSECT/EXCEPT");
  }

  // Lock clause — may throw for unsupported drivers (e.g. SQLite)
  const lockClause = dialect.compileLockClause(state.lock);

  // Param ordering contract (MUST be preserved):
  // 1. CTE params (compileCtes)
  // 2. Raw SELECT expression params (compileSelect -> reindexParams)
  // 3. Inheritance JOIN (no params — pure equi-join on PK)
  // 4. Relation JOIN condition params (compileJoin)
  // 5. WHERE + system filter params (compileWhereWithFilters)
  // 6. HAVING params (compileHaving)
  // 7. LIMIT/OFFSET params (compileLimitOffset)
  // Reordering these calls will silently corrupt parameter indices.

  const cteClause = deps.compileCtes(state.ctes, params);

  const selectClause = deps.compileSelect(
    metadata,
    aliasMap,
    state.selections,
    state.includes,
    state.distinct,
    state.rawSelections,
    state.windows,
    params,
    inheritanceAliases,
  );

  const fromClause = deps.compileFrom(aliasMap, state.cteFrom);

  // Inheritance JOINs come first (before relation JOINs) — they complete the
  // entity's physical table structure for joined inheritance.
  const inheritanceJoinClause = deps.compileInheritanceJoin(
    metadata,
    inheritanceAliases,
    "t0",
  );

  const joinClause = deps.compileJoin(
    state.includes,
    metadata,
    aliasMap,
    params,
    state.versionTimestamp,
  );
  const whereClause = deps.compileWhereWithFilters(
    state,
    metadata,
    params,
    "t0",
    inheritanceAliases,
  );
  const groupByClause = deps.compileGroupBy(state.groupBy, metadata, "t0");
  const havingClause = deps.compileHaving(
    state.having,
    state.rawHaving,
    metadata,
    "t0",
    params,
  );
  // Resolve @DefaultOrder fallback: state.orderBy is null when not explicitly set
  // (QB path), but an empty object {} when explicitly suppressed (find path with order: null).
  const effectiveOrderBy = (state.orderBy ?? metadata.defaultOrder ?? null) as Partial<
    Record<keyof E, "ASC" | "DESC">
  > | null;
  const orderByClause = deps.compileOrderBy(effectiveOrderBy, metadata, "t0");
  const limitOffsetClause = deps.compileLimitOffset(state.skip, state.take, params);

  // When set operations are present, ORDER BY / LIMIT apply to the combined result
  if (state.setOperations.length > 0) {
    const primaryParts = [
      cteClause,
      selectClause,
      fromClause,
      inheritanceJoinClause,
      joinClause,
      whereClause,
      groupByClause,
      havingClause,
    ].filter(Boolean);

    const setOpClause = deps.compileSetOperations(state.setOperations, params);
    const finalParts = [
      primaryParts.join(" "),
      setOpClause,
      orderByClause,
      limitOffsetClause,
    ].filter(Boolean);

    return {
      text: finalParts.join(" "),
      params,
      aliasMap,
    };
  }

  const parts = [
    cteClause,
    selectClause,
    fromClause,
    inheritanceJoinClause,
    joinClause,
    whereClause,
    groupByClause,
    havingClause,
    orderByClause,
    limitOffsetClause,
    lockClause,
  ].filter(Boolean);

  return {
    text: parts.join(" "),
    params,
    aliasMap,
  };
};

export const compileCount = <E extends IEntity>(
  state: QueryState<E>,
  metadata: EntityMetadata,
  dialect: SqlDialect,
  deps: CompileQueryDeps<E>,
  namespace?: string | null,
): CompileQueryResult => {
  const params: Array<unknown> = [];
  const { aliasMap, inheritanceAliases } = deps.buildAliasMap(
    metadata,
    state.includes,
    namespace,
  );

  // When GROUP BY or set operations are present, wrap in a subquery so
  // COUNT(*) returns a single total row count instead of per-group counts.
  const needsSubquery = !!state.groupBy?.length || state.setOperations.length > 0;

  if (needsSubquery) {
    // Compile the full query first (including set ops, GROUP BY, HAVING)
    const inner = compileQuery(state, metadata, dialect, deps, namespace);
    // Push inner params into our params array (they start at $1 already)
    params.push(...inner.params);
    const countAlias = dialect.quoteIdentifier("count");
    const subAlias = dialect.quoteIdentifier("count_sub");
    return {
      text: `SELECT COUNT(*) AS ${countAlias} FROM (${inner.text}) AS ${subAlias}`,
      params,
      aliasMap,
    };
  }

  // CTEs first
  const cteClause = deps.compileCtes(state.ctes, params);

  const fromClause = deps.compileFrom(aliasMap, state.cteFrom);
  const inheritanceJoinClause = deps.compileInheritanceJoin(
    metadata,
    inheritanceAliases,
    "t0",
  );
  const joinClause = deps.compileJoin(
    state.includes,
    metadata,
    aliasMap,
    params,
    state.versionTimestamp,
  );
  const whereClause = deps.compileWhereWithFilters(
    state,
    metadata,
    params,
    "t0",
    inheritanceAliases,
  );

  const needsDistinct = state.distinct || state.includes.length > 0;
  const countExpression = needsDistinct
    ? `COUNT(DISTINCT ${compilePrimaryKeyExpression(metadata, "t0", dialect)})`
    : "COUNT(*)";

  const countAlias = dialect.quoteIdentifier("count");
  const parts = [
    cteClause,
    `SELECT ${countExpression} AS ${countAlias}`,
    fromClause,
    inheritanceJoinClause,
    joinClause,
    whereClause,
  ].filter(Boolean);

  return {
    text: parts.join(" "),
    params,
    aliasMap,
  };
};
