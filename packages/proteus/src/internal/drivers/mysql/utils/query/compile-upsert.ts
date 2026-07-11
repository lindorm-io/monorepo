import type { IAmphora } from "@lindorm/amphora";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import {
  type CompileUpsertDeps,
  compileUpsert as sharedCompileUpsert,
} from "../../../../utils/sql/compile-upsert.js";
import { mysqlDialect } from "../mysql-dialect.js";
import type { CompiledSql } from "./compiled-sql.js";
import { dehydrateEntity } from "./dehydrate-entity.js";

const deps: CompileUpsertDeps = {
  dehydrateEntity,
  // ON DUPLICATE KEY UPDATE has no explicit conflict target
  resolveConflictColumns: () => [],
};

/**
 * Compile an upsert for MySQL using INSERT ... AS _new ON DUPLICATE KEY UPDATE.
 *
 * MySQL has no RETURNING clause. The executor must follow up with a SELECT-back
 * using compileSelectByPk to retrieve the hydrated row.
 */
export const compileUpsert = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  namespace?: string | null,
  amphora?: IAmphora,
): CompiledSql =>
  sharedCompileUpsert(
    entity,
    metadata,
    mysqlDialect,
    deps,
    namespace,
    undefined,
    amphora,
  );
