import type { Predicate } from "@lindorm/types";
import type { IEntity } from "./Entity.js";
import type { WriteResult } from "./InsertQueryBuilder.js";

/**
 * Raw SQL DELETE builder — no hooks, no cascades, no version checks.
 * Use `repo.destroy()` for the full ORM lifecycle.
 */
export interface IDeleteQueryBuilder<E extends IEntity> {
  /** Set the WHERE clause for the delete. **Required** — empty predicates throw. */
  where(criteria: Predicate<E>): this;
  /** Append an AND condition to the WHERE clause. */
  andWhere(criteria: Predicate<E>): this;
  /** Append an OR condition to the WHERE clause. */
  orWhere(criteria: Predicate<E>): this;
  /** Request specific fields (or `"*"`) to be returned from the deleted rows. */
  returning(...fields: Array<keyof E | "*">): this;
  /** Execute the DELETE and return the write result. */
  execute(): Promise<WriteResult<E>>;
}
