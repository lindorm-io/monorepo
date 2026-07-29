import type { Condition } from "@lindorm/match";
import type { IAmphora } from "@lindorm/amphora";
import type { DeepPartial } from "@lindorm/types";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import {
  type CompileUpdateDeps,
  compileUpdate as sharedCompileUpdate,
  compileUpdateMany as sharedCompileUpdateMany,
} from "../../../../utils/sql/compile-update.js";
import { postgresDialect } from "../postgres-dialect.js";
import { coerceWriteValue } from "./coerce-value.js";
import type { CompiledSql } from "./compiled-sql.js";
import { dehydrateEntity } from "./dehydrate-entity.js";
import { buildJoinedChildContext } from "./joined-child-context.js";
import { quoteChildTableName } from "./quote-child-table-name.js";

const deps: CompileUpdateDeps = {
  dehydrateEntity,
  coerceWriteValue,
  buildJoinedChildContext,
  quoteChildTableName,
};

export const compileUpdate = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  namespace?: string | null,
  amphora?: IAmphora,
): CompiledSql =>
  sharedCompileUpdate(entity, metadata, postgresDialect, deps, namespace, amphora);

export const compileUpdateMany = <E extends IEntity>(
  criteria: Condition<E>,
  update: DeepPartial<E>,
  metadata: EntityMetadata,
  namespace?: string | null,
  amphora?: IAmphora,
): CompiledSql =>
  sharedCompileUpdateMany(
    criteria,
    update,
    metadata,
    postgresDialect,
    deps,
    namespace,
    amphora,
  );
