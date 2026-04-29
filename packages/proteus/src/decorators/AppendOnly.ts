import { stageAppendOnly } from "../internal/entity/metadata/stage-metadata.js";

/**
 * Mark an entity as append-only.
 *
 * Append-only entities reject UPDATE, DELETE, and TRUNCATE at both the
 * application layer (repository guards) and the database layer (SQL triggers).
 *
 * **Allowed:** `insert`, `insertBulk`, `clone`, `find*`, `count`, `exists`,
 * `aggregate`, `cursor`, `paginate`.
 *
 * **Blocked:** `update`, `destroy`, `softDestroy`, `updateMany`, `softDelete`,
 * `delete`, `upsert`, `clear`, `restore`.
 *
 * For SQL drivers (PostgreSQL, MySQL, SQLite), `setup()` generates BEFORE
 * UPDATE/DELETE triggers that enforce immutability at the database level.
 */
export const AppendOnly =
  () =>
  (_target: Function, context: ClassDecoratorContext): void => {
    stageAppendOnly(context.metadata);
  };
