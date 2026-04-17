import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "../../../../entity/types/metadata";
import type { QueryState } from "../../../../types/query";
import {
  type CompileQueryResult,
  compileCount as sharedCompileCount,
  compileQuery as sharedCompileQuery,
} from "../../../../utils/sql/compile-query";
import type { AliasMap } from "../../../../utils/sql/types";
import { postgresDialect } from "../postgres-dialect";
import { compileCtes } from "./compile-cte";
import { compileGroupBy } from "./compile-group-by";
import { compileHaving } from "./compile-having";
import { compileInheritanceJoin } from "./compile-inheritance-join";
import { compileJoin } from "./compile-join";
import { compileLimitOffset } from "./compile-limit-offset";
import { compileOrderBy } from "./compile-order-by";
import { buildAliasMap, compileFrom, compileSelect } from "./compile-select";
import { compileSetOperations } from "./compile-set-operation";
import { compileWhereWithFilters } from "./compile-system-filters";

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
