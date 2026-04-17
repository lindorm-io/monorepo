import type { FindCursor, Document } from "mongodb";
import type { IEntity } from "../../../../interfaces";
import type { IProteusCursor } from "../../../../interfaces/ProteusCursor";
import type { EntityMetadata } from "../../../entity/types/metadata";
import { ProteusError } from "../../../../errors";
import { hydrateEntity } from "../utils/hydrate";

/**
 * Server-side cursor wrapping MongoDB's FindCursor.
 *
 * Hydrates documents to entity instances one at a time.
 * Relation loading is NOT supported through the cursor (documented limitation).
 * Cursor entities do NOT get snapshots (same trade-off as Postgres).
 */
export class MongoCursor<E extends IEntity> implements IProteusCursor<E> {
  private readonly cursor: FindCursor<Document>;
  private readonly metadata: EntityMetadata;
  private closed: boolean;
  /** Serialization lock to prevent concurrent access to the underlying MongoDB cursor. */
  private pending: Promise<void>;

  public constructor(cursor: FindCursor<Document>, metadata: EntityMetadata) {
    this.cursor = cursor;
    this.metadata = metadata;
    this.closed = false;
    this.pending = Promise.resolve();
  }

  public async next(): Promise<E | null> {
    return this.serialize(async () => {
      if (this.closed) throw new ProteusError("Cursor is closed");

      const doc = await this.cursor.next();
      if (!doc) return null;

      return hydrateEntity<E>(doc, this.metadata);
    });
  }

  public async nextBatch(size: number = 10): Promise<Array<E>> {
    return this.serialize(async () => {
      if (this.closed) throw new ProteusError("Cursor is closed");

      const results: Array<E> = [];

      for (let i = 0; i < size; i++) {
        const doc = await this.cursor.next();
        if (!doc) break;
        results.push(hydrateEntity<E>(doc, this.metadata));
      }

      return results;
    });
  }

  /**
   * Serialize access to the underlying MongoDB cursor.
   * Concurrent calls to next()/nextBatch() are queued so each
   * completes before the next one starts.
   */
  private async serialize<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.pending;
    let resolve!: () => void;
    this.pending = new Promise<void>((r) => {
      resolve = r;
    });

    await prev;

    try {
      return await fn();
    } catch (error) {
      throw this.wrapError(error);
    } finally {
      resolve();
    }
  }

  private wrapError(error: unknown): ProteusError {
    if (error instanceof ProteusError) return error;
    const message = error instanceof Error ? error.message : String(error);
    return new ProteusError(`MongoDB cursor error: ${message}`, {
      error: error as Error,
    });
  }

  public async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.cursor.close();
  }

  public [Symbol.asyncIterator](): AsyncIterableIterator<E> {
    return {
      next: async (): Promise<IteratorResult<E>> => {
        const item = await this.next();
        if (item === null) return { done: true, value: undefined };
        return { done: false, value: item };
      },
      return: async (): Promise<IteratorResult<E>> => {
        await this.close();
        return { done: true, value: undefined };
      },
      [Symbol.asyncIterator](): AsyncIterableIterator<E> {
        return this;
      },
    };
  }
}
