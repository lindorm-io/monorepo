import { ProteusError } from "../../../errors/index.js";
import type { IEntity } from "../../../interfaces/index.js";
import type { EntityMetadata } from "../../entity/types/metadata.js";
import type { PredicateEntry, QueryState, RawWhereEntry } from "../../types/query.js";
import { resolveColumnName } from "./resolve-column-name.js";
import type { SqlDialect } from "./sql-dialect.js";
import type { AliasMap, InheritanceAliasMap } from "./types.js";

export type AggregateType = "SUM" | "AVG" | "MIN" | "MAX";

export type CompileAggregateDeps = {
  buildAliasMap: (
    rootMetadata: EntityMetadata,
    includes: Array<never>,
    defaultNamespace?: string | null,
  ) => { aliasMap: Array<AliasMap>; inheritanceAliases: Array<InheritanceAliasMap> };
  compileFrom: (aliasMap: Array<AliasMap>, cteFrom?: string | null) => string;
  compileInheritanceJoin: (
    metadata: EntityMetadata,
    inheritanceAliases: Array<InheritanceAliasMap>,
    rootAlias: string,
  ) => string;
  compileWhereWithFilters: <E extends IEntity>(
    state: QueryState<E>,
    metadata: EntityMetadata,
    params: Array<unknown>,
    tableAlias: string,
    inheritanceAliases?: Array<InheritanceAliasMap>,
  ) => string;
  compileGroupBy: <E extends IEntity>(
    groupBy: Array<keyof E> | null,
    metadata: EntityMetadata,
    tableAlias: string,
  ) => string;
  compileHaving: <E extends IEntity>(
    entries: Array<PredicateEntry<E>>,
    rawEntries: Array<RawWhereEntry>,
    metadata: EntityMetadata,
    tableAlias: string,
    params: Array<unknown>,
  ) => string;
  compileCtes: (
    ctes: Array<import("../../types/query").CteSpec>,
    globalParams: Array<unknown>,
  ) => string;
};

export type CompiledSql = {
  text: string;
  params: Array<unknown>;
};

export const compileAggregate = <E extends IEntity>(
  type: AggregateType,
  field: keyof E,
  state: QueryState<E>,
  metadata: EntityMetadata,
  dialect: SqlDialect,
  deps: CompileAggregateDeps,
  namespace?: string | null,
): CompiledSql => {
  if (state.groupBy?.length) {
    throw new ProteusError(
      "compileAggregate() cannot be used with groupBy — use the QueryBuilder with .select() and .groupBy() instead",
    );
  }

  const params: Array<unknown> = [];
  const { aliasMap, inheritanceAliases } = deps.buildAliasMap(metadata, [], namespace);
  const colName = resolveColumnName(metadata.fields, field as string);
  const qualifiedCol = `${dialect.quoteIdentifier("t0")}.${dialect.quoteIdentifier(colName)}`;

  const cteClause = deps.compileCtes(state.ctes, params);

  const selectClause = `SELECT ${type}(${qualifiedCol}) AS ${dialect.quoteIdentifier("result")}`;
  const fromClause = deps.compileFrom(aliasMap, state.cteFrom);
  const inheritanceJoinClause = deps.compileInheritanceJoin(
    metadata,
    inheritanceAliases,
    "t0",
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

  const parts = [
    cteClause,
    selectClause,
    fromClause,
    inheritanceJoinClause,
    whereClause,
    groupByClause,
    havingClause,
  ].filter(Boolean);

  return { text: parts.join(" "), params };
};
