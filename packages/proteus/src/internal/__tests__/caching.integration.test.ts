// Caching Integration Tests
//
// Exercises the full caching layer (MemoryCacheAdapter + CachingRepository)
// against the Memory driver. No Docker needed.

import { createMockLogger } from "@lindorm/logger";
import { ProteusSource } from "../../classes/ProteusSource";
import { MemoryCacheAdapter } from "../../classes/MemoryCacheAdapter";
import {
  AfterLoad,
  Cache,
  CreateDateField,
  Entity,
  Field,
  Nullable,
  PrimaryKeyField,
  UpdateDateField,
  VersionField,
} from "../../decorators";

// ─── Test Entities ──────────────────────────────────────────────────────────

@Entity({ name: "CachedItem" })
@Cache("1 Minute")
class CachedItem {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @Nullable()
  @Field("integer")
  value!: number | null;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;
}

@Entity({ name: "UncachedItem" })
class UncachedItem {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;
}

const afterLoadSpy = jest.fn();

@Entity({ name: "HookedItem" })
@Cache("1 Minute")
@AfterLoad(afterLoadSpy)
class HookedItem {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  label!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;
}

// ─── Setup ──────────────────────────────────────────────────────────────────

let adapter: MemoryCacheAdapter;
let source: ProteusSource;

beforeAll(async () => {
  adapter = new MemoryCacheAdapter({ maxEntries: 100 });

  source = new ProteusSource({
    driver: "memory",
    entities: [CachedItem, UncachedItem, HookedItem],
    cache: { adapter, ttl: "2 Minutes" },
    logger: createMockLogger(),
  });

  await source.connect();
  await source.setup();
});

afterEach(() => {
  jest.restoreAllMocks();
  afterLoadSpy.mockClear();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("caching integration", () => {
  describe("cache hit", () => {
    it("should return cached result on second find", async () => {
      const repo = source.repository(CachedItem);
      const getSpy = jest.spyOn(adapter, "get");
      const setSpy = jest.spyOn(adapter, "set");

      const saved = await repo.save({ name: "alpha", value: 10 });

      // Reset spies after the write (write triggers invalidation)
      getSpy.mockClear();
      setSpy.mockClear();

      // First find: cache miss -> fetches from DB -> stores in cache
      const first = await repo.find({ name: "alpha" });
      expect(first).toHaveLength(1);
      expect(first[0].id).toBe(saved.id);
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(setSpy).toHaveBeenCalledTimes(1);

      getSpy.mockClear();
      setSpy.mockClear();

      // Second find: cache hit -> no set call
      const second = await repo.find({ name: "alpha" });
      expect(second).toHaveLength(1);
      expect(second[0].id).toBe(saved.id);
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(setSpy).not.toHaveBeenCalled();
    });
  });

  describe("invalidation after write", () => {
    it("should return fresh data after update", async () => {
      const repo = source.repository(CachedItem);

      const saved = await repo.save({ name: "before", value: 1 });

      // Populate cache
      const cached = await repo.find({ id: saved.id });
      expect(cached[0].name).toBe("before");

      // Update entity -> invalidates cache
      cached[0].name = "after";
      await repo.update(cached[0]);

      // Next find should get fresh result from DB
      const fresh = await repo.find({ id: saved.id });
      expect(fresh[0].name).toBe("after");
    });

    it("should invalidate after insert", async () => {
      const repo = source.repository(CachedItem);

      // Populate cache with empty result
      const empty = await repo.find({ name: "insert-test" });
      expect(empty).toHaveLength(0);

      // Insert -> invalidates cache
      await repo.save({ name: "insert-test", value: 42 });

      // Fresh find should see the new record
      const found = await repo.find({ name: "insert-test" });
      expect(found).toHaveLength(1);
      expect(found[0].name).toBe("insert-test");
    });

    it("should invalidate after destroy", async () => {
      const repo = source.repository(CachedItem);

      const saved = await repo.save({ name: "destroy-me", value: 0 });

      // Populate cache
      const cached = await repo.find({ name: "destroy-me" });
      expect(cached).toHaveLength(1);

      // Destroy -> invalidates cache
      await repo.destroy(cached[0]);

      // Fresh find should return empty
      const afterDestroy = await repo.find({ name: "destroy-me" });
      expect(afterDestroy).toHaveLength(0);
    });
  });

  describe("TTL expiry", () => {
    it("should miss cache after TTL expires", async () => {
      const repo = source.repository(CachedItem);

      await repo.save({ name: "ttl-test", value: 99 });

      // Populate cache
      await repo.find({ name: "ttl-test" });

      // Advance Date.now past the 1 minute TTL
      const realNow = Date.now();
      const dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(realNow + 61_000);

      const setSpy = jest.spyOn(adapter, "set");

      // This find should miss (TTL expired) and re-fetch from DB
      const result = await repo.find({ name: "ttl-test" });
      expect(result).toHaveLength(1);

      // set should have been called (cache was re-populated)
      expect(setSpy).toHaveBeenCalled();

      dateNowSpy.mockRestore();
    });
  });

  describe("per-query cache:false override", () => {
    it("should bypass cache when cache:false is set", async () => {
      const repo = source.repository(CachedItem);
      const getSpy = jest.spyOn(adapter, "get");
      const setSpy = jest.spyOn(adapter, "set");

      await repo.save({ name: "no-cache", value: 0 });

      getSpy.mockClear();
      setSpy.mockClear();

      // find with cache:false -> should not touch adapter at all
      const result = await repo.find({ name: "no-cache" }, { cache: false });
      expect(result).toHaveLength(1);
      expect(getSpy).not.toHaveBeenCalled();
      expect(setSpy).not.toHaveBeenCalled();
    });
  });

  describe("per-query TTL override", () => {
    it("should use per-query TTL instead of decorator TTL", async () => {
      const repo = source.repository(CachedItem);
      const setSpy = jest.spyOn(adapter, "set");

      await repo.save({ name: "custom-ttl", value: 0 });

      setSpy.mockClear();

      // find with custom TTL of 30 seconds
      await repo.find({ name: "custom-ttl" }, { cache: { ttl: "30 Seconds" } });

      expect(setSpy).toHaveBeenCalledTimes(1);
      // Verify the TTL passed to set is 30000ms
      const ttlArg = setSpy.mock.calls[0][2];
      expect(ttlArg).toBe(30_000);
    });
  });

  describe("uncached entity with source default", () => {
    it("should cache UncachedItem via source ttl", async () => {
      const repo = source.repository(UncachedItem);
      const getSpy = jest.spyOn(adapter, "get");
      const setSpy = jest.spyOn(adapter, "set");

      await repo.save({ name: "uses-default" });

      getSpy.mockClear();
      setSpy.mockClear();

      // First find -> cache miss, set
      await repo.find({ name: "uses-default" });
      expect(setSpy).toHaveBeenCalledTimes(1);
      // Source default is 2 Minutes = 120000ms
      expect(setSpy.mock.calls[0][2]).toBe(120_000);

      getSpy.mockClear();
      setSpy.mockClear();

      // Second find -> cache hit
      await repo.find({ name: "uses-default" });
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(setSpy).not.toHaveBeenCalled();
    });
  });

  describe("relation exclusion", () => {
    it("should skip cache when relations option is non-empty", async () => {
      const repo = source.repository(CachedItem);
      const getSpy = jest.spyOn(adapter, "get");
      const setSpy = jest.spyOn(adapter, "set");

      await repo.save({ name: "rel-test", value: 0 });

      getSpy.mockClear();
      setSpy.mockClear();

      // CachedItem has no relations, so the inner driver will throw for any relation name.
      // The point of this test is to verify the cache adapter is NOT consulted when
      // relations are requested — the CachingRepository skips cache entirely.
      await expect(
        repo.find({ name: "rel-test" }, { relations: ["name" as any] }),
      ).rejects.toThrow();

      expect(getSpy).not.toHaveBeenCalled();
      expect(setSpy).not.toHaveBeenCalled();
    });
  });

  describe("findAndCount caching", () => {
    it("should cache findAndCount results and invalidate on write", async () => {
      const repo = source.repository(CachedItem);
      const getSpy = jest.spyOn(adapter, "get");
      const setSpy = jest.spyOn(adapter, "set");

      await repo.save({ name: "fac-item", value: 1 });
      await repo.save({ name: "fac-item", value: 2 });

      getSpy.mockClear();
      setSpy.mockClear();

      // First findAndCount -> cache miss
      const [items1, count1] = await repo.findAndCount({ name: "fac-item" });
      expect(items1).toHaveLength(2);
      expect(count1).toBe(2);
      expect(setSpy).toHaveBeenCalledTimes(1);

      getSpy.mockClear();
      setSpy.mockClear();

      // Second findAndCount -> cache hit
      const [items2, count2] = await repo.findAndCount({ name: "fac-item" });
      expect(items2).toHaveLength(2);
      expect(count2).toBe(2);
      expect(setSpy).not.toHaveBeenCalled();

      // Write invalidates
      await repo.save({ name: "fac-item", value: 3 });

      getSpy.mockClear();
      setSpy.mockClear();

      // Third findAndCount -> cache miss (fresh data)
      const [items3, count3] = await repo.findAndCount({ name: "fac-item" });
      expect(items3).toHaveLength(3);
      expect(count3).toBe(3);
      expect(setSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("Date round-trip", () => {
    it("should preserve Date instanceof through cache serialization", async () => {
      const repo = source.repository(CachedItem);

      const saved = await repo.save({ name: "date-test", value: 0 });

      // First find -> cache miss, stores in cache
      const first = await repo.findOne({ id: saved.id });
      expect(first).not.toBeNull();
      expect(first!.createdAt).toBeInstanceOf(Date);
      expect(first!.updatedAt).toBeInstanceOf(Date);

      // Second find -> cache hit, deserialised from JSON
      const second = await repo.findOne({ id: saved.id });
      expect(second).not.toBeNull();
      expect(second!.createdAt).toBeInstanceOf(Date);
      expect(second!.updatedAt).toBeInstanceOf(Date);

      // Values should be equivalent
      expect(second!.createdAt.getTime()).toBe(first!.createdAt.getTime());
      expect(second!.updatedAt.getTime()).toBe(first!.updatedAt.getTime());
    });
  });

  describe("negative caching", () => {
    it("should cache null findOne result", async () => {
      const repo = source.repository(CachedItem);
      const getSpy = jest.spyOn(adapter, "get");
      const setSpy = jest.spyOn(adapter, "set");

      getSpy.mockClear();
      setSpy.mockClear();

      // findOne for non-existent entity -> cache miss, stores empty array
      const first = await repo.findOne({ name: "does-not-exist-negative-caching" });
      expect(first).toBeNull();
      expect(setSpy).toHaveBeenCalledTimes(1);

      getSpy.mockClear();
      setSpy.mockClear();

      // Second findOne -> cache hit, returns null
      const second = await repo.findOne({ name: "does-not-exist-negative-caching" });
      expect(second).toBeNull();
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(setSpy).not.toHaveBeenCalled();
    });
  });

  describe("@AfterLoad fires on cache read", () => {
    it("should invoke afterLoad hook on both cache miss and cache hit", async () => {
      const repo = source.repository(HookedItem);

      const saved = await repo.save({ label: "hook-test" });
      afterLoadSpy.mockClear();

      // First find -> cache miss -> AfterLoad fires once from the inner driver's hydration.
      // On a cache MISS, CachingRepository returns the driver's result directly (no deserialization).
      const first = await repo.findOne({ id: saved.id });
      expect(first).not.toBeNull();
      expect(afterLoadSpy).toHaveBeenCalledTimes(1);

      afterLoadSpy.mockClear();

      // Second find -> cache hit -> AfterLoad fires once from CachingRepository.deserializeEntities
      const second = await repo.findOne({ id: saved.id });
      expect(second).not.toBeNull();
      expect(afterLoadSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("adapter failure degradation", () => {
    it("should fall back to inner repo when adapter.get throws", async () => {
      const repo = source.repository(CachedItem);

      const saved = await repo.save({ name: "degrade-test", value: 0 });

      // Populate cache first
      await repo.find({ name: "degrade-test" });

      // Mock adapter.get to throw
      const getSpy = jest
        .spyOn(adapter, "get")
        .mockRejectedValue(new Error("Redis down"));

      // find should still work — falls back to inner
      const result = await repo.find({ name: "degrade-test" });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(saved.id);

      getSpy.mockRestore();
    });

    it("should still work when adapter.set throws", async () => {
      const repo = source.repository(CachedItem);

      const saved = await repo.save({ name: "set-fail-test", value: 0 });

      // Mock adapter.set to throw
      const setSpy = jest
        .spyOn(adapter, "set")
        .mockRejectedValue(new Error("Redis down"));

      // find should still work — just can't cache
      const result = await repo.find({ name: "set-fail-test" });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(saved.id);

      setSpy.mockRestore();
    });
  });

  describe("count() caching", () => {
    it("should cache count results and invalidate on write", async () => {
      const repo = source.repository(CachedItem);
      const getSpy = jest.spyOn(adapter, "get");
      const setSpy = jest.spyOn(adapter, "set");

      await repo.save({ name: "count-test", value: 1 });
      await repo.save({ name: "count-test", value: 2 });

      getSpy.mockClear();
      setSpy.mockClear();

      // First count -> cache miss
      const count1 = await repo.count({ name: "count-test" });
      expect(count1).toBe(2);
      expect(setSpy).toHaveBeenCalledTimes(1);

      getSpy.mockClear();
      setSpy.mockClear();

      // Second count -> cache hit
      const count2 = await repo.count({ name: "count-test" });
      expect(count2).toBe(2);
      expect(setSpy).not.toHaveBeenCalled();

      // Write invalidates
      await repo.save({ name: "count-test", value: 3 });

      getSpy.mockClear();
      setSpy.mockClear();

      // Third count -> cache miss (fresh)
      const count3 = await repo.count({ name: "count-test" });
      expect(count3).toBe(3);
      expect(setSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("exists() caching", () => {
    it("should cache exists results", async () => {
      const repo = source.repository(CachedItem);
      const getSpy = jest.spyOn(adapter, "get");
      const setSpy = jest.spyOn(adapter, "set");

      const saved = await repo.save({ name: "exists-test", value: 0 });

      getSpy.mockClear();
      setSpy.mockClear();

      // First exists -> cache miss
      const exists1 = await repo.exists({ id: saved.id });
      expect(exists1).toBe(true);
      expect(setSpy).toHaveBeenCalledTimes(1);

      getSpy.mockClear();
      setSpy.mockClear();

      // Second exists -> cache hit
      const exists2 = await repo.exists({ id: saved.id });
      expect(exists2).toBe(true);
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(setSpy).not.toHaveBeenCalled();
    });

    it("should cache false exists result", async () => {
      const repo = source.repository(CachedItem);
      const setSpy = jest.spyOn(adapter, "set");

      setSpy.mockClear();

      const exists = await repo.exists({ name: "no-such-entity-exists-test" });
      expect(exists).toBe(false);
      expect(setSpy).toHaveBeenCalledTimes(1);

      setSpy.mockClear();

      const exists2 = await repo.exists({ name: "no-such-entity-exists-test" });
      expect(exists2).toBe(false);
      expect(setSpy).not.toHaveBeenCalled();
    });
  });

  describe("lock option skips cache", () => {
    it("should bypass cache when lock option is set", async () => {
      const repo = source.repository(CachedItem);
      const getSpy = jest.spyOn(adapter, "get");
      const setSpy = jest.spyOn(adapter, "set");

      await repo.save({ name: "lock-test", value: 0 });

      getSpy.mockClear();
      setSpy.mockClear();

      await repo.find({ name: "lock-test" }, { lock: "pessimistic_read" });
      expect(getSpy).not.toHaveBeenCalled();
      expect(setSpy).not.toHaveBeenCalled();
    });
  });

  describe("clear() invalidates cache", () => {
    it("should invalidate cache after clear", async () => {
      const repo = source.repository(CachedItem);

      await repo.save({ name: "clear-test", value: 0 });

      // Populate cache
      const before = await repo.count({ name: "clear-test" });
      expect(before).toBe(1);

      const setSpy = jest.spyOn(adapter, "set");

      // Clear all records
      await repo.clear();

      setSpy.mockClear();

      // Count should now be 0 (fresh from DB)
      const after = await repo.count({ name: "clear-test" });
      expect(after).toBe(0);
      // set was called (cache was re-populated with the fresh result)
      expect(setSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("no cache adapter", () => {
    it("should work without cache adapter configured", async () => {
      const uncachedSource = new ProteusSource({
        driver: "memory",
        entities: [CachedItem],
        logger: createMockLogger(),
      });

      await uncachedSource.connect();
      await uncachedSource.setup();

      const repo = uncachedSource.repository(CachedItem);
      const saved = await repo.save({ name: "no-adapter", value: 0 });
      const found = await repo.findOne({ id: saved.id });
      expect(found).not.toBeNull();
      expect(found!.name).toBe("no-adapter");
    });
  });

  describe("cache key isolation", () => {
    it("should use separate cache keys for different criteria", async () => {
      const repo = source.repository(CachedItem);

      await repo.save({ name: "iso-a", value: 1 });
      await repo.save({ name: "iso-b", value: 2 });

      const resultA = await repo.find({ name: "iso-a" });
      const resultB = await repo.find({ name: "iso-b" });

      expect(resultA).toHaveLength(1);
      expect(resultA[0].name).toBe("iso-a");
      expect(resultB).toHaveLength(1);
      expect(resultB[0].name).toBe("iso-b");

      // Verify they are independently cached
      const getSpy = jest.spyOn(adapter, "get");

      const cachedA = await repo.find({ name: "iso-a" });
      const cachedB = await repo.find({ name: "iso-b" });

      expect(cachedA[0].name).toBe("iso-a");
      expect(cachedB[0].name).toBe("iso-b");

      // Both calls should have hit cache (get returned non-null)
      expect(getSpy).toHaveBeenCalledTimes(2);
    });

    it("should use separate cache keys for different operations", async () => {
      const repo = source.repository(CachedItem);

      await repo.save({ name: "op-test", value: 1 });

      const getSpy = jest.spyOn(adapter, "get");
      const setSpy = jest.spyOn(adapter, "set");

      getSpy.mockClear();
      setSpy.mockClear();

      // find, findAndCount, count all use different operations in the key
      await repo.find({ name: "op-test" });
      await repo.findAndCount({ name: "op-test" });
      await repo.count({ name: "op-test" });

      // Each should have called set once (three cache misses for different keys)
      expect(setSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe("transaction bypass", () => {
    it("should not use cache inside transactions", async () => {
      const repo = source.repository(CachedItem);
      const entity = repo.create({ name: "tx-test", value: 0 });
      await repo.insert(entity);

      // Find it (populates cache)
      await repo.find({ name: "tx-test" });

      const getSpy = jest.spyOn(adapter, "get");
      const setSpy = jest.spyOn(adapter, "set");

      getSpy.mockClear();
      setSpy.mockClear();

      // Inside transaction, repos are created by the driver directly
      // (not via ProteusSource.repository()), so they bypass CachingRepository.
      await source.transaction(async (ctx) => {
        const txRepo = ctx.repository(CachedItem);
        await txRepo.find({ name: "tx-test" });
      });

      // Verify adapter was not called during the transaction
      expect(getSpy).not.toHaveBeenCalled();
      expect(setSpy).not.toHaveBeenCalled();
    });
  });

  describe("findOneOrFail with cache", () => {
    it("should cache findOneOrFail results", async () => {
      const repo = source.repository(CachedItem);
      const setSpy = jest.spyOn(adapter, "set");

      const saved = await repo.save({ name: "fail-test", value: 0 });

      setSpy.mockClear();

      // First call -> cache miss, set
      const first = await repo.findOneOrFail({ id: saved.id });
      expect(first.name).toBe("fail-test");
      expect(setSpy).toHaveBeenCalledTimes(1);

      setSpy.mockClear();

      // Second call -> cache hit, no set
      const second = await repo.findOneOrFail({ id: saved.id });
      expect(second.name).toBe("fail-test");
      expect(setSpy).not.toHaveBeenCalled();
    });
  });
});
