import type { ITransactionContext } from "../interfaces/index.js";

/**
 * Callback executed within a transaction scope.
 *
 * Receives a transaction context providing scoped repositories.
 * Return a value to propagate it as the transaction result.
 * Throw to trigger a rollback.
 */
export type TransactionCallback<T> = (ctx: ITransactionContext) => Promise<T>;
