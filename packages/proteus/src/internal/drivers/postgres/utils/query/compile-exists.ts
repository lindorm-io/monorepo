import type { Predicate } from "@lindorm/types";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { compileExists as shared } from "../../../../utils/sql/compile-exists.js";
import { postgresDialect } from "../postgres-dialect.js";
import {
  buildInheritanceAliases,
  compileInheritanceJoin,
} from "./compile-inheritance-join.js";
import { compileWhereWithFilters } from "./compile-system-filters.js";
import { resolveTableName } from "./resolve-table-name.js";
import type { CompiledSql } from "./compiled-sql.js";

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
