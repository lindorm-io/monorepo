import { createMockLogger } from "@lindorm/logger";
import { ProteusClone } from "./ProteusClone";
import { ProteusSource } from "./ProteusSource";
import { NotSupportedError } from "../errors";
import { Entity } from "../decorators/Entity";
import { Field } from "../decorators/Field";
import { PrimaryKeyField } from "../decorators/PrimaryKeyField";
import { Filter } from "../decorators/Filter";

@Entity({ name: "CloneEntity" })
@Filter({ name: "tenant", condition: { tenantId: "$tenantId" } })
class CloneEntity {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  tenantId!: string;
}

const createSource = () =>
  new ProteusSource({
    driver: "memory",
    entities: [CloneEntity],
    logger: createMockLogger(),
  });

describe("ProteusClone", () => {
  describe("data access", () => {
    test("should create repositories against the shared driver", async () => {
      const source = createSource();
      await source.connect();
      await source.setup();

      const clone = source.clone();
      const repo = clone.repository(CloneEntity);

      expect(repo).toBeDefined();

      await source.disconnect();
    });

    test("should create query builders", async () => {
      const source = createSource();
      await source.connect();
      await source.setup();

      const clone = source.clone();
      const qb = clone.queryBuilder(CloneEntity);

      expect(qb).toBeDefined();

      await source.disconnect();
    });

    test("should ping through the shared driver", async () => {
      const source = createSource();
      await source.connect();
      await source.setup();

      const clone = source.clone();

      await expect(clone.ping()).resolves.toBe(true);

      await source.disconnect();
    });

    test("should delegate client() to the shared driver", async () => {
      const source = createSource();
      await source.connect();
      await source.setup();

      const clone = source.clone();

      // Memory driver does not expose a client — verify it delegates correctly
      await expect(clone.client()).rejects.toThrow(
        "Memory driver does not expose a client",
      );

      await source.disconnect();
    });

    test("should run transactions through the shared driver", async () => {
      const source = createSource();
      await source.connect();
      await source.setup();

      const clone = source.clone();
      const result = await clone.transaction(async (tc) => {
        expect(tc).toBeDefined();
        return 42;
      });

      expect(result).toBe(42);

      await source.disconnect();
    });
  });

  describe("getters", () => {
    test("should expose namespace from parent", () => {
      const source = createSource();
      const clone = source.clone();

      expect(clone.namespace).toBe(source.namespace);
    });

    test("should expose driverType from parent", () => {
      const source = createSource();
      const clone = source.clone();

      expect(clone.driverType).toBe("memory");
    });

    test("should expose log", () => {
      const source = createSource();
      const clone = source.clone();

      expect(clone.log).toBeDefined();
    });

    test("should return null for breaker", () => {
      const source = createSource();
      const clone = source.clone();

      expect(clone.breaker).toBeNull();
    });

    test("should return undefined for migrationsTable", () => {
      const source = createSource();
      const clone = source.clone();

      expect(clone.migrationsTable).toBeUndefined();
    });
  });

  describe("filter isolation", () => {
    test("should isolate filter registry from parent", () => {
      const source = createSource();
      const clone = source.clone();

      clone.setFilterParams("tenant", { tenantId: "tenant-a" });
      clone.enableFilter("tenant");

      expect(clone.getFilterRegistry().get("tenant")).toEqual({
        enabled: true,
        params: { tenantId: "tenant-a" },
      });

      // Original unaffected
      expect(source.getFilterRegistry().has("tenant")).toBe(false);
    });

    test("should disable filters independently", () => {
      const source = createSource();
      source.setFilterParams("tenant", { tenantId: "base" });
      source.enableFilter("tenant");

      const clone = source.clone();
      clone.disableFilter("tenant");

      expect(clone.getFilterRegistry().get("tenant")?.enabled).toBe(false);
      expect(source.getFilterRegistry().get("tenant")?.enabled).toBe(true);
    });
  });

  describe("event bubbling", () => {
    test("should bubble entity events to the parent source", async () => {
      const source = createSource();
      await source.connect();
      await source.setup();

      const listener = jest.fn();
      source.on("entity:after-insert", listener);

      const clone = source.clone();
      const repo = clone.repository(CloneEntity);
      await repo.insert({
        id: "00000000-0000-4000-8000-000000000001",
        tenantId: "tenant-a",
      } as any);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: expect.objectContaining({ tenantId: "tenant-a" }),
        }),
      );

      await source.disconnect();
    });

    test("should bubble before-insert events to the parent", async () => {
      const source = createSource();
      await source.connect();
      await source.setup();

      const listener = jest.fn();
      source.on("entity:before-insert", listener);

      const clone = source.clone();
      const repo = clone.repository(CloneEntity);
      await repo.insert({
        id: "00000000-0000-4000-8000-000000000002",
        tenantId: "tenant-b",
      } as any);

      expect(listener).toHaveBeenCalledTimes(1);

      await source.disconnect();
    });
  });

  describe("unsupported operations", () => {
    test("should throw on setup()", async () => {
      const source = createSource();
      const clone = source.clone();

      await expect(clone.setup()).rejects.toThrow(NotSupportedError);
      await expect(clone.setup()).rejects.toThrow(
        "Cannot call setup() on a cloned ProteusSource",
      );
    });

    test("should throw on connect()", async () => {
      const source = createSource();
      const clone = source.clone();

      await expect(clone.connect()).rejects.toThrow(NotSupportedError);
    });

    test("should throw on disconnect()", async () => {
      const source = createSource();
      const clone = source.clone();

      await expect(clone.disconnect()).rejects.toThrow(NotSupportedError);
    });

    test("should throw on on()", () => {
      const source = createSource();
      const clone = source.clone();

      expect(() => clone.on("entity:after-insert", jest.fn())).toThrow(NotSupportedError);
    });

    test("should throw on off()", () => {
      const source = createSource();
      const clone = source.clone();

      expect(() => clone.off("entity:after-insert", jest.fn())).toThrow(
        NotSupportedError,
      );
    });

    test("should throw on once()", () => {
      const source = createSource();
      const clone = source.clone();

      expect(() => clone.once("entity:after-insert", jest.fn())).toThrow(
        NotSupportedError,
      );
    });

    test("should throw on clone()", () => {
      const source = createSource();
      const clone = source.clone();

      expect(() => clone.clone()).toThrow(NotSupportedError);
      expect(() => clone.clone()).toThrow("Cannot clone a cloned ProteusSource");
    });

    test("should throw on addEntities()", () => {
      const source = createSource();
      const clone = source.clone();

      expect(() => clone.addEntities([CloneEntity])).toThrow(NotSupportedError);
    });

    test("should throw on getEntityMetadata()", () => {
      const source = createSource();
      const clone = source.clone();

      expect(() => clone.getEntityMetadata()).toThrow(NotSupportedError);
    });
  });

  describe("logger override", () => {
    test("should use overridden logger when provided", () => {
      const source = createSource();
      const newLogger = createMockLogger();
      const clone = source.clone({ logger: newLogger });

      expect(clone.log).toBeDefined();
    });
  });

  describe("context override", () => {
    test("should accept context override", async () => {
      const source = createSource();
      await source.connect();
      await source.setup();

      const clone = source.clone({ context: { requestId: "req-123" } });

      // The clone should work with the new context
      const repo = clone.repository(CloneEntity);
      expect(repo).toBeDefined();

      await source.disconnect();
    });
  });
});
