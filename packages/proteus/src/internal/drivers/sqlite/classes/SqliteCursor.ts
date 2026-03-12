import type { Dict } from "@lindorm/types";
import type { IEntity, IProteusCursor } from "../../../../interfaces";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import type { AliasMap } from "../utils/query/compile-select";
import type { SqliteQueryClient } from "../types/sqlite-query-client";
import { SqliteDriverError } from "../errors/SqliteDriverError";
import { hydrateRows } from "../utils/query/hydrate-result";
import {
  loadEmbeddedListRows,
  loadEmbeddedListRowsBatch,
} from "../utils/repository/embedded-list-ops";

export type SqliteCursorOptions = {
  sql: string;
  params: Array<unknown>;
  metadata: EntityMetadata;
  aliasMap: Array<AliasMap>;
  client: SqliteQueryClient;
  batchSize: number;
  namespace: string | null;
};

export class SqliteCursor<E extends IEntity> implements IProteusCursor<E> {
  private readonly iterator: IterableIterator<Record<string, unknown>>;
  private readonly metadata: EntityMetadata;
  private readonly aliasMap: Array<AliasMap>;
  private readonly client: SqliteQueryClient;
  private readonly batchSize: number;
  private closed = false;
  private reading = false;

  public constructor(options: SqliteCursorOptions) {
    this.iterator = options.client.iterate(options.sql, options.params);
    this.metadata = options.metadata;
    this.aliasMap = options.aliasMap;
    this.client = options.client;
    this.batchSize = options.batchSize;
  }

  public async next(): Promise<E | null> {
    this.guardClosed();
    this.guardReading();
    this.reading = true;

    try {
      const result = this.iterator.next();

      if (result.done) {
        await this.close();
        return null;
      }

      const hydrated = hydrateRows<E>(
        [result.value as Dict],
        this.metadata,
        this.aliasMap,
        [],
        { snapshot: false },
      );
      const entity = hydrated[0] ?? null;
      if (entity) {
        this.loadEmbeddedLists([entity]);
      }
      return entity;
    } catch (err) {
      await this.close();
      throw err;
    } finally {
      this.reading = false;
    }
  }

  public async nextBatch(size?: number): Promise<Array<E>> {
    this.guardClosed();
    this.guardReading();
    this.reading = true;

    try {
      const fetchSize = size ?? this.batchSize;
      const rows: Array<Dict> = [];

      for (let i = 0; i < fetchSize; i++) {
        const result = this.iterator.next();
        if (result.done) break;
        rows.push(result.value as Dict);
      }

      if (rows.length === 0) {
        await this.close();
        return [];
      }

      const entities = hydrateRows<E>(rows, this.metadata, this.aliasMap, [], {
        snapshot: false,
      });
      this.loadEmbeddedLists(entities);
      return entities;
    } catch (err) {
      await this.close();
      throw err;
    } finally {
      this.reading = false;
    }
  }

  public async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    try {
      this.iterator.return?.();
    } catch {
      // Iterator may already be exhausted
    }
  }

  public async *[Symbol.asyncIterator](): AsyncIterableIterator<E> {
    try {
      while (!this.closed) {
        const batch = await this.nextBatch();
        if (batch.length === 0) break;
        for (const entity of batch) {
          yield entity;
        }
      }
    } finally {
      await this.close();
    }
  }

  private guardClosed(): void {
    if (this.closed) {
      throw new SqliteDriverError("Cursor is closed");
    }
  }

  private guardReading(): void {
    if (this.reading) {
      throw new SqliteDriverError("Concurrent cursor reads are not allowed");
    }
  }

  private loadEmbeddedLists(entities: Array<E>): void {
    if (this.metadata.embeddedLists.length === 0 || entities.length === 0) return;
    if (entities.length === 1) {
      for (const el of this.metadata.embeddedLists) {
        loadEmbeddedListRows(entities[0], el, this.client);
      }
    } else {
      for (const el of this.metadata.embeddedLists) {
        loadEmbeddedListRowsBatch(entities, el, this.client);
      }
    }
  }
}
