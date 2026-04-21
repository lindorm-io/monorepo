import type { Constructor } from "@lindorm/types";
import type { IEntity } from "./Entity.js";
import type { IProteusQueryBuilder } from "./ProteusQueryBuilder.js";
import type { IProteusRepository } from "./ProteusRepository.js";

/**
 * Context passed to transaction callbacks, providing scoped repositories and query builders.
 *
 * All operations performed through this context share the same database transaction.
 * The transaction commits when the callback resolves, or rolls back on error.
 */
export interface ITransactionContext {
  /** Obtain a repository scoped to this transaction. */
  repository<E extends IEntity>(target: Constructor<E>): IProteusRepository<E>;
  /** Obtain a query builder scoped to this transaction. */
  queryBuilder<E extends IEntity>(target: Constructor<E>): IProteusQueryBuilder<E>;
  /** Create a nested savepoint within this transaction. */
  transaction<T>(fn: (ctx: ITransactionContext) => Promise<T>): Promise<T>;
  /** Manually commit the transaction. Normally handled automatically when the callback resolves. */
  commit(): Promise<void>;
  /** Manually rollback the transaction. Normally handled automatically on error. */
  rollback(): Promise<void>;
}
