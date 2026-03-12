import type { DeepPartial } from "@lindorm/types";
import type { IEntity } from "./Entity";

/**
 * Result returned by write query builder terminal methods.
 */
export type WriteResult<E extends IEntity> = {
  /** Rows returned by a RETURNING clause (empty if no RETURNING was specified). */
  rows: Array<E>;
  /** Number of rows affected by the operation. */
  rowCount: number;
};

/**
 * Raw SQL INSERT builder — no hooks, no cascades, no version checks.
 * Use `repo.insert()` for the full ORM lifecycle.
 */
export interface IInsertQueryBuilder<E extends IEntity> {
  /** Set the rows to insert. All rows must have identical key sets. */
  values(data: Array<DeepPartial<E>>): this;
  /** Request specific fields (or `"*"`) to be returned from the inserted rows. */
  returning(...fields: Array<keyof E | "*">): this;
  /** Execute the INSERT and return the write result. */
  execute(): Promise<WriteResult<E>>;
}
