import type { IAmphora } from "@lindorm/amphora";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import {
  type CompileUpsertDeps,
  type UpsertCompileOptions,
  compileUpsert as sharedCompileUpsert,
} from "../../../../utils/sql/compile-upsert.js";
import { sqliteDialect } from "../sqlite-dialect.js";
import { quoteIdentifier } from "../quote-identifier.js";
import type { CompiledSql } from "./compiled-sql.js";
import { dehydrateEntity } from "./dehydrate-entity.js";

export type { UpsertCompileOptions };

const deps: CompileUpsertDeps = {
  dehydrateEntity,
  // Conflict target: explicit columns (quoted raw) or primary key columns
  resolveConflictColumns: (metadata, conflictColumns) =>
    conflictColumns
      ? conflictColumns.map((col) => quoteIdentifier(col))
      : metadata.primaryKeys.map((pk) => {
          const field = metadata.fields.find((f) => f.key === pk);
          return quoteIdentifier(field?.name ?? pk);
        }),
};

export const compileUpsert = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  namespace?: string | null,
  options?: UpsertCompileOptions,
  amphora?: IAmphora,
): CompiledSql =>
  sharedCompileUpsert(entity, metadata, sqliteDialect, deps, namespace, options, amphora);
