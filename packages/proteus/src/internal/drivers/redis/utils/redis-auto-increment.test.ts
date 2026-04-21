import type { EntityMetadata } from "../../../entity/types/metadata";
import { applyRedisAutoIncrement } from "./redis-auto-increment";
import { describe, expect, test, vi, type Mock } from "vitest";

// ─── Module Mocks ────────────────────────────────────────────────────────────

vi.mock("./build-increment-key", async () => ({
  buildIncrementKey: vi.fn((_target, fieldName, namespace) =>
    namespace ? `${namespace}:seq:test:${fieldName}` : `seq:test:${fieldName}`,
  ),
}));

// ─── Mock Redis Client ──────────────────────────────────────────────────────

const createMockRedisClient = () => {
  const counters = new Map<string, number>();
  return {
    incr: vi.fn().mockImplementation((key: string) => {
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return Promise.resolve(next);
    }),
    _counters: counters,
  };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

class TestEntity {
  id!: number;
}

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

const makeMetadata = (generated: EntityMetadata["generated"]): EntityMetadata =>
  ({
    entity: { name: "test" },
    target: TestEntity,
    generated,
  }) as unknown as EntityMetadata;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("applyRedisAutoIncrement", () => {
  describe("strategy: increment", () => {
    test("should assign next value when field is null", async () => {
      const client = createMockRedisClient();
      const metadata = makeMetadata([makeGenerated("increment", "id")]);
      const row: Record<string, unknown> = { id: null };

      await applyRedisAutoIncrement(client as any, row, metadata, null);

      expect(row).toMatchSnapshot();
      expect(client.incr).toHaveBeenCalledTimes(1);
    });

    test("should assign next value when field is undefined", async () => {
      const client = createMockRedisClient();
      const metadata = makeMetadata([makeGenerated("increment", "id")]);
      const row: Record<string, unknown> = {};

      await applyRedisAutoIncrement(client as any, row, metadata, null);

      expect(row).toMatchSnapshot();
    });

    test("should assign next value when field is 0", async () => {
      const client = createMockRedisClient();
      const metadata = makeMetadata([makeGenerated("increment", "id")]);
      const row: Record<string, unknown> = { id: 0 };

      await applyRedisAutoIncrement(client as any, row, metadata, null);

      expect(row).toMatchSnapshot();
    });

    test("should skip field with existing non-zero value", async () => {
      const client = createMockRedisClient();
      const metadata = makeMetadata([makeGenerated("increment", "id")]);
      const row: Record<string, unknown> = { id: 99 };

      await applyRedisAutoIncrement(client as any, row, metadata, null);

      expect(row.id).toBe(99);
      expect(client.incr).not.toHaveBeenCalled();
    });

    test("should increment counter on subsequent calls", async () => {
      const client = createMockRedisClient();
      const metadata = makeMetadata([makeGenerated("increment", "id")]);

      const row1: Record<string, unknown> = {};
      const row2: Record<string, unknown> = {};
      const row3: Record<string, unknown> = {};

      await applyRedisAutoIncrement(client as any, row1, metadata, null);
      await applyRedisAutoIncrement(client as any, row2, metadata, null);
      await applyRedisAutoIncrement(client as any, row3, metadata, null);

      expect({ row1, row2, row3 }).toMatchSnapshot();
    });
  });

  describe("strategy: identity", () => {
    test("should assign value for identity strategy", async () => {
      const client = createMockRedisClient();
      const metadata = makeMetadata([makeGenerated("identity", "seq")]);
      const row: Record<string, unknown> = {};

      await applyRedisAutoIncrement(client as any, row, metadata, null);

      expect(row).toMatchSnapshot();
    });
  });

  describe("strategy: other", () => {
    test("should skip generators with non-increment strategies", async () => {
      const client = createMockRedisClient();
      const metadata = makeMetadata([makeGenerated("uuid", "id")]);
      const row: Record<string, unknown> = {};

      await applyRedisAutoIncrement(client as any, row, metadata, null);

      expect(row).toMatchSnapshot();
      expect(client.incr).not.toHaveBeenCalled();
    });
  });

  describe("namespace", () => {
    test("should pass namespace to buildIncrementKey", async () => {
      const client = createMockRedisClient();
      const metadata = makeMetadata([makeGenerated("increment", "id")]);
      const row: Record<string, unknown> = {};

      await applyRedisAutoIncrement(client as any, row, metadata, "myapp");

      expect(row).toMatchSnapshot();
      expect(client.incr).toHaveBeenCalledWith("myapp:seq:test:id");
    });
  });

  describe("multiple generators", () => {
    test("should apply all increment generators independently", async () => {
      const client = createMockRedisClient();
      const metadata = makeMetadata([
        makeGenerated("increment", "seq1"),
        makeGenerated("increment", "seq2"),
      ]);
      const row: Record<string, unknown> = {};

      await applyRedisAutoIncrement(client as any, row, metadata, null);

      expect(row).toMatchSnapshot();
      expect(client.incr).toHaveBeenCalledTimes(2);
    });

    test("should skip non-increment alongside increment", async () => {
      const client = createMockRedisClient();
      const metadata = makeMetadata([
        makeGenerated("uuid", "externalId"),
        makeGenerated("increment", "seq"),
      ]);
      const row: Record<string, unknown> = {};

      await applyRedisAutoIncrement(client as any, row, metadata, null);

      expect(row).toMatchSnapshot();
      expect(client.incr).toHaveBeenCalledTimes(1);
    });
  });

  describe("empty generated array", () => {
    test("should be no-op when generated is empty", async () => {
      const client = createMockRedisClient();
      const metadata = makeMetadata([]);
      const row: Record<string, unknown> = { id: "manual" };

      await applyRedisAutoIncrement(client as any, row, metadata, null);

      expect(row).toMatchSnapshot();
      expect(client.incr).not.toHaveBeenCalled();
    });
  });
});
