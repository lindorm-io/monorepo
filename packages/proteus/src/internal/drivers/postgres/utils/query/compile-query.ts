import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { QueryState } from "../../../../types/query.js";
import {
  type CompileQueryResult,
  compileCount as sharedCompileCount,
  compileQuery as sharedCompileQuery,
} from "../../../../utils/sql/compile-query.js";
import type { AliasMap } from "../../../../utils/sql/types.js";
import { postgresDialect } from "../postgres-dialect.js";
import { compileCtes } from "./compile-cte.js";
import { compileGroupBy } from "./compile-group-by.js";
import { compileHaving } from "./compile-having.js";
import { compileInheritanceJoin } from "./compile-inheritance-join.js";
import { compileJoin } from "./compile-join.js";
import { compileLimitOffset } from "./compile-limit-offset.js";
import { compileOrderBy } from "./compile-order-by.js";
import { buildAliasMap, compileFrom, compileSelect } from "./compile-select.js";
import { compileSetOperations } from "./compile-set-operation.js";
import { compileWhereWithFilters } from "./compile-system-filters.js";

export type CompiledQuery = CompileQueryResult;
export type { AliasMap };

const deps = {
  buildAliasMap,
  compileSelect,
  compileFrom,
  compileCtes,
  compileInheritanceJoin,
  compileJoin,
  compileWhereWithFilters,
  compileGroupBy,
  compileHaving,
  compileOrderBy,
  compileLimitOffset,
  compileSetOperations,
};

export const compileQuery = <E extends IEntity>(
  state: QueryState<E>,
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledQuery => sharedCompileQuery(state, metadata, postgresDialect, deps, namespace);

export const compileCount = <E extends IEntity>(
  state: QueryState<E>,
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledQuery => sharedCompileCount(state, metadata, postgresDialect, deps, namespace);
