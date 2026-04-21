import type { PoolClient } from "pg";
import { makeField } from "../../../__fixtures__/make-field.js";
import type { EntityMetadata, MetaEmbeddedList } from "../../../entity/types/metadata.js";
import type { AliasMap } from "../utils/query/compile-select.js";
import { PostgresCursor, type PostgresCursorOptions } from "./PostgresCursor.js";
import { PostgresDriverError } from "../errors/PostgresDriverError.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

// Mock loadEmbeddedListRows so C2 tests can verify it is called without real DB queries
vi.mock("../utils/repository/embedded-list-ops.js", async () => ({
  loadEmbeddedListRows: vi.fn().mockResolvedValue(undefined),
  loadEmbeddedListRowsBatch: vi.fn().mockResolvedValue(undefined),
}));

import {
  loadEmbeddedListRows,
  loadEmbeddedListRowsBatch,
} from "../utils/repository/embedded-list-ops.js";

// ─── Metadata Fixture ─────────────────────────────────────────────────────────

class ItemEntity {
  id: string = "";
  name: string = "";
  count: number = 0;
}

const metadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "items",
    namespace: null,
  },
  target: ItemEntity,
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("count", { type: "integer", name: "count" }),
  ],
  relations: [],
  primaryKeys: ["id"],
  generated: [],
  hooks: [],
  embeddedLists: [],
} as unknown as EntityMetadata;

const aliasMap: Array<AliasMap> = [
  { tableAlias: "t0", schema: null, tableName: "items", relationKey: null, metadata },
];

// ─── Metadata Fixture with EmbeddedLists ──────────────────────────────────────

class ItemWithTagsEntity {
  id: string = "";
  name: string = "";
  tags: string[] = [];
}

const embeddedListSpec: MetaEmbeddedList = {
  key: "tags",
  tableName: "item_tags",
  parentFkColumn: "item_entity_id",
  parentPkColumn: "id",
  elementType: "string",
  elementFields: null,
  elementConstructor: null,
  loading: { single: "eager", multiple: "eager" },
};

const metadataWithEmbeddedLists = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "items",
    namespace: null,
  },
  target: ItemWithTagsEntity,
  fields: [makeField("id", { type: "uuid" }), makeField("name", { type: "string" })],
  relations: [],
  primaryKeys: ["id"],
  generated: [],
  hooks: [],
  embeddedLists: [embeddedListSpec],
} as unknown as EntityMetadata;

const aliasMapWithTags: Array<AliasMap> = [
  {
    tableAlias: "t0",
    schema: null,
    tableName: "items",
    relationKey: null,
    metadata: metadataWithEmbeddedLists,
  },
];

// ─── Mock Helpers ─────────────────────────────────────────────────────────────

// Rows use aliased column names (t0_<key>) to match hydrateRows expectations
const makeRow = (id: string, name: string, count: number) => ({
  t0_id: id,
  t0_name: name,
  t0_count: count,
});

type MockCursorInstance = {
  read: Mock;
  close: Mock;
};

const createMockCursorInstance = (): MockCursorInstance => ({
  read: vi.fn().mockResolvedValue([]),
  close: vi.fn().mockResolvedValue(undefined),
});

const createMockPoolClient = (cursorInstance: MockCursorInstance) => {
  const poolClient = {
    query: vi.fn().mockReturnValue(cursorInstance),
  } as unknown as PoolClient;
  return poolClient;
};

const createCursor = (
  overrides: Partial<PostgresCursorOptions> = {},
  cursorInstance?: MockCursorInstance,
): {
  cursor: PostgresCursor<any>;
  mockCursor: MockCursorInstance;
  releaseClient: Mock;
  poolClient: PoolClient;
} => {
  const mockCursor = cursorInstance ?? createMockCursorInstance();
  const poolClient = createMockPoolClient(mockCursor);
  const releaseClient = vi.fn();

  const cursor = new PostgresCursor({
    sql: "SELECT * FROM items WHERE active = $1",
    params: [true],
    metadata,
    aliasMap,
    poolClient,
    releaseClient,
    batchSize: 10,
    namespace: null,
    ...overrides,
  });

  return { cursor, mockCursor, releaseClient, poolClient };
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PostgresCursor", () => {
  describe("constructor", () => {
    test("submits a pg-cursor query to the pool client", () => {
      const { poolClient } = createCursor();

      expect(poolClient.query as Mock).toHaveBeenCalledTimes(1);
      // The argument should be a Cursor instance from pg-cursor
      const arg = (poolClient.query as Mock).mock.calls[0][0];
      expect(arg).toBeDefined();
      expect(arg.constructor.name).toBe("Cursor");
    });
  });

  describe("next()", () => {
    test("calls cursor.read(1)", async () => {
      const { cursor, mockCursor } = createCursor();
      mockCursor.read.mockResolvedValueOnce([makeRow("id-1", "alpha", 5)]);

      await cursor.next();

      expect(mockCursor.read).toHaveBeenCalledWith(1);
    });

    test("returns hydrated entity from first row when rows present", async () => {
      const row = makeRow("uuid-abc", "widget", 42);
      const { cursor, mockCursor } = createCursor();
      mockCursor.read.mockResolvedValueOnce([row]);

      const entity = await cursor.next();

      expect(entity).toMatchSnapshot();
    });

    test("returns null when result has no rows", async () => {
      const { cursor, mockCursor } = createCursor();
      mockCursor.read.mockResolvedValueOnce([]);

      const entity = await cursor.next();

      expect(entity).toBeNull();
    });

    test("auto-closes the cursor when no rows are returned", async () => {
      const { cursor, mockCursor, releaseClient } = createCursor();
      mockCursor.read.mockResolvedValueOnce([]);

      await cursor.next();

      expect(mockCursor.close).toHaveBeenCalledTimes(1);
      expect(releaseClient).toHaveBeenCalledTimes(1);
    });

    test("does not auto-close when rows are returned", async () => {
      const { cursor, mockCursor, releaseClient } = createCursor();
      mockCursor.read.mockResolvedValueOnce([makeRow("id-1", "alpha", 1)]);

      await cursor.next();

      expect(mockCursor.close).not.toHaveBeenCalled();
      expect(releaseClient).not.toHaveBeenCalled();
    });

    test("throws 'Cursor is closed' after cursor is closed", async () => {
      const { cursor } = createCursor();
      await cursor.close();

      await expect(cursor.next()).rejects.toThrow("Cursor is closed");
    });

    test("releases client when cursor.read() throws", async () => {
      const { cursor, mockCursor, releaseClient } = createCursor();
      mockCursor.read.mockRejectedValueOnce(new Error("connection lost"));

      await expect(cursor.next()).rejects.toThrow("connection lost");
      expect(releaseClient).toHaveBeenCalledTimes(1);
    });
  });

  describe("nextBatch()", () => {
    test("calls cursor.read with the explicit size argument", async () => {
      const { cursor, mockCursor } = createCursor();
      mockCursor.read.mockResolvedValueOnce([
        makeRow("id-1", "a", 1),
        makeRow("id-2", "b", 2),
      ]);

      await cursor.nextBatch(5);

      expect(mockCursor.read).toHaveBeenCalledWith(5);
    });

    test("uses instance batchSize when no size argument is provided", async () => {
      const { cursor, mockCursor } = createCursor({ batchSize: 25 });
      mockCursor.read.mockResolvedValueOnce([makeRow("id-1", "a", 1)]);

      await cursor.nextBatch();

      expect(mockCursor.read).toHaveBeenCalledWith(25);
    });

    test("returns array of hydrated entities", async () => {
      const rows = [
        makeRow("id-1", "alpha", 1),
        makeRow("id-2", "beta", 2),
        makeRow("id-3", "gamma", 3),
      ];
      const { cursor, mockCursor } = createCursor();
      mockCursor.read.mockResolvedValueOnce(rows);

      const batch = await cursor.nextBatch(3);

      expect(batch).toMatchSnapshot();
      expect(batch).toHaveLength(3);
    });

    test("returns empty array when no rows are returned", async () => {
      const { cursor, mockCursor } = createCursor();
      mockCursor.read.mockResolvedValueOnce([]);

      const batch = await cursor.nextBatch(10);

      expect(batch).toMatchSnapshot();
    });

    test("auto-closes when no rows are returned", async () => {
      const { cursor, mockCursor, releaseClient } = createCursor();
      mockCursor.read.mockResolvedValueOnce([]);

      await cursor.nextBatch(10);

      expect(mockCursor.close).toHaveBeenCalledTimes(1);
      expect(releaseClient).toHaveBeenCalledTimes(1);
    });

    test("does not auto-close when rows are returned", async () => {
      const { cursor, mockCursor, releaseClient } = createCursor();
      mockCursor.read.mockResolvedValueOnce([makeRow("id-1", "a", 1)]);

      await cursor.nextBatch(10);

      expect(mockCursor.close).not.toHaveBeenCalled();
      expect(releaseClient).not.toHaveBeenCalled();
    });

    test("throws 'Cursor is closed' after cursor is closed", async () => {
      const { cursor } = createCursor();
      await cursor.close();

      await expect(cursor.nextBatch()).rejects.toThrow("Cursor is closed");
    });

    test("releases client when cursor.read() throws", async () => {
      const { cursor, mockCursor, releaseClient } = createCursor();
      mockCursor.read.mockRejectedValueOnce(new Error("connection lost"));

      await expect(cursor.nextBatch()).rejects.toThrow("connection lost");
      expect(releaseClient).toHaveBeenCalledTimes(1);
    });
  });

  describe("close()", () => {
    test("calls cursor.close() on the pg-cursor instance", async () => {
      const { cursor, mockCursor } = createCursor();

      await cursor.close();

      expect(mockCursor.close).toHaveBeenCalledTimes(1);
    });

    test("releases the client after closing", async () => {
      const { cursor, releaseClient } = createCursor();

      await cursor.close();

      expect(releaseClient).toHaveBeenCalledTimes(1);
    });

    test("is idempotent — second call is a no-op", async () => {
      const { cursor, mockCursor, releaseClient } = createCursor();

      await cursor.close();
      await cursor.close();

      expect(mockCursor.close).toHaveBeenCalledTimes(1);
      expect(releaseClient).toHaveBeenCalledTimes(1);
    });

    test("releases client even when cursor.close() throws", async () => {
      const { cursor, mockCursor, releaseClient } = createCursor();
      mockCursor.close.mockRejectedValueOnce(new Error("close failed"));

      await cursor.close();

      expect(releaseClient).toHaveBeenCalledTimes(1);
    });
  });

  describe("[Symbol.asyncIterator]()", () => {
    test("yields all entities across multiple batches", async () => {
      const mockCursor = createMockCursorInstance();
      mockCursor.read
        .mockResolvedValueOnce([makeRow("id-1", "a", 1), makeRow("id-2", "b", 2)])
        .mockResolvedValueOnce([makeRow("id-3", "c", 3)])
        .mockResolvedValueOnce([]);

      const { cursor } = createCursor({ batchSize: 2 }, mockCursor);

      const collected: any[] = [];
      for await (const entity of cursor) {
        collected.push(entity);
      }

      expect(collected).toHaveLength(3);
      expect(collected).toMatchSnapshot();
    });

    test("auto-closes after all rows are exhausted", async () => {
      const mockCursor = createMockCursorInstance();
      mockCursor.read
        .mockResolvedValueOnce([makeRow("id-1", "a", 1)])
        .mockResolvedValueOnce([]);

      const { cursor, releaseClient } = createCursor({ batchSize: 5 }, mockCursor);

      const collected: any[] = [];
      for await (const entity of cursor) {
        collected.push(entity);
      }

      expect(collected).toHaveLength(1);
      expect(releaseClient).toHaveBeenCalledTimes(1);
    });

    test("auto-closes on early break (C11)", async () => {
      const mockCursor = createMockCursorInstance();
      mockCursor.read.mockResolvedValue([
        makeRow("id-1", "a", 1),
        makeRow("id-2", "b", 2),
      ]);

      const { cursor, releaseClient } = createCursor({ batchSize: 5 }, mockCursor);

      let count = 0;
      for await (const _entity of cursor) {
        count++;
        if (count === 1) break;
      }

      expect(count).toBe(1);
      expect(releaseClient).toHaveBeenCalledTimes(1);
    });

    test("matches snapshot for single-batch iteration", async () => {
      const mockCursor = createMockCursorInstance();
      const rows = [makeRow("a1", "alpha", 10), makeRow("a2", "beta", 20)];
      mockCursor.read.mockResolvedValueOnce(rows).mockResolvedValueOnce([]);

      const { cursor } = createCursor({ batchSize: 10 }, mockCursor);

      const collected: any[] = [];
      for await (const entity of cursor) {
        collected.push(entity);
      }

      expect(collected).toMatchSnapshot();
    });

    test("releases client when cursor.read() throws during iteration", async () => {
      const mockCursor = createMockCursorInstance();
      mockCursor.read
        .mockResolvedValueOnce([makeRow("id-1", "a", 1)])
        .mockRejectedValueOnce(new Error("network error"));

      const { cursor, releaseClient } = createCursor({ batchSize: 2 }, mockCursor);

      await expect(async () => {
        for await (const _entity of cursor) {
          /* consume */
        }
      }).rejects.toThrow("network error");

      expect(releaseClient).toHaveBeenCalledTimes(1);
    });
  });

  describe("guardClosed()", () => {
    test("next() throws 'Cursor is closed' when called after explicit close", async () => {
      const { cursor } = createCursor();
      await cursor.close();

      await expect(cursor.next()).rejects.toThrow("Cursor is closed");
    });

    test("nextBatch() throws 'Cursor is closed' when called after auto-close from empty result", async () => {
      const { cursor, mockCursor } = createCursor();
      mockCursor.read.mockResolvedValueOnce([]);

      await cursor.next(); // empty → auto-closes

      await expect(cursor.nextBatch()).rejects.toThrow("Cursor is closed");
    });

    test("next() and nextBatch() throw 'Cursor is closed' after close", async () => {
      const { cursor } = createCursor();
      await cursor.close();

      await expect(cursor.next()).rejects.toThrow("Cursor is closed");
      await expect(cursor.nextBatch()).rejects.toThrow("Cursor is closed");
    });

    test("throws a PostgresDriverError, not a plain Error", async () => {
      const { cursor } = createCursor();
      await cursor.close();

      await expect(cursor.next()).rejects.toBeInstanceOf(PostgresDriverError);
    });
  });

  describe("concurrency guard", () => {
    test("throws when next() is called while another read is in progress", async () => {
      const mockCursor = createMockCursorInstance();
      mockCursor.read.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve([makeRow("id-1", "a", 1)]), 50),
          ),
      );

      const { cursor } = createCursor({}, mockCursor);

      const [result1, result2] = await Promise.allSettled([cursor.next(), cursor.next()]);

      const rejected = [result1, result2].find((r) => r.status === "rejected");
      expect(rejected).toBeDefined();
      expect((rejected as PromiseRejectedResult).reason.message).toContain(
        "Concurrent cursor reads",
      );
    });
  });
});

// ─── C2: PostgresCursor loads @EmbeddedList data ──────────────────────────────

const makeTagRow = (id: string, name: string) => ({ t0_id: id, t0_name: name });

const createEmbeddedListCursor = (
  overrides: Partial<PostgresCursorOptions> = {},
  cursorInstance?: MockCursorInstance,
): {
  cursor: PostgresCursor<any>;
  mockCursor: MockCursorInstance;
  releaseClient: Mock;
  poolClient: PoolClient;
} => {
  const mockCursor = cursorInstance ?? createMockCursorInstance();
  const poolClient = createMockPoolClient(mockCursor);
  const releaseClient = vi.fn();

  const cursor = new PostgresCursor({
    sql: "SELECT * FROM items",
    params: [],
    metadata: metadataWithEmbeddedLists,
    aliasMap: aliasMapWithTags,
    poolClient,
    releaseClient,
    batchSize: 10,
    namespace: null,
    ...overrides,
  });

  return { cursor, mockCursor, releaseClient, poolClient };
};

describe("PostgresCursor — embedded list loading (C2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (loadEmbeddedListRows as Mock).mockResolvedValue(undefined);
    (loadEmbeddedListRowsBatch as Mock).mockResolvedValue(undefined);
  });

  describe("next() calls loadEmbeddedListRows", () => {
    test("calls loadEmbeddedListRows once for each embedded list when a row is returned", async () => {
      const { cursor, mockCursor, poolClient } = createEmbeddedListCursor();
      mockCursor.read.mockResolvedValueOnce([makeTagRow("id-1", "alpha")]);

      await cursor.next();

      expect(loadEmbeddedListRows).toHaveBeenCalledTimes(1);
      expect(loadEmbeddedListRows).toHaveBeenCalledWith(
        expect.objectContaining({ id: "id-1" }),
        embeddedListSpec,
        poolClient,
        null,
      );
    });

    test("does not call loadEmbeddedListRows when no rows are returned", async () => {
      const { cursor, mockCursor } = createEmbeddedListCursor();
      mockCursor.read.mockResolvedValueOnce([]);

      await cursor.next();

      expect(loadEmbeddedListRows).not.toHaveBeenCalled();
    });

    test("short-circuits when metadata.embeddedLists is empty", async () => {
      // Use default metadata (embeddedLists: []) — loadEmbeddedListRows must not be called
      const { cursor, mockCursor } = createCursor();
      mockCursor.read.mockResolvedValueOnce([makeRow("id-1", "test", 5)]);

      await cursor.next();

      expect(loadEmbeddedListRows).not.toHaveBeenCalled();
    });

    test("uses metadata.entity.namespace in preference to cursor namespace option", async () => {
      // When entity.namespace is set, loadEmbeddedLists passes it instead of the cursor namespace
      const nsMetadata = {
        ...metadataWithEmbeddedLists,
        entity: { ...metadataWithEmbeddedLists.entity, namespace: "entity_ns" },
      } as unknown as EntityMetadata;
      const nsAliasMap: Array<AliasMap> = [
        {
          tableAlias: "t0",
          schema: null,
          tableName: "items",
          relationKey: null,
          metadata: nsMetadata,
        },
      ];
      const { cursor, mockCursor, poolClient } = createEmbeddedListCursor({
        metadata: nsMetadata,
        aliasMap: nsAliasMap,
        namespace: "cursor_ns",
      });
      mockCursor.read.mockResolvedValueOnce([makeTagRow("id-1", "alpha")]);

      await cursor.next();

      // entity.namespace ("entity_ns") should take precedence over cursor namespace ("cursor_ns")
      expect(loadEmbeddedListRows).toHaveBeenCalledWith(
        expect.anything(),
        embeddedListSpec,
        poolClient,
        "entity_ns",
      );
    });
  });

  describe("nextBatch() calls loadEmbeddedListRowsBatch", () => {
    test("calls loadEmbeddedListRowsBatch once per embedded list for the batch", async () => {
      const { cursor, mockCursor, poolClient } = createEmbeddedListCursor();
      mockCursor.read.mockResolvedValueOnce([
        makeTagRow("id-1", "alpha"),
        makeTagRow("id-2", "beta"),
        makeTagRow("id-3", "gamma"),
      ]);

      await cursor.nextBatch(3);

      // One call per embedded list (batch function handles all entities at once)
      expect(loadEmbeddedListRowsBatch).toHaveBeenCalledTimes(1);
      expect(loadEmbeddedListRowsBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: "id-1" }),
          expect.objectContaining({ id: "id-2" }),
          expect.objectContaining({ id: "id-3" }),
        ]),
        embeddedListSpec,
        poolClient,
        null,
      );
      expect(loadEmbeddedListRows).not.toHaveBeenCalled();
    });

    test("does not call loadEmbeddedListRowsBatch when no rows are returned in batch", async () => {
      const { cursor, mockCursor } = createEmbeddedListCursor();
      mockCursor.read.mockResolvedValueOnce([]);

      await cursor.nextBatch(10);

      expect(loadEmbeddedListRowsBatch).not.toHaveBeenCalled();
      expect(loadEmbeddedListRows).not.toHaveBeenCalled();
    });

    test("short-circuits when metadata.embeddedLists is empty for batch", async () => {
      const { cursor, mockCursor } = createCursor();
      mockCursor.read.mockResolvedValueOnce([
        makeRow("id-1", "a", 1),
        makeRow("id-2", "b", 2),
      ]);

      await cursor.nextBatch(2);

      expect(loadEmbeddedListRowsBatch).not.toHaveBeenCalled();
      expect(loadEmbeddedListRows).not.toHaveBeenCalled();
    });

    test("calls loadEmbeddedListRowsBatch once per embedded list for multi-list entities", async () => {
      // Verify 2 embedded lists × 1 batch call each = 2 calls total
      const twoListMetadata = {
        ...metadataWithEmbeddedLists,
        embeddedLists: [
          embeddedListSpec,
          { ...embeddedListSpec, key: "scores", tableName: "item_scores" },
        ],
      } as unknown as EntityMetadata;
      const twoListAliasMap: Array<AliasMap> = [
        {
          tableAlias: "t0",
          schema: null,
          tableName: "items",
          relationKey: null,
          metadata: twoListMetadata,
        },
      ];
      const { cursor, mockCursor } = createEmbeddedListCursor({
        metadata: twoListMetadata,
        aliasMap: twoListAliasMap,
      });
      mockCursor.read.mockResolvedValueOnce([
        makeTagRow("id-1", "alpha"),
        makeTagRow("id-2", "beta"),
      ]);

      await cursor.nextBatch(2);

      expect(loadEmbeddedListRowsBatch).toHaveBeenCalledTimes(2);
      expect(loadEmbeddedListRows).not.toHaveBeenCalled();
    });
  });

  describe("error handling — client released on loadEmbeddedListRows failure", () => {
    test("releases client if loadEmbeddedListRows throws during next()", async () => {
      (loadEmbeddedListRows as Mock).mockRejectedValueOnce(new Error("table missing"));
      const { cursor, mockCursor, releaseClient } = createEmbeddedListCursor();
      mockCursor.read.mockResolvedValueOnce([makeTagRow("id-1", "alpha")]);

      await expect(cursor.next()).rejects.toThrow("table missing");
      expect(releaseClient).toHaveBeenCalledTimes(1);
    });
  });
});
