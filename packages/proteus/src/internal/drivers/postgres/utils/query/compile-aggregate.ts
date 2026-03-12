import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import type { QueryState } from "#internal/types/query";
import {
  type AggregateType,
  compileAggregate as shared,
} from "#internal/utils/sql/compile-aggregate";
import { postgresDialect } from "../postgres-dialect";
import { compileCtes } from "./compile-cte";
import { compileGroupBy } from "./compile-group-by";
import { compileHaving } from "./compile-having";
import { compileInheritanceJoin } from "./compile-inheritance-join";
import { buildAliasMap, compileFrom } from "./compile-select";
import type { CompiledSql } from "./compiled-sql";
import { compileWhereWithFilters } from "./compile-system-filters";

export type { AggregateType };

export const compileAggregate = <E extends IEntity>(
  type: AggregateType,
  field: keyof E,
  state: QueryState<E>,
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledSql =>
  shared(
    type,
    field,
    state,
    metadata,
    postgresDialect,
    {
      buildAliasMap,
      compileFrom,
      compileInheritanceJoin,
      compileWhereWithFilters,
      compileGroupBy,
      compileHaving,
      compileCtes,
    },
    namespace,
  );
