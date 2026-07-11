import type { IAmphora } from "@lindorm/amphora";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import {
  type CompileUpsertDeps,
  type UpsertCompileOptions,
  compileUpsert as sharedCompileUpsert,
} from "../../../../utils/sql/compile-upsert.js";
import { postgresDialect } from "../postgres-dialect.js";
import { quoteIdentifier } from "../quote-identifier.js";
import { resolveColumnName } from "../resolve-column-name.js";
import type { CompiledSql } from "./compiled-sql.js";
import { dehydrateEntity } from "./dehydrate-entity.js";

export type { UpsertCompileOptions };

const deps: CompileUpsertDeps = {
  dehydrateEntity,
  // Conflict target: explicit columns or primary key columns. In both cases the
  // supplied entity-property keys must be resolved to their DB column names.
  resolveConflictColumns: (metadata, conflictColumns) =>
    (conflictColumns ?? metadata.primaryKeys).map((col) =>
      quoteIdentifier(resolveColumnName(metadata.fields, col, metadata.relations)),
    ),
};

export const compileUpsert = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  namespace?: string | null,
  options?: UpsertCompileOptions,
  amphora?: IAmphora,
): CompiledSql =>
  sharedCompileUpsert(
    entity,
    metadata,
    postgresDialect,
    deps,
    namespace,
    options,
    amphora,
  );
