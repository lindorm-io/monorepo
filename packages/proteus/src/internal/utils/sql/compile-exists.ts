import type { Predicate } from "@lindorm/types";
import type { IEntity } from "../../../interfaces";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import { createEmptyState } from "../../../classes/QueryBuilder";
import type { QueryState } from "#internal/types/query";
import type { SqlDialect } from "./sql-dialect";
import type { InheritanceAliasMap } from "./types";

export type CompileExistsDeps = {
  resolveTableName: (
    metadata: EntityMetadata,
    namespace?: string | null,
  ) => { schema: string | null; name: string };
  buildInheritanceAliases: (
    metadata: EntityMetadata,
    namespace: string | null,
    startCounter: number,
  ) => { aliases: Array<InheritanceAliasMap>; nextCounter: number };
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
};

export type CompiledSql = {
  text: string;
  params: Array<unknown>;
};

export const compileExists = <E extends IEntity>(
  criteria: Predicate<E>,
  metadata: EntityMetadata,
  dialect: SqlDialect,
  deps: CompileExistsDeps,
  namespace?: string | null,
): CompiledSql => {
  const resolved = deps.resolveTableName(metadata, namespace);
  const tableName = dialect.quoteQualifiedName(resolved.schema, resolved.name);

  const params: Array<unknown> = [];

  const state = createEmptyState<E>();
  state.predicates = [{ predicate: criteria, conjunction: "and" }];

  const { aliases: inheritanceAliases } = deps.buildInheritanceAliases(
    metadata,
    namespace ?? null,
    1,
  );
  const whereClause = deps.compileWhereWithFilters(
    state,
    metadata,
    params,
    "t0",
    inheritanceAliases,
  );
  const inheritanceJoinClause = deps.compileInheritanceJoin(
    metadata,
    inheritanceAliases,
    "t0",
  );

  const innerParts = [
    `SELECT 1 FROM ${tableName} AS ${dialect.quoteIdentifier("t0")}`,
    inheritanceJoinClause,
    whereClause,
    "LIMIT 1",
  ]
    .filter(Boolean)
    .join(" ");

  const text = `SELECT EXISTS(${innerParts}) AS ${dialect.quoteIdentifier("exists")}`;

  return { text, params };
};
