import type { IAmphora } from "@lindorm/amphora";
import type { IEntity } from "../../../interfaces/index.js";
import type { EntityMetadata, MetaField } from "../../entity/types/metadata.js";
import type { DehydrateMode } from "../../entity/types/dehydrate-mode.js";

/**
 * Driver-injected dependencies shared by the write-path compilers
 * (compile-insert / compile-update / compile-partial-update / compile-upsert).
 * Mirrors how CompileQueryDeps injects driver specifics into compile-query.
 */

export type DehydratedColumn = {
  column: string;
  value: unknown;
};

/**
 * Driver-specific entity dehydration (type coercion per driver — genuinely
 * divergent, kept per driver).
 */
export type DehydrateEntityFn = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  mode: DehydrateMode,
  amphora?: IAmphora,
) => Array<DehydratedColumn>;

/**
 * Driver-specific write-value coercion. PG inspects the full MetaField
 * (array casts); MySQL/SQLite wrappers adapt to their `(value, fieldType)`
 * signatures.
 */
export type CoerceWriteValueFn = (value: unknown, field: MetaField | null) => unknown;

/**
 * Quotes the child table name of a joined inheritance entity. Kept per driver:
 * PG and MySQL both resolve the entity-level namespace via getEntityName (so a
 * child declaring its own `@Entity({ namespace })` qualifies against the correct
 * database); SQLite has no schemas.
 */
export type QuoteChildTableNameFn = (
  metadata: EntityMetadata,
  namespace?: string | null,
) => string;
