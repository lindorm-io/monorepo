import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ProteusSession } from "./ProteusSession.js";
import { ProteusSource } from "./ProteusSource.js";
import { Entity } from "../decorators/Entity.js";
import { Field } from "../decorators/Field.js";
import { PrimaryKeyField } from "../decorators/PrimaryKeyField.js";
import { Filter } from "../decorators/Filter.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "SessionTestEntity" })
@Filter({ name: "tenant", condition: { tenantId: "$tenantId" } })
class SessionTestEntity {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  tenantId!: string;
}

@Entity({ name: "UnregisteredEntity" })
class UnregisteredEntity {
  @PrimaryKeyField()
  id!: string;
}

const createSource = () =>
  new ProteusSource({
    driver: "memory",
    entities: [SessionTestEntity],
    logger: createMockLogger(),
  });

describe("ProteusSource", () => {
  describe("hasEntity", () => {
    test("should return true for a registered entity", () => {
      const source = createSource();
      expect(source.hasEntity(SessionTestEntity)).toBe(true);
    });

    test("should return false for an unregistered entity", () => {
      const source = createSource();
      expect(source.hasEntity(UnregisteredEntity)).toBe(false);
    });

    test("should return true for an entity added via addEntities", async () => {
      const source = new ProteusSource({
        driver: "memory",
        entities: [],
        logger: createMockLogger(),
      });
      await source.addEntities([UnregisteredEntity]);
      expect(source.hasEntity(UnregisteredEntity)).toBe(true);
    });

    test("should return false on a source with no entities registered", () => {
      const source = new ProteusSource({
        driver: "memory",
        entities: [],
        logger: createMockLogger(),
      });
      expect(source.hasEntity(SessionTestEntity)).toBe(false);
    });
  });

  describe("session", () => {
    test("should produce a ProteusSession instance", () => {
      const source = createSource();
      const session = source.session();

      expect(session).toBeInstanceOf(ProteusSession);
      expect(session).not.toBe(source);
    });

    test("should isolate filter registry: session mutations do not affect original", () => {
      const source = createSource();
      const session = source.session();

      session.setFilterParams("tenant", { tenantId: "tenant-a" });
      session.enableFilter("tenant");

      const originalRegistry = source.getFilterRegistry();
      const sessionRegistry = session.getFilterRegistry();

      // Session has the filter enabled with params
      expect(sessionRegistry.get("tenant")).toEqual({
        enabled: true,
        params: { tenantId: "tenant-a" },
      });

      // Original should be unaffected
      expect(originalRegistry.has("tenant")).toBe(false);
    });

    test("should isolate filter registry: original mutations do not affect session", () => {
      const source = createSource();
      source.setFilterParams("tenant", { tenantId: "tenant-x" });
      source.enableFilter("tenant");

      const session = source.session();

      // Session inherits the snapshot
      expect(session.getFilterRegistry().get("tenant")).toEqual({
        enabled: true,
        params: { tenantId: "tenant-x" },
      });

      // Mutate original after creating session
      source.setFilterParams("tenant", { tenantId: "tenant-y" });

      // Session should still have the snapshot value
      expect(session.getFilterRegistry().get("tenant")).toEqual({
        enabled: true,
        params: { tenantId: "tenant-x" },
      });

      // Original should have the new value
      expect(source.getFilterRegistry().get("tenant")).toEqual({
        enabled: true,
        params: { tenantId: "tenant-y" },
      });
    });

    test("should produce distinct session instances", () => {
      const source = createSource();

      const session1 = source.session();
      const session2 = source.session();
      const session3 = source.session();

      expect(session1).not.toBe(session2);
      expect(session1).not.toBe(session3);
      expect(session2).not.toBe(session3);
    });

    test("should share the same driver (connection pool)", async () => {
      const source = createSource();
      await source.connect();
      await source.setup();

      const session = source.session();

      // Both should be able to create repositories against the same driver
      const originalRepo = source.repository(SessionTestEntity);
      const sessionRepo = session.repository(SessionTestEntity);

      expect(originalRepo).toBeDefined();
      expect(sessionRepo).toBeDefined();

      await source.disconnect();
    });

    test("should isolate filters at the driver level: session's repository uses session's registry", async () => {
      const source = createSource();
      await source.connect();
      await source.setup();

      // Insert test data via the original source
      const originalRepo = source.repository(SessionTestEntity);
      await originalRepo.insert({
        id: "00000000-0000-4000-8000-000000000001",
        tenantId: "tenant-a",
      } as any);
      await originalRepo.insert({
        id: "00000000-0000-4000-8000-000000000002",
        tenantId: "tenant-b",
      } as any);

      // Create session and set tenant filter on session only
      const session = source.session();
      session.setFilterParams("tenant", { tenantId: "tenant-a" });
      session.enableFilter("tenant");

      // The session's repository should use the session's filter registry
      const sessionRepo = session.repository(SessionTestEntity);
      const sessionResults = await sessionRepo.find({});

      // The original's repository should NOT have the tenant filter
      const originalResults = await originalRepo.find({});

      // Original should see all rows (no filter)
      expect(originalResults).toHaveLength(2);

      // Session should only see tenant-a rows (filter active)
      expect(sessionResults).toHaveLength(1);
      expect((sessionResults[0] as any).tenantId).toBe("tenant-a");

      await source.disconnect();
    });

    test("should allow overriding logger on session", () => {
      const source = createSource();
      const newLogger = createMockLogger();
      const session = source.session({ logger: newLogger });

      expect(session).toBeInstanceOf(ProteusSession);
    });

    test("should allow overriding meta on session", () => {
      const source = createSource();
      const session = source.session({
        meta: { correlationId: "abc-123", actor: "user-1", timestamp: new Date() },
      });

      expect(session).toBeInstanceOf(ProteusSession);
    });

    test("should create session with filter registry snapshot of current state", () => {
      const source = createSource();

      // Set up some filter state
      source.setFilterParams("tenant", { tenantId: "base-tenant" });
      source.enableFilter("tenant");

      // Session inherits the state
      const session = source.session();
      expect(session.getFilterRegistry().get("tenant")).toEqual({
        enabled: true,
        params: { tenantId: "base-tenant" },
      });

      // Disable on session
      session.disableFilter("tenant");
      expect(session.getFilterRegistry().get("tenant")).toEqual({
        enabled: false,
        params: { tenantId: "base-tenant" },
      });

      // Original still enabled
      expect(source.getFilterRegistry().get("tenant")).toEqual({
        enabled: true,
        params: { tenantId: "base-tenant" },
      });
    });
  });
});
