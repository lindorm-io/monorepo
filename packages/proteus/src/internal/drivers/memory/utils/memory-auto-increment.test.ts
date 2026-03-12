import type { EntityMetadata } from "#internal/entity/types/metadata";
import type { MemoryStore } from "../types/memory-store";
import { applyAutoIncrement } from "./memory-auto-increment";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeStore = (): MemoryStore => ({
  tables: new Map(),
  joinTables: new Map(),
  collectionTables: new Map(),
  incrementCounters: new Map(),
});

const makeGenerated = (
  strategy: "increment" | "identity" | "uuid",
  key: string,
): EntityMetadata["generated"][number] => ({
  strategy,
  key,
  length: null,
  max: null,
  min: null,
});

const makeMetadata = (
  generated: EntityMetadata["generated"],
  name = "TestEntity",
): EntityMetadata =>
  ({
    entity: { name },
    generated,
  }) as unknown as EntityMetadata;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("applyAutoIncrement", () => {
  describe("strategy: increment", () => {
    test("assigns 1 on first call", () => {
      const store = makeStore();
      const metadata = makeMetadata([makeGenerated("increment", "id")]);
      const row: Record<string, unknown> = {};

      applyAutoIncrement(row, metadata, () => store);

      expect(row).toMatchSnapshot();
    });

    test("increments counter on subsequent calls", () => {
      const store = makeStore();
      const metadata = makeMetadata([makeGenerated("increment", "id")]);

      const row1: Record<string, unknown> = {};
      const row2: Record<string, unknown> = {};
      const row3: Record<string, unknown> = {};

      applyAutoIncrement(row1, metadata, () => store);
      applyAutoIncrement(row2, metadata, () => store);
      applyAutoIncrement(row3, metadata, () => store);

      expect({ row1, row2, row3 }).toMatchSnapshot();
    });

    test("counter key is scoped by entity name + field key", () => {
      const store = makeStore();
      const metaA = makeMetadata([makeGenerated("increment", "id")], "EntityA");
      const metaB = makeMetadata([makeGenerated("increment", "id")], "OtherEntity");

      const rowA: Record<string, unknown> = {};
      const rowB: Record<string, unknown> = {};

      applyAutoIncrement(rowA, metaA, () => store);
      applyAutoIncrement(rowB, metaB, () => store);

      expect({ rowA, rowB }).toMatchSnapshot();
      expect(store.incrementCounters).toMatchSnapshot();
    });
  });

  describe("strategy: identity", () => {
    test("assigns values for identity strategy the same as increment", () => {
      const store = makeStore();
      const metadata = makeMetadata([makeGenerated("identity", "seq")]);
      const row: Record<string, unknown> = {};

      applyAutoIncrement(row, metadata, () => store);

      expect(row).toMatchSnapshot();
    });
  });

  describe("strategy: other (uuid, custom)", () => {
    test("skips generators with non-increment strategies", () => {
      const store = makeStore();
      const metadata = makeMetadata([makeGenerated("uuid", "id")]);
      const row: Record<string, unknown> = {};

      applyAutoIncrement(row, metadata, () => store);

      expect(row).toMatchSnapshot();
      expect(store.incrementCounters.size).toBe(0);
    });
  });

  describe("skipExisting flag", () => {
    test("skips field if already set and skipExisting is true", () => {
      const store = makeStore();
      const metadata = makeMetadata([makeGenerated("increment", "id")]);
      const row: Record<string, unknown> = { id: 99 };

      applyAutoIncrement(row, metadata, () => store, true);

      expect(row.id).toBe(99);
      expect(store.incrementCounters.size).toBe(0);
    });

    test("overwrites field when skipExisting is false (default)", () => {
      const store = makeStore();
      const metadata = makeMetadata([makeGenerated("increment", "id")]);
      const row: Record<string, unknown> = { id: 99 };

      applyAutoIncrement(row, metadata, () => store, false);

      expect(row.id).toBe(1);
    });

    test("assigns when field is missing and skipExisting is true", () => {
      const store = makeStore();
      const metadata = makeMetadata([makeGenerated("increment", "id")]);
      const row: Record<string, unknown> = {};

      applyAutoIncrement(row, metadata, () => store, true);

      expect(row.id).toBe(1);
    });
  });

  describe("multiple generated fields", () => {
    test("applies all increment generators independently", () => {
      const store = makeStore();
      const metadata = makeMetadata([
        makeGenerated("increment", "seq1"),
        makeGenerated("increment", "seq2"),
      ]);
      const row: Record<string, unknown> = {};

      applyAutoIncrement(row, metadata, () => store);

      expect(row).toMatchSnapshot();
      expect(store.incrementCounters).toMatchSnapshot();
    });

    test("skips non-increment alongside increment", () => {
      const store = makeStore();
      const metadata = makeMetadata([
        makeGenerated("uuid", "externalId"),
        makeGenerated("increment", "seq"),
      ]);
      const row: Record<string, unknown> = {};

      applyAutoIncrement(row, metadata, () => store);

      expect(row).toMatchSnapshot();
    });
  });

  describe("empty generated array", () => {
    test("no-op when generated is empty", () => {
      const store = makeStore();
      const metadata = makeMetadata([]);
      const row: Record<string, unknown> = { id: "manual" };

      applyAutoIncrement(row, metadata, () => store);

      expect(row).toMatchSnapshot();
      expect(store.incrementCounters.size).toBe(0);
    });
  });
});
