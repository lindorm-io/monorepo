import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ProteusSession } from "./ProteusSession.js";
import { ProteusSource } from "./ProteusSource.js";
import { Entity } from "../decorators/Entity.js";
import { Field } from "../decorators/Field.js";
import { PrimaryKeyField } from "../decorators/PrimaryKeyField.js";
import { Filter } from "../decorators/Filter.js";
import { describe, expect, test, vi } from "vitest";

@Entity({ name: "SessionEntity" })
@Filter({ name: "tenant", condition: { tenantId: "$tenantId" } })
class SessionEntity {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  tenantId!: string;
}

@Entity({ name: "NotRegisteredOnSession" })
class NotRegisteredOnSession {
  @PrimaryKeyField()
  id!: string;
}

const createSource = () =>
  new ProteusSource({
    driver: "memory",
    entities: [SessionEntity],
    logger: createMockLogger(),
  });

describe("ProteusSession", () => {
  describe("hasEntity", () => {
    test("should return true for an entity registered on the source", () => {
      const source = createSource();
      const session = source.session();
      expect(session.hasEntity(SessionEntity)).toBe(true);
    });

    test("should return false for an entity not registered on the source", () => {
      const source = createSource();
      const session = source.session();
      expect(session.hasEntity(NotRegisteredOnSession)).toBe(false);
    });
  });

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

      const listener = vi.fn();
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

      const listener = vi.fn();
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

    test("should include session context in event payload", async () => {
      const source = createSource();
      await source.connect();
      await source.setup();

      const requestContext = {
        correlationId: "req-456",
        actor: "user-1",
        timestamp: new Date(),
      };
      const listener = vi.fn();
      source.on("entity:after-insert", listener);

      const session = source.session({ context: requestContext });
      const repo = session.repository(SessionEntity);
      await repo.insert({
        id: "00000000-0000-4000-8000-000000000003",
        tenantId: "tenant-c",
      } as any);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          context: requestContext,
          entity: expect.objectContaining({ tenantId: "tenant-c" }),
          metadata: expect.objectContaining({
            entity: expect.objectContaining({ name: "SessionEntity" }),
          }),
        }),
      );

      await source.disconnect();
    });

    test("should include session context in destroy events", async () => {
      const source = createSource();
      await source.connect();
      await source.setup();

      const session = source.session();
      const repo = session.repository(SessionEntity);
      const entity = await repo.insert({
        id: "00000000-0000-4000-8000-000000000004",
        tenantId: "tenant-d",
      } as any);

      const destroyContext = {
        correlationId: "req-789",
        actor: "user-2",
        timestamp: new Date(),
      };
      const listener = vi.fn();
      source.on("entity:after-destroy", listener);

      const destroySession = source.session({ context: destroyContext });
      const destroyRepo = destroySession.repository(SessionEntity);
      await destroyRepo.destroy(entity);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          context: destroyContext,
        }),
      );

      await source.disconnect();
    });

    test("should use the source-level default hook meta when no session context provided", async () => {
      const source = createSource();
      await source.connect();
      await source.setup();

      const listener = vi.fn();
      source.on("entity:after-insert", listener);

      const session = source.session();
      const repo = session.repository(SessionEntity);
      await repo.insert({
        id: "00000000-0000-4000-8000-000000000005",
        tenantId: "tenant-e",
      } as any);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            correlationId: "unknown",
            actor: null,
            timestamp: expect.any(Date),
          }),
        }),
      );

      await source.disconnect();
    });
  });
});
