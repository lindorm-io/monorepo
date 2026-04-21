import type { IEntity } from "../../interfaces/index.js";
import type { IProteusCursor } from "../../interfaces/ProteusCursor.js";
import { ProteusError } from "../../errors/index.js";

export class ArrayCursor<E extends IEntity> implements IProteusCursor<E> {
  private readonly items: Array<E>;
  private position: number;
  private closed: boolean;

  public constructor(items: Array<E>) {
    this.items = items;
    this.position = 0;
    this.closed = false;
  }

  public async next(): Promise<E | null> {
    if (this.closed) throw new ProteusError("Cursor is closed");
    if (this.position >= this.items.length) return null;
    return this.items[this.position++];
  }

  public async nextBatch(size: number = 10): Promise<Array<E>> {
    if (this.closed) throw new ProteusError("Cursor is closed");
    if (this.position >= this.items.length) return [];
    const batch = this.items.slice(this.position, this.position + size);
    this.position += batch.length;
    return batch;
  }

  public async close(): Promise<void> {
    this.closed = true;
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
