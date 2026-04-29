import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { QueryState } from "../../../../types/query.js";
import {
  type AggregateType,
  compileAggregate as shared,
} from "../../../../utils/sql/compile-aggregate.js";
import { postgresDialect } from "../postgres-dialect.js";
import { compileCtes } from "./compile-cte.js";
import { compileGroupBy } from "./compile-group-by.js";
import { compileHaving } from "./compile-having.js";
import { compileInheritanceJoin } from "./compile-inheritance-join.js";
import { buildAliasMap, compileFrom } from "./compile-select.js";
import type { CompiledSql } from "./compiled-sql.js";
import { compileWhereWithFilters } from "./compile-system-filters.js";

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
