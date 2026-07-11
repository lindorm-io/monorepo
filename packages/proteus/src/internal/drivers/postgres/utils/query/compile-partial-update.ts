import type { IAmphora } from "@lindorm/amphora";
import type { Dict } from "@lindorm/types";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import {
  type CompilePartialUpdateDeps,
  type JoinedPartialUpdateSql,
  compileJoinedPartialUpdate as sharedCompileJoinedPartialUpdate,
  compilePartialUpdate as sharedCompilePartialUpdate,
} from "../../../../utils/sql/compile-partial-update.js";
import { postgresDialect } from "../postgres-dialect.js";
import { coerceWriteValue } from "./coerce-value.js";
import type { CompiledSql } from "./compiled-sql.js";
import { quoteChildTableName } from "./quote-child-table-name.js";

export type { JoinedPartialUpdateSql };

const deps: CompilePartialUpdateDeps = {
  coerceWriteValue,
  quoteChildTableName,
};

export const compilePartialUpdate = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  changed: Dict,
  namespace?: string | null,
  amphora?: IAmphora,
): CompiledSql =>
  sharedCompilePartialUpdate(
    entity,
    metadata,
    changed,
    postgresDialect,
    deps,
    namespace,
    amphora,
  );

export const compileJoinedPartialUpdate = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  changed: Dict,
  namespace?: string | null,
  amphora?: IAmphora,
): JoinedPartialUpdateSql | null =>
  sharedCompileJoinedPartialUpdate(
    entity,
    metadata,
    changed,
    postgresDialect,
    deps,
    namespace,
    amphora,
  );
