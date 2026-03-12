import type { DeepPartial, Predicate } from "@lindorm/types";
import type { IEntity } from "./Entity";
import type { WriteResult } from "./InsertQueryBuilder";

/**
 * Raw SQL UPDATE builder — no hooks, no cascades, no version checks.
 * Use `repo.update()` for the full ORM lifecycle.
 */
export interface IUpdateQueryBuilder<E extends IEntity> {
  /** Set the columns and values to update. */
  set(data: DeepPartial<E>): this;
  /** Set the WHERE clause for the update. **Required** — empty predicates throw. */
  where(criteria: Predicate<E>): this;
  /** Append an AND condition to the WHERE clause. */
  andWhere(criteria: Predicate<E>): this;
  /** Append an OR condition to the WHERE clause. */
  orWhere(criteria: Predicate<E>): this;
  /** Request specific fields (or `"*"`) to be returned from the updated rows. */
  returning(...fields: Array<keyof E | "*">): this;
  /** Execute the UPDATE and return the write result. */
  execute(): Promise<WriteResult<E>>;
}
