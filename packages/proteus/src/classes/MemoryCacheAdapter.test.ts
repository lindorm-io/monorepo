import { MemoryCacheAdapter } from "./MemoryCacheAdapter";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("MemoryCacheAdapter", () => {
  let adapter: MemoryCacheAdapter;

  beforeEach(() => {
    adapter = new MemoryCacheAdapter({ maxEntries: 3 });
    vi.restoreAllMocks();
  });

  describe("get", () => {
    test("should return null for cache miss", async () => {
      expect(await adapter.get("nonexistent")).toBeNull();
    });

    test("should return stored value for cache hit", async () => {
      await adapter.set("key1", "value1", 60000);
      expect(await adapter.get("key1")).toBe("value1");
    });

    test("should return null and evict entry after TTL expires", async () => {
      const now = 1000000;
      vi.spyOn(Date, "now").mockReturnValue(now);

      await adapter.set("key1", "value1", 5000);

      // Still valid at now + 4999
      vi.spyOn(Date, "now").mockReturnValue(now + 4999);
      expect(await adapter.get("key1")).toBe("value1");

      // Expired at now + 5000
      vi.spyOn(Date, "now").mockReturnValue(now + 5000);
      expect(await adapter.get("key1")).toBeNull();

      // Confirm entry is gone (second get also returns null)
      expect(await adapter.get("key1")).toBeNull();
    });
  });

  describe("set", () => {
    test("should overwrite value for existing key", async () => {
      await adapter.set("key1", "first", 60000);
      await adapter.set("key1", "second", 60000);
      expect(await adapter.get("key1")).toBe("second");
    });

    test("should not store when ttlMs is 0 (zero TTL means don't cache)", async () => {
      await adapter.set("key1", "value1", 0);

      expect(await adapter.get("key1")).toBeNull();
    });

    test("should throw when ttlMs is negative", async () => {
      await expect(adapter.set("key1", "value1", -1)).rejects.toThrow(
        "Invalid ttlMs: -1",
      );
    });
  });

  describe("del", () => {
    test("should remove a specific key", async () => {
      await adapter.set("key1", "value1", 60000);
      await adapter.set("key2", "value2", 60000);

      await adapter.del("key1");

      expect(await adapter.get("key1")).toBeNull();
      expect(await adapter.get("key2")).toBe("value2");
    });
  });

  describe("delByPrefix", () => {
    test("should remove matching keys and preserve non-matching", async () => {
      await adapter.set("user:1", "alice", 60000);
      await adapter.set("user:2", "bob", 60000);
      await adapter.set("post:1", "hello", 60000);

      await adapter.delByPrefix("user:");

      expect(await adapter.get("user:1")).toBeNull();
      expect(await adapter.get("user:2")).toBeNull();
      expect(await adapter.get("post:1")).toBe("hello");
    });
  });

  describe("LRU eviction", () => {
    test("should evict oldest entry when maxEntries exceeded", async () => {
      await adapter.set("a", "1", 60000);
      await adapter.set("b", "2", 60000);
      await adapter.set("c", "3", 60000);

      // Cache is full (maxEntries=3). Adding "d" should evict "a" (oldest).
      await adapter.set("d", "4", 60000);

      expect(await adapter.get("a")).toBeNull();
      expect(await adapter.get("b")).toBe("2");
      expect(await adapter.get("c")).toBe("3");
      expect(await adapter.get("d")).toBe("4");
    });

    test("should refresh LRU position when re-setting existing key", async () => {
      await adapter.set("a", "1", 60000);
      await adapter.set("b", "2", 60000);
      await adapter.set("c", "3", 60000);

      // Re-set "a" — moves it to newest position
      await adapter.set("a", "1-updated", 60000);

      // Now "b" is oldest. Adding "d" should evict "b", not "a".
      await adapter.set("d", "4", 60000);

      expect(await adapter.get("a")).toBe("1-updated");
      expect(await adapter.get("b")).toBeNull();
      expect(await adapter.get("c")).toBe("3");
      expect(await adapter.get("d")).toBe("4");
    });

    test("should promote key to newest position on get (read refreshes LRU order)", async () => {
      await adapter.set("a", "1", 60000);
      await adapter.set("b", "2", 60000);
      await adapter.set("c", "3", 60000);

      // Read "a" — promotes it to newest, making "b" the oldest
      await adapter.get("a");

      // Adding "d" should evict "b" (oldest), not "a" (recently read)
      await adapter.set("d", "4", 60000);

      expect(await adapter.get("a")).toBe("1");
      expect(await adapter.get("b")).toBeNull(); // evicted
      expect(await adapter.get("c")).toBe("3");
      expect(await adapter.get("d")).toBe("4");
    });

    test("should not evict when maxEntries is 0 (unlimited)", async () => {
      const unlimited = new MemoryCacheAdapter({ maxEntries: 0 });

      for (let i = 0; i < 50; i++) {
        await unlimited.set(`key:${i}`, `value:${i}`, 60000);
      }

      // All 50 entries should still be present
      for (let i = 0; i < 50; i++) {
        expect(await unlimited.get(`key:${i}`)).toBe(`value:${i}`);
      }
    });
  });
});
