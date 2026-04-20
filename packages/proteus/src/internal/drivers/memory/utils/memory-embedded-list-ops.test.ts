import { describe, expect, test } from "vitest";
import type { MetaEmbeddedList } from "../../../entity/types/metadata";
import type { MemoryStore } from "../types/memory-store";
import {
  deleteMemoryEmbeddedListRows,
  loadMemoryEmbeddedListRows,
  saveMemoryEmbeddedListRows,
} from "./memory-embedded-list-ops";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeStore = (): MemoryStore => ({
  tables: new Map(),
  joinTables: new Map(),
  collectionTables: new Map(),
  incrementCounters: new Map(),
});

const makePrimitiveEmbeddedList = (
  overrides?: Partial<MetaEmbeddedList>,
): MetaEmbeddedList =>
  ({
    key: "tags",
    tableName: "entity_tags",
    parentPkColumn: "id",
    parentFkColumn: "entity_id",
    elementFields: null,
    elementConstructor: null,
    elementType: "string",
    ...overrides,
  }) as unknown as MetaEmbeddedList;

const makeEntity = (overrides?: Record<string, unknown>) => ({
  id: "entity-1",
  tags: ["alpha", "beta", "gamma"],
  ...overrides,
});

// ─── saveMemoryEmbeddedListRows ───────────────────────────────────────────────

describe("saveMemoryEmbeddedListRows", () => {
  describe("primitive elements", () => {
    test("persists rows for each element with parentFkColumn", () => {
      const store = makeStore();
      const embeddedList = makePrimitiveEmbeddedList();
      const entity = makeEntity();

      saveMemoryEmbeddedListRows(entity as any, embeddedList, store, null);

      const table = store.collectionTables.get("entity_tags");
      expect(table?.get("entity-1")).toMatchSnapshot();
    });

    test("creates collection table on first use", () => {
      const store = makeStore();
      const embeddedList = makePrimitiveEmbeddedList();
      const entity = makeEntity();

      expect(store.collectionTables.size).toBe(0);
      saveMemoryEmbeddedListRows(entity as any, embeddedList, store, null);
      expect(store.collectionTables.has("entity_tags")).toBe(true);
    });

    test("uses namespace prefix when namespace is provided", () => {
      const store = makeStore();
      const embeddedList = makePrimitiveEmbeddedList();
      const entity = makeEntity();

      saveMemoryEmbeddedListRows(entity as any, embeddedList, store, "myns");

      expect(store.collectionTables.has("myns.entity_tags")).toBe(true);
      expect(store.collectionTables.has("entity_tags")).toBe(false);
    });

    test("replaces existing rows on re-save", () => {
      const store = makeStore();
      const embeddedList = makePrimitiveEmbeddedList();
      const entity = makeEntity({ tags: ["first"] });

      saveMemoryEmbeddedListRows(entity as any, embeddedList, store, null);
      (entity as any).tags = ["replaced"];
      saveMemoryEmbeddedListRows(entity as any, embeddedList, store, null);

      const table = store.collectionTables.get("entity_tags");
      expect(table?.get("entity-1")).toMatchSnapshot();
    });

    test("deletes rows when array is empty", () => {
      const store = makeStore();
      const embeddedList = makePrimitiveEmbeddedList();
      const entity = makeEntity({ tags: ["first"] });

      saveMemoryEmbeddedListRows(entity as any, embeddedList, store, null);
      (entity as any).tags = [];
      saveMemoryEmbeddedListRows(entity as any, embeddedList, store, null);

      const table = store.collectionTables.get("entity_tags");
      expect(table?.get("entity-1")).toBeUndefined();
    });

    test("deletes rows when array is null", () => {
      const store = makeStore();
      const embeddedList = makePrimitiveEmbeddedList();
      const entity = makeEntity({ tags: ["existing"] });

      saveMemoryEmbeddedListRows(entity as any, embeddedList, store, null);
      (entity as any).tags = null;
      saveMemoryEmbeddedListRows(entity as any, embeddedList, store, null);

      const table = store.collectionTables.get("entity_tags");
      expect(table?.get("entity-1")).toBeUndefined();
    });
  });

  describe("embeddable elements", () => {
    test("persists embeddable fields with optional transform", () => {
      const store = makeStore();
      const embeddedList: MetaEmbeddedList = {
        key: "addresses",
        tableName: "entity_addresses",
        parentPkColumn: "id",
        parentFkColumn: "entity_id",
        elementFields: [
          { key: "city", type: "string", transform: null },
          {
            key: "zip",
            type: "string",
            transform: {
              to: (v: unknown) => (v as string).toUpperCase(),
              from: (v: unknown) => v,
            },
          },
        ],
        elementConstructor: null,
        elementType: null,
      } as unknown as MetaEmbeddedList;

      const entity = {
        id: "e1",
        addresses: [
          { city: "Berlin", zip: "10115" },
          { city: "Hamburg", zip: "20095" },
        ],
      };

      saveMemoryEmbeddedListRows(entity as any, embeddedList, store, null);

      const table = store.collectionTables.get("entity_addresses");
      expect(table?.get("e1")).toMatchSnapshot();
    });

    test("handles null item values gracefully", () => {
      const store = makeStore();
      const embeddedList: MetaEmbeddedList = {
        key: "items",
        tableName: "entity_items",
        parentPkColumn: "id",
        parentFkColumn: "entity_id",
        elementFields: [{ key: "name", type: "string", transform: null }],
        elementConstructor: null,
        elementType: null,
      } as unknown as MetaEmbeddedList;

      const entity = { id: "e1", items: [null] };

      saveMemoryEmbeddedListRows(entity as any, embeddedList, store, null);

      const table = store.collectionTables.get("entity_items");
      expect(table?.get("e1")).toMatchSnapshot();
    });
  });
});

// ─── loadMemoryEmbeddedListRows ───────────────────────────────────────────────

describe("loadMemoryEmbeddedListRows", () => {
  describe("primitive elements", () => {
    test("loads primitive rows back onto entity", () => {
      const store = makeStore();
      const embeddedList = makePrimitiveEmbeddedList();
      const entity = makeEntity();

      saveMemoryEmbeddedListRows(entity as any, embeddedList, store, null);

      const loaded: Record<string, unknown> = { id: "entity-1", tags: undefined };
      loadMemoryEmbeddedListRows(loaded as any, embeddedList, store, null);

      expect(loaded.tags).toMatchSnapshot();
    });

    test("sets empty array when no rows exist", () => {
      const store = makeStore();
      const embeddedList = makePrimitiveEmbeddedList();
      const entity: Record<string, unknown> = { id: "missing-id", tags: undefined };

      loadMemoryEmbeddedListRows(entity as any, embeddedList, store, null);

      expect(entity.tags).toEqual([]);
    });

    test("sets empty array when collection table is empty for that pk", () => {
      const store = makeStore();
      const embeddedList = makePrimitiveEmbeddedList();

      // Create table but no entry for "missing-id"
      store.collectionTables.set("entity_tags", new Map());

      const entity: Record<string, unknown> = { id: "missing-id", tags: undefined };
      loadMemoryEmbeddedListRows(entity as any, embeddedList, store, null);

      expect(entity.tags).toEqual([]);
    });

    test("loads from namespaced table when namespace provided", () => {
      const store = makeStore();
      const embeddedList = makePrimitiveEmbeddedList();
      const entity = makeEntity();

      saveMemoryEmbeddedListRows(entity as any, embeddedList, store, "myns");

      const loaded: Record<string, unknown> = { id: "entity-1", tags: undefined };
      loadMemoryEmbeddedListRows(loaded as any, embeddedList, store, "myns");

      expect(loaded.tags).toMatchSnapshot();
    });
  });

  describe("embeddable elements", () => {
    test("hydrates embeddable elements using elementConstructor", () => {
      class Address {
        city!: string;
        zip!: string;
      }

      const store = makeStore();
      const embeddedList: MetaEmbeddedList = {
        key: "addresses",
        tableName: "entity_addresses",
        parentPkColumn: "id",
        parentFkColumn: "entity_id",
        elementFields: [
          { key: "city", type: "string", transform: null },
          { key: "zip", type: "string", transform: null },
        ],
        elementConstructor: () => Address,
        elementType: null,
      } as unknown as MetaEmbeddedList;

      const entity = {
        id: "e1",
        addresses: [{ city: "Berlin", zip: "10115" }],
      };

      saveMemoryEmbeddedListRows(entity as any, embeddedList, store, null);

      const loaded: Record<string, unknown> = { id: "e1", addresses: undefined };
      loadMemoryEmbeddedListRows(loaded as any, embeddedList, store, null);

      expect(loaded.addresses).toMatchSnapshot();
      expect((loaded.addresses as Array<unknown>)[0]).toBeInstanceOf(Address);
    });

    test("applies transform.from during load", () => {
      class Tag {
        value!: string;
      }

      const store = makeStore();
      const embeddedList: MetaEmbeddedList = {
        key: "tags",
        tableName: "entity_tags_embed",
        parentPkColumn: "id",
        parentFkColumn: "entity_id",
        elementFields: [
          {
            key: "value",
            type: "string",
            transform: {
              to: (v: unknown) => (v as string).toUpperCase(),
              from: (v: unknown) => (v as string).toLowerCase(),
            },
          },
        ],
        elementConstructor: () => Tag,
        elementType: null,
      } as unknown as MetaEmbeddedList;

      const saveEntity = { id: "e1", tags: [{ value: "hello" }] };
      saveMemoryEmbeddedListRows(saveEntity as any, embeddedList, store, null);

      const loaded: Record<string, unknown> = { id: "e1", tags: undefined };
      loadMemoryEmbeddedListRows(loaded as any, embeddedList, store, null);

      const items = loaded.tags as Array<Tag>;
      expect(items[0].value).toBe("hello");
    });
  });
});

// ─── deleteMemoryEmbeddedListRows ─────────────────────────────────────────────

describe("deleteMemoryEmbeddedListRows", () => {
  test("removes rows for the given entity", () => {
    const store = makeStore();
    const embeddedList = makePrimitiveEmbeddedList();
    const entity = makeEntity();

    saveMemoryEmbeddedListRows(entity as any, embeddedList, store, null);
    deleteMemoryEmbeddedListRows(entity as any, embeddedList, store, null);

    const table = store.collectionTables.get("entity_tags");
    expect(table?.get("entity-1")).toBeUndefined();
  });

  test("does not affect other entities in the same table", () => {
    const store = makeStore();
    const embeddedList = makePrimitiveEmbeddedList();
    const entityA = makeEntity({ id: "a", tags: ["x"] });
    const entityB = makeEntity({ id: "b", tags: ["y"] });

    saveMemoryEmbeddedListRows(entityA as any, embeddedList, store, null);
    saveMemoryEmbeddedListRows(entityB as any, embeddedList, store, null);
    deleteMemoryEmbeddedListRows(entityA as any, embeddedList, store, null);

    const table = store.collectionTables.get("entity_tags");
    expect(table?.get("a")).toBeUndefined();
    expect(table?.get("b")).toBeDefined();
  });

  test("no-op when collection table does not exist yet", () => {
    const store = makeStore();
    const embeddedList = makePrimitiveEmbeddedList();
    const entity = makeEntity();

    // Should not throw even when table doesn't exist
    expect(() =>
      deleteMemoryEmbeddedListRows(entity as any, embeddedList, store, null),
    ).not.toThrow();
  });

  test("deletes from namespaced table", () => {
    const store = makeStore();
    const embeddedList = makePrimitiveEmbeddedList();
    const entity = makeEntity();

    saveMemoryEmbeddedListRows(entity as any, embeddedList, store, "ns");
    deleteMemoryEmbeddedListRows(entity as any, embeddedList, store, "ns");

    const table = store.collectionTables.get("ns.entity_tags");
    expect(table?.get("entity-1")).toBeUndefined();
  });
});
