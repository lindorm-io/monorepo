import type { IAmphora } from "@lindorm/amphora";
import type { DeepPartial, Predicate } from "@lindorm/types";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { compileDeleteExpired as sharedCompileDeleteExpired } from "../../../../utils/sql/compile-delete-expired.js";
import {
  compileRestore as sharedCompileRestore,
  compileSoftDelete as sharedCompileSoftDelete,
} from "../../../../utils/sql/compile-soft-delete.js";
import {
  type CompileUpdateDeps,
  compileUpdate as sharedCompileUpdate,
  compileUpdateMany as sharedCompileUpdateMany,
} from "../../../../utils/sql/compile-update.js";
import { mysqlDialect } from "../mysql-dialect.js";
import { coerceWriteValue } from "./coerce-value.js";
import type { CompiledSql } from "./compiled-sql.js";
import { dehydrateEntity } from "./dehydrate-entity.js";
import { buildJoinedChildContext } from "./joined-child-context.js";
import { quoteChildTableName } from "./quote-child-table-name.js";

const deps: CompileUpdateDeps = {
  dehydrateEntity,
  coerceWriteValue: (value, field) => coerceWriteValue(value, field?.type ?? null),
  buildJoinedChildContext,
  quoteChildTableName,
};

/**
 * MySQL has no RETURNING clause. The executor must follow up with a SELECT-back
 * using compileSelectByPk to retrieve the hydrated row.
 */
export const compileUpdate = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  namespace?: string | null,
  amphora?: IAmphora,
): CompiledSql =>
  sharedCompileUpdate(entity, metadata, mysqlDialect, deps, namespace, amphora);

export const compileUpdateMany = <E extends IEntity>(
  criteria: Predicate<E>,
  update: DeepPartial<E>,
  metadata: EntityMetadata,
  namespace?: string | null,
  amphora?: IAmphora,
): CompiledSql =>
  sharedCompileUpdateMany(
    criteria,
    update,
    metadata,
    mysqlDialect,
    deps,
    namespace,
    amphora,
  );

export const compileSoftDelete = <E extends IEntity>(
  criteria: Predicate<E>,
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledSql => sharedCompileSoftDelete(criteria, metadata, mysqlDialect, namespace);

export const compileRestore = <E extends IEntity>(
  criteria: Predicate<E>,
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledSql => sharedCompileRestore(criteria, metadata, mysqlDialect, namespace);

export const compileDeleteExpired = (
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledSql => sharedCompileDeleteExpired(metadata, mysqlDialect, namespace);
