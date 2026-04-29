import type { Dict } from "@lindorm/types";
import type { IEntity, IProteusCursor } from "../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import type { AliasMap } from "../utils/query/compile-select.js";
import type { MysqlQueryClient } from "../types/mysql-query-client.js";
import { MySqlDriverError } from "../errors/MySqlDriverError.js";
import { hydrateRows } from "../utils/query/hydrate-result.js";
import {
  loadEmbeddedListRows,
  loadEmbeddedListRowsBatch,
} from "../utils/repository/embedded-list-ops.js";
import { installLazyEmbeddedLists } from "../../../entity/utils/install-lazy-embedded-lists.js";

export type MySqlCursorOptions = {
  sql: string;
  params: Array<unknown>;
  metadata: EntityMetadata;
  aliasMap: Array<AliasMap>;
  client: MysqlQueryClient;
  batchSize: number;
  namespace: string | null;
};

/**
 * MySQL cursor implementation using LIMIT/OFFSET pagination.
 *
 * mysql2 does support streaming via `connection.query().stream()`, but that
 * requires holding a dedicated PoolConnection open for the entire cursor
 * lifetime. For simplicity and safety, we use LIMIT/OFFSET batching,
 * which works through the normal pool-managed query client.
 */
export class MySqlCursor<E extends IEntity> implements IProteusCursor<E> {
  private readonly baseSql: string;
  private readonly params: Array<unknown>;
  private readonly metadata: EntityMetadata;
  private readonly aliasMap: Array<AliasMap>;
  private readonly client: MysqlQueryClient;
  private readonly batchSize: number;
  private readonly namespace: string | null;
  private buffer: Array<E> = [];
  private bufferIndex = 0;
  private offset = 0;
  private closed = false;
  private reading = false;
  private exhausted = false;

  public constructor(options: MySqlCursorOptions) {
    this.baseSql = options.sql;
    this.params = options.params;
    this.metadata = options.metadata;
    this.aliasMap = options.aliasMap;
    this.client = options.client;
    this.batchSize = options.batchSize;
    this.namespace = options.namespace;
  }

  public async next(): Promise<E | null> {
    this.guardClosed();
    this.guardReading();
    this.reading = true;

    try {
      if (this.bufferIndex >= this.buffer.length) {
        if (this.exhausted) {
          await this.close();
          return null;
        }
        await this.fetchBatch(this.batchSize);
        if (this.buffer.length === 0) {
          await this.close();
          return null;
        }
      }

      return this.buffer[this.bufferIndex++];
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

      // Drain remaining buffer first
      const result: Array<E> = [];
      while (this.bufferIndex < this.buffer.length && result.length < fetchSize) {
        result.push(this.buffer[this.bufferIndex++]);
      }

      // Fetch more if needed
      while (result.length < fetchSize && !this.exhausted) {
        await this.fetchBatch(fetchSize - result.length);
        while (this.bufferIndex < this.buffer.length && result.length < fetchSize) {
          result.push(this.buffer[this.bufferIndex++]);
        }
      }

      if (result.length === 0) {
        await this.close();
      }

      return result;
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
    this.buffer = [];
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

  private async fetchBatch(size: number): Promise<void> {
    const sql = `${this.baseSql} LIMIT ? OFFSET ?`;
    const batchParams = [...this.params, size, this.offset];

    const { rows } = await this.client.query(sql, batchParams);

    if (rows.length < size) {
      this.exhausted = true;
    }

    this.offset += rows.length;
    const entities = hydrateRows<E>(
      rows as Array<Dict>,
      this.metadata,
      this.aliasMap,
      [],
      { snapshot: false },
    );
    await this.loadEmbeddedLists(entities);
    this.buffer = entities;
    this.bufferIndex = 0;
  }

  private guardClosed(): void {
    if (this.closed) {
      throw new MySqlDriverError("Cursor is closed");
    }
  }

  private guardReading(): void {
    if (this.reading) {
      throw new MySqlDriverError("Concurrent cursor reads are not allowed");
    }
  }

  private async loadEmbeddedLists(entities: Array<E>): Promise<void> {
    if (this.metadata.embeddedLists.length === 0 || entities.length === 0) return;
    if (entities.length === 1) {
      for (const el of this.metadata.embeddedLists) {
        if (el.loading.multiple === "lazy") continue;
        await loadEmbeddedListRows(entities[0], el, this.client, this.namespace);
      }
    } else {
      for (const el of this.metadata.embeddedLists) {
        if (el.loading.multiple === "lazy") continue;
        await loadEmbeddedListRowsBatch(entities, el, this.client, this.namespace);
      }
    }

    for (const entity of entities) {
      installLazyEmbeddedLists(
        entity,
        this.metadata,
        {
          loadEmbeddedList: async (e, el) => {
            await loadEmbeddedListRows(e, el, this.client, this.namespace);
            return (e as any)[el.key] ?? [];
          },
        },
        "multiple",
      );
    }
  }
}
