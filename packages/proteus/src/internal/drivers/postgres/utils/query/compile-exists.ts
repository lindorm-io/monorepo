import type { Predicate } from "@lindorm/types";
import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import { compileExists as shared } from "#internal/utils/sql/compile-exists";
import { postgresDialect } from "../postgres-dialect";
import {
  buildInheritanceAliases,
  compileInheritanceJoin,
} from "./compile-inheritance-join";
import { compileWhereWithFilters } from "./compile-system-filters";
import { resolveTableName } from "./resolve-table-name";
import type { CompiledSql } from "./compiled-sql";

export const compileExists = <E extends IEntity>(
  criteria: Predicate<E>,
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledSql =>
  shared(
    criteria,
    metadata,
    postgresDialect,
    {
      resolveTableName,
      buildInheritanceAliases,
      compileInheritanceJoin,
      compileWhereWithFilters,
    },
    namespace,
  );
