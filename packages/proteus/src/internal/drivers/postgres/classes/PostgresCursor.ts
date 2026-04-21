import Cursor from "pg-cursor";
import type { Dict } from "@lindorm/types";
import type { PoolClient } from "pg";
import type { IEntity, IProteusCursor } from "../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import type { AliasMap } from "../utils/query/compile-select.js";
import { PostgresDriverError } from "../errors/PostgresDriverError.js";
import { hydrateRows } from "../utils/query/hydrate-result.js";
import {
  loadEmbeddedListRows,
  loadEmbeddedListRowsBatch,
} from "../utils/repository/embedded-list-ops.js";
import { installLazyEmbeddedLists } from "../../../entity/utils/install-lazy-embedded-lists.js";

export type PostgresCursorOptions = {
  sql: string;
  params: Array<unknown>;
  metadata: EntityMetadata;
  aliasMap: Array<AliasMap>;
  poolClient: PoolClient;
  releaseClient: () => void;
  batchSize: number;
  namespace: string | null;
};

export class PostgresCursor<E extends IEntity> implements IProteusCursor<E> {
  private readonly cursor: Cursor;
  private readonly metadata: EntityMetadata;
  private readonly aliasMap: Array<AliasMap>;
  private readonly releaseClient: () => void;
  private readonly batchSize: number;
  private readonly poolClient: PoolClient;
  private readonly namespace: string | null;
  private closed = false;
  private reading = false;

  public constructor(options: PostgresCursorOptions) {
    this.cursor = options.poolClient.query(new Cursor(options.sql, options.params));
    this.metadata = options.metadata;
    this.aliasMap = options.aliasMap;
    this.releaseClient = options.releaseClient;
    this.batchSize = options.batchSize;
    this.poolClient = options.poolClient;
    this.namespace = options.namespace;
  }

  public async next(): Promise<E | null> {
    this.guardClosed();
    this.guardReading();
    this.reading = true;

    try {
      const rows = await this.cursor.read(1);

      if (rows.length === 0) {
        await this.close();
        return null;
      }

      // Cursor entities do NOT get snapshots (deliberate trade-off)
      const hydrated = hydrateRows<E>(
        rows as Array<Dict>,
        this.metadata,
        this.aliasMap,
        [],
        { snapshot: false },
      );
      const entity = hydrated[0] ?? null;
      if (entity) {
        await this.loadEmbeddedLists([entity]);
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
      const rows = await this.cursor.read(fetchSize);

      if (rows.length === 0) {
        await this.close();
        return [];
      }

      // Cursor entities do NOT get snapshots (deliberate trade-off)
      const entities = hydrateRows<E>(
        rows as Array<Dict>,
        this.metadata,
        this.aliasMap,
        [],
        { snapshot: false },
      );
      await this.loadEmbeddedLists(entities);
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
      await this.cursor.close();
    } catch {
      // Connection may already be broken
    } finally {
      this.releaseClient();
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
      throw new PostgresDriverError("Cursor is closed");
    }
  }

  private guardReading(): void {
    if (this.reading) {
      throw new PostgresDriverError("Concurrent cursor reads are not allowed");
    }
  }

  private async loadEmbeddedLists(entities: Array<E>): Promise<void> {
    if (this.metadata.embeddedLists.length === 0 || entities.length === 0) return;
    const ns = this.metadata.entity.namespace ?? this.namespace;
    // Cursors are always a "multiple" scope — skip fields that are lazy on list queries.
    if (entities.length === 1) {
      for (const el of this.metadata.embeddedLists) {
        if (el.loading.multiple === "lazy") continue;
        await loadEmbeddedListRows(entities[0], el, this.poolClient, ns);
      }
    } else {
      for (const el of this.metadata.embeddedLists) {
        if (el.loading.multiple === "lazy") continue;
        await loadEmbeddedListRowsBatch(entities, el, this.poolClient, ns);
      }
    }

    // Install lazy thenables for fields that were skipped above.
    for (const entity of entities) {
      installLazyEmbeddedLists(
        entity,
        this.metadata,
        {
          loadEmbeddedList: async (e, el) => {
            await loadEmbeddedListRows(e, el, this.poolClient, ns);
            return (e as any)[el.key] ?? [];
          },
        },
        "multiple",
      );
    }
  }
}
