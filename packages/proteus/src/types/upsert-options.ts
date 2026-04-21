import type { IEntity } from "../interfaces/Entity.js";

/**
 * Configure upsert (INSERT ... ON CONFLICT) behavior.
 */
export type UpsertOptions<E extends IEntity> = {
  /** Fields that define the uniqueness constraint for conflict detection. Defaults to the primary key. */
  conflictOn?: Array<keyof E>;
};
