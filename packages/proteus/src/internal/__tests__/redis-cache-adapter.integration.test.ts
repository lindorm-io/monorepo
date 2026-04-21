import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
// Redis Cache Adapter Integration Tests
//
// Exercises RedisCacheAdapter against a real Redis instance (via docker-compose).
// Uses Redis DB 1 (isolated from other tests on DB 0) and FLUSHDB for clean state.

import Redis from "ioredis";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { RedisCacheAdapter } from "../../classes/RedisCacheAdapter.js";
import { ProteusSource } from "../../classes/ProteusSource.js";
import {
  Cache,
  CreateDateField,
  Entity,
  Field,
  Nullable,
  PrimaryKeyField,
  UpdateDateField,
  VersionField,
} from "../../decorators/index.js";

vi.setConfig({ testTimeout: 30_000 });

// ─── Test Entity for full integration test ───────────────────────────────────

@Entity({ name: "RedisCachedProduct" })
@Cache("1 Minute")
class RedisCachedProduct {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @Nullable()
  @Field("integer")
  stock!: number | null;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;
}

// ─── Setup ───────────────────────────────────────────────────────────────────

let client: Redis;

beforeAll(async () => {
  client = new Redis({
    host: process.env.REDIS_HOST ?? "127.0.0.1",
    port: Number(process.env.REDIS_PORT ?? 6379),
    db: 1,
    lazyConnect: true,
  });
  await client.connect();
});

afterAll(async () => {
  await client.quit();
  client.disconnect();
});

beforeEach(async () => {
  await client.flushdb();
});

// ─── Adapter-level tests ─────────────────────────────────────────────────────

describe("RedisCacheAdapter", () => {
  let adapter: RedisCacheAdapter;

  beforeEach(() => {
    adapter = new RedisCacheAdapter({ client });
  });

  describe("round-trip", () => {
    it("should return the stored value from get after set", async () => {
      await adapter.set("key", "value", 60_000);
      const result = await adapter.get("key");
      expect(result).toBe("value");
    });
  });

  describe("TTL expiry", () => {
    it("should set a positive PTTL when storing a value with a ttlMs > 0", async () => {
      await adapter.set("key", "value", 60_000);
      const pttl = await client.pttl("key");
      // PTTL should be positive and at most the requested TTL
      expect(pttl).toBeGreaterThan(0);
      expect(pttl).toBeLessThanOrEqual(60_000);
    });
  });

  describe("cache miss", () => {
    it("should return null for a key that was never set", async () => {
      const result = await adapter.get("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("del", () => {
    it("should remove a key so that get returns null afterwards", async () => {
      await adapter.set("to-delete", "hello", 60_000);
      await adapter.del("to-delete");
      const result = await adapter.get("to-delete");
      expect(result).toBeNull();
    });
  });

  describe("delByPrefix", () => {
    it("should delete only keys matching the prefix and leave others intact", async () => {
      await adapter.set("cache:User:find:hash1", "a", 60_000);
      await adapter.set("cache:User:find:hash2", "b", 60_000);
      await adapter.set("cache:User:find:hash3", "c", 60_000);
      await adapter.set("cache:User:find:hash4", "d", 60_000);
      await adapter.set("cache:User:find:hash5", "e", 60_000);
      await adapter.set("cache:Order:find:hash1", "x", 60_000);
      await adapter.set("cache:Order:find:hash2", "y", 60_000);

      await adapter.delByPrefix("cache:User:");

      // All User keys should be gone
      expect(await adapter.get("cache:User:find:hash1")).toBeNull();
      expect(await adapter.get("cache:User:find:hash2")).toBeNull();
      expect(await adapter.get("cache:User:find:hash3")).toBeNull();
      expect(await adapter.get("cache:User:find:hash4")).toBeNull();
      expect(await adapter.get("cache:User:find:hash5")).toBeNull();

      // Order keys should still be present
      expect(await adapter.get("cache:Order:find:hash1")).toBe("x");
      expect(await adapter.get("cache:Order:find:hash2")).toBe("y");
    });

    it("should delete all keys when 600+ keys are set (forces multiple SCAN iterations)", async () => {
      const count = 620;
      // Use a small scanCount to force multiple SCAN iterations in the Lua script
      const batchAdapter = new RedisCacheAdapter({ client, scanCount: 100 });

      const pipeline = client.pipeline();
      for (let i = 0; i < count; i++) {
        pipeline.set(`bulk:item:${i}`, String(i), "PX", 60_000);
      }
      await pipeline.exec();

      await batchAdapter.delByPrefix("bulk:item:");

      // Verify none remain by checking DBSIZE (we started fresh from FLUSHDB)
      const remaining = await client.dbsize();
      expect(remaining).toBe(0);
    });

    it("should not throw when no keys match the prefix", async () => {
      await expect(adapter.delByPrefix("cache:NoSuchEntity:")).resolves.toBeUndefined();
    });
  });

  describe("zero ttlMs", () => {
    it("should not store the value when ttlMs is 0", async () => {
      await adapter.set("key", "value", 0);
      const result = await adapter.get("key");
      expect(result).toBeNull();
    });
  });

  describe("negative ttlMs", () => {
    it("should throw when ttlMs is negative", async () => {
      await expect(adapter.set("key", "value", -1)).rejects.toThrow("Invalid ttlMs: -1");
    });
  });

  describe("keyPrefix isolation", () => {
    it("should isolate keys between two adapters with different keyPrefixes", async () => {
      const app1 = new RedisCacheAdapter({ client, keyPrefix: "app1:" });
      const app2 = new RedisCacheAdapter({ client, keyPrefix: "app2:" });

      await app1.set("user:profile", "app1-data", 60_000);
      await app2.set("user:profile", "app2-data", 60_000);

      // Each adapter only sees its own data
      expect(await app1.get("user:profile")).toBe("app1-data");
      expect(await app2.get("user:profile")).toBe("app2-data");

      // Raw Redis keys confirm both exist separately
      const rawApp1 = await client.get("app1:user:profile");
      const rawApp2 = await client.get("app2:user:profile");
      expect(rawApp1).toBe("app1-data");
      expect(rawApp2).toBe("app2-data");
    });

    it("should scope delByPrefix to the keyPrefix namespace", async () => {
      const app1 = new RedisCacheAdapter({ client, keyPrefix: "app1:" });
      const app2 = new RedisCacheAdapter({ client, keyPrefix: "app2:" });

      await app1.set("cache:Item:find:hash1", "v1", 60_000);
      await app2.set("cache:Item:find:hash1", "v2", 60_000);

      // Deleting by prefix on app1 should not affect app2
      await app1.delByPrefix("cache:Item:");

      expect(await app1.get("cache:Item:find:hash1")).toBeNull();
      expect(await app2.get("cache:Item:find:hash1")).toBe("v2");
    });
  });

  describe("stored values snapshot", () => {
    it("should store and retrieve complex JSON strings faithfully", async () => {
      const payload = JSON.stringify([
        { id: "abc-123", name: "Widget", stock: 42, version: 1 },
        { id: "def-456", name: "Gadget", stock: null, version: 3 },
      ]);

      await adapter.set("cache:Product:find:complex-hash", payload, 60_000);
      const result = await adapter.get("cache:Product:find:complex-hash");

      expect(JSON.parse(result!)).toMatchSnapshot();
    });
  });
});

// ─── Full CachingRepository integration ──────────────────────────────────────

describe("RedisCacheAdapter: full CachingRepository integration", () => {
  let adapter: RedisCacheAdapter;
  let source: ProteusSource;

  beforeAll(async () => {
    adapter = new RedisCacheAdapter({ client });

    source = new ProteusSource({
      driver: "memory",
      entities: [RedisCachedProduct],
      cache: { adapter, ttl: "1 Minute" },
      logger: createMockLogger(),
    });

    await source.connect();
    await source.setup();
  });

  afterAll(async () => {
    await source.disconnect();
  });

  it("should serve a cache miss on first find, cache hit on second, and miss again after insert", async () => {
    const repo = source.repository(RedisCachedProduct);
    const getSpy = vi.spyOn(adapter, "get");
    const setSpy = vi.spyOn(adapter, "set");
    const delByPrefixSpy = vi.spyOn(adapter, "delByPrefix");

    // ── Step 1: first find is a cache miss ──────────────────────────────────
    const first = await repo.find({});

    expect(first).toHaveLength(0);
    // get was called once (miss), then set was called to store the empty result
    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledTimes(1);

    // The set call should have stored something into Redis
    const storedKey = setSpy.mock.calls[0][0];
    const storedValue = setSpy.mock.calls[0][1];
    const storedTtl = setSpy.mock.calls[0][2];
    expect(storedKey).toMatchSnapshot();
    expect(JSON.parse(storedValue)).toMatchSnapshot();
    expect(storedTtl).toBe(60_000);

    getSpy.mockClear();
    setSpy.mockClear();

    // ── Step 2: second find is a cache hit ──────────────────────────────────
    const second = await repo.find({});

    expect(second).toHaveLength(0);
    // get was called once and returned a non-null value (cache hit)
    expect(getSpy).toHaveBeenCalledTimes(1);
    // set should NOT have been called on a cache hit
    expect(setSpy).not.toHaveBeenCalled();

    getSpy.mockClear();
    setSpy.mockClear();
    delByPrefixSpy.mockClear();

    // ── Step 3: insert triggers cache invalidation ──────────────────────────
    await repo.insert(repo.create({ name: "Widget A", stock: 10 }));

    // delByPrefix should have been called to invalidate the entity prefix
    expect(delByPrefixSpy).toHaveBeenCalledTimes(1);
    const invalidatedPrefix = delByPrefixSpy.mock.calls[0][0];
    expect(invalidatedPrefix).toMatchSnapshot();

    getSpy.mockClear();
    setSpy.mockClear();
    delByPrefixSpy.mockClear();

    // ── Step 4: third find is a cache miss again (invalidated) ──────────────
    const third = await repo.find({});

    expect(third).toHaveLength(1);
    expect(third[0].name).toBe("Widget A");
    // cache was missed again (get returned null) and the result was re-stored
    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledTimes(1);
  });
});
