import type { IAmphora } from "@lindorm/amphora";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { applyDiscriminatorColumn } from "../../../../utils/sql/apply-discriminator-column.js";
import {
  type CompileInsertDeps,
  compileInsert as sharedCompileInsert,
  compileInsertBulk as sharedCompileInsertBulk,
} from "../../../../utils/sql/compile-insert.js";
import { postgresDialect } from "../postgres-dialect.js";
import type { CompiledSql } from "./compiled-sql.js";
import { dehydrateEntity } from "./dehydrate-entity.js";

export { applyDiscriminatorColumn };

const deps: CompileInsertDeps = { dehydrateEntity };

export const compileInsert = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  namespace?: string | null,
  amphora?: IAmphora,
): CompiledSql =>
  sharedCompileInsert(entity, metadata, postgresDialect, deps, namespace, amphora);

export const compileInsertBulk = <E extends IEntity>(
  entities: Array<E>,
  metadata: EntityMetadata,
  namespace?: string | null,
  amphora?: IAmphora,
): CompiledSql =>
  sharedCompileInsertBulk(entities, metadata, postgresDialect, deps, namespace, amphora);
