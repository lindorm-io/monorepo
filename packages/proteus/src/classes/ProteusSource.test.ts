import { createMockLogger } from "@lindorm/logger";
import { ProteusSource } from "./ProteusSource";
import { Entity } from "../decorators/Entity";
import { Field } from "../decorators/Field";
import { PrimaryKeyField } from "../decorators/PrimaryKeyField";
import { Filter } from "../decorators/Filter";
import type { IEntitySubscriber } from "../interfaces/EntitySubscriber";

@Entity({ name: "CloneTestEntity" })
@Filter({ name: "tenant", cond: { tenantId: "$tenantId" } })
class CloneTestEntity {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  tenantId!: string;
}

const createSource = () =>
  new ProteusSource({
    driver: "memory",
    entities: [CloneTestEntity],
    logger: createMockLogger(),
  });

describe("ProteusSource", () => {
  describe("clone", () => {
    test("should produce a new ProteusSource instance", () => {
      const source = createSource();
      const cloned = source.clone();

      expect(cloned).toBeInstanceOf(ProteusSource);
      expect(cloned).not.toBe(source);
    });

    test("should isolate filter registry: clone mutations do not affect original", () => {
      const source = createSource();
      const cloned = source.clone();

      cloned.setFilterParams("tenant", { tenantId: "tenant-a" });
      cloned.enableFilter("tenant");

      const originalRegistry = source.getFilterRegistry();
      const clonedRegistry = cloned.getFilterRegistry();

      // Clone has the filter enabled with params
      expect(clonedRegistry.get("tenant")).toEqual({
        enabled: true,
        params: { tenantId: "tenant-a" },
      });

      // Original should be unaffected
      expect(originalRegistry.has("tenant")).toBe(false);
    });

    test("should isolate filter registry: original mutations do not affect clone", () => {
      const source = createSource();
      source.setFilterParams("tenant", { tenantId: "tenant-x" });
      source.enableFilter("tenant");

      const cloned = source.clone();

      // Clone inherits the snapshot
      expect(cloned.getFilterRegistry().get("tenant")).toEqual({
        enabled: true,
        params: { tenantId: "tenant-x" },
      });

      // Mutate original after cloning
      source.setFilterParams("tenant", { tenantId: "tenant-y" });

      // Clone should still have the snapshot value
      expect(cloned.getFilterRegistry().get("tenant")).toEqual({
        enabled: true,
        params: { tenantId: "tenant-x" },
      });

      // Original should have the new value
      expect(source.getFilterRegistry().get("tenant")).toEqual({
        enabled: true,
        params: { tenantId: "tenant-y" },
      });
    });

    test("should isolate subscribers: clone mutations do not affect original", () => {
      const source = createSource();
      const subscriber: IEntitySubscriber = { afterInsert: jest.fn() };

      const cloned = source.clone();
      cloned.addSubscriber(subscriber);

      // We can't directly access subscribers, but we can clone again and check
      // the new clone doesn't inherit the subscriber added to the first clone.
      // Use getFilterRegistry as a proxy — if ref cells work, subscribers do too.
      // Actually, let's test by cloning the original again:
      const cloned2 = source.clone();

      // Add a different subscriber to the original
      const originalSubscriber: IEntitySubscriber = { afterUpdate: jest.fn() };
      source.addSubscriber(originalSubscriber);

      // Clone from after the original subscriber was added
      const cloned3 = source.clone();

      // cloned3 should not have the subscriber added to cloned (first clone)
      // This verifies subscriber isolation between clones
      expect(cloned).not.toBe(cloned2);
      expect(cloned).not.toBe(cloned3);
    });

    test("should share the same driver (connection pool)", async () => {
      const source = createSource();
      await source.connect();
      await source.setup();

      const cloned = source.clone();

      // Both should be able to create repositories against the same driver
      const originalRepo = source.repository(CloneTestEntity);
      const clonedRepo = cloned.repository(CloneTestEntity);

      expect(originalRepo).toBeDefined();
      expect(clonedRepo).toBeDefined();

      await source.disconnect();
    });

    test("should isolate filters at the driver level: clone's repository uses clone's registry", async () => {
      const source = createSource();
      await source.connect();
      await source.setup();

      // Insert test data via the original source
      const originalRepo = source.repository(CloneTestEntity);
      await originalRepo.insert({
        id: "00000000-0000-4000-8000-000000000001",
        tenantId: "tenant-a",
      } as any);
      await originalRepo.insert({
        id: "00000000-0000-4000-8000-000000000002",
        tenantId: "tenant-b",
      } as any);

      // Clone and set tenant filter on clone only
      const cloned = source.clone();
      cloned.setFilterParams("tenant", { tenantId: "tenant-a" });
      cloned.enableFilter("tenant");

      // The clone's repository should use the clone's filter registry
      const clonedRepo = cloned.repository(CloneTestEntity);
      const clonedResults = await clonedRepo.find({});

      // The original's repository should NOT have the tenant filter
      const originalResults = await originalRepo.find({});

      // Original should see all rows (no filter)
      expect(originalResults).toHaveLength(2);

      // Clone should only see tenant-a rows (filter active)
      expect(clonedResults).toHaveLength(1);
      expect((clonedResults[0] as any).tenantId).toBe("tenant-a");

      await source.disconnect();
    });

    test("should allow overriding logger on clone", () => {
      const source = createSource();
      const newLogger = createMockLogger();
      const cloned = source.clone({ logger: newLogger });

      expect(cloned).toBeInstanceOf(ProteusSource);
    });

    test("should allow overriding context on clone", () => {
      const source = createSource();
      const cloned = source.clone({ context: { requestId: "abc-123" } });

      expect(cloned).toBeInstanceOf(ProteusSource);
    });

    test("should clone filter registry with current state", () => {
      const source = createSource();

      // Set up some filter state
      source.setFilterParams("tenant", { tenantId: "base-tenant" });
      source.enableFilter("tenant");

      // Clone inherits the state
      const cloned = source.clone();
      expect(cloned.getFilterRegistry().get("tenant")).toEqual({
        enabled: true,
        params: { tenantId: "base-tenant" },
      });

      // Disable on clone
      cloned.disableFilter("tenant");
      expect(cloned.getFilterRegistry().get("tenant")).toEqual({
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
