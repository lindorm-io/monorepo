import type { IEntity } from "./Entity";

/**
 * Server-side cursor for streaming large result sets without loading them all into memory.
 *
 * Obtained via `repository.cursor()`. Supports both manual iteration and `for await...of`.
 */
export interface IProteusCursor<E extends IEntity> {
  /** Fetch the next entity from the cursor, or `null` when exhausted. */
  next(): Promise<E | null>;
  /** Fetch the next batch of entities. Returns fewer than `size` when nearing the end. */
  nextBatch(size?: number): Promise<Array<E>>;
  /** Close the cursor and release server-side resources. */
  close(): Promise<void>;
  /** Async iterator protocol — enables `for await (const entity of cursor)`. */
  [Symbol.asyncIterator](): AsyncIterableIterator<E>;
}
