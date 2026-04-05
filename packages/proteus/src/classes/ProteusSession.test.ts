import { createMockLogger } from "@lindorm/logger";
import { ProteusSession } from "./ProteusSession";
import { ProteusSource } from "./ProteusSource";
import { Entity } from "../decorators/Entity";
import { Field } from "../decorators/Field";
import { PrimaryKeyField } from "../decorators/PrimaryKeyField";
import { Filter } from "../decorators/Filter";

@Entity({ name: "SessionEntity" })
@Filter({ name: "tenant", condition: { tenantId: "$tenantId" } })
class SessionEntity {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  tenantId!: string;
}

const createSource = () =>
  new ProteusSource({
    driver: "memory",
    entities: [SessionEntity],
    logger: createMockLogger(),
  });

describe("ProteusSession", () => {
  describe("data access", () => {
    test("should create repositories against the shared driver", async () => {
      const source = createSource();
      await source.connect();
      await source.setup();

      const session = source.session();
      const repo = session.repository(SessionEntity);

      expect(repo).toBeDefined();

      await source.disconnect();
    });

    test("should create query builders", async () => {
      const source = createSource();
      await source.connect();
      await source.setup();

      const session = source.session();
      const qb = session.queryBuilder(SessionEntity);

      expect(qb).toBeDefined();

      await source.disconnect();
    });

    test("should ping through the shared driver", async () => {
      const source = createSource();
      await source.connect();
      await source.setup();

      const session = source.session();

      await expect(session.ping()).resolves.toBe(true);

      await source.disconnect();
    });

    test("should delegate client() to the shared driver", async () => {
      const source = createSource();
      await source.connect();
      await source.setup();

      const session = source.session();

      // Memory driver does not expose a client — verify it delegates correctly
      await expect(session.client()).rejects.toThrow(
        "Memory driver does not expose a client",
      );

      await source.disconnect();
    });

    test("should run transactions through the shared driver", async () => {
      const source = createSource();
      await source.connect();
      await source.setup();

      const session = source.session();
      const result = await session.transaction(async (tc) => {
        expect(tc).toBeDefined();
        return 42;
      });

      expect(result).toBe(42);

      await source.disconnect();
    });
  });

  describe("getters", () => {
    test("should expose namespace from source", () => {
      const source = createSource();
      const session = source.session();

      expect(session.namespace).toBe(source.namespace);
    });

    test("should expose driverType from source", () => {
      const source = createSource();
      const session = source.session();

      expect(session.driverType).toBe("memory");
    });

    test("should expose log", () => {
      const source = createSource();
      const session = source.session();

      expect(session.log).toBeDefined();
    });
  });

  describe("filter isolation", () => {
    test("should isolate filter registry from parent", () => {
      const source = createSource();
      const session = source.session();

      session.setFilterParams("tenant", { tenantId: "tenant-a" });
      session.enableFilter("tenant");

      expect(session.getFilterRegistry().get("tenant")).toEqual({
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

      const session = source.session();
      session.disableFilter("tenant");

      expect(session.getFilterRegistry().get("tenant")?.enabled).toBe(false);
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

      const session = source.session();
      const repo = session.repository(SessionEntity);
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

      const session = source.session();
      const repo = session.repository(SessionEntity);
      await repo.insert({
        id: "00000000-0000-4000-8000-000000000002",
        tenantId: "tenant-b",
      } as any);

      expect(listener).toHaveBeenCalledTimes(1);

      await source.disconnect();
    });
  });

  describe("logger override", () => {
    test("should use overridden logger when provided", () => {
      const source = createSource();
      const newLogger = createMockLogger();
      const session = source.session({ logger: newLogger });

      expect(session.log).toBeDefined();
    });
  });

  describe("context override", () => {
    test("should accept context override", async () => {
      const source = createSource();
      await source.connect();
      await source.setup();

      const session = source.session({ context: { requestId: "req-123" } });

      // The session should work with the new context
      const repo = session.repository(SessionEntity);
      expect(repo).toBeDefined();

      await source.disconnect();
    });
  });
});
