import { TtlMap } from "./TtlMap";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("TtlMap", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("set / get / has / delete", () => {
    it("should store and retrieve a value with default TTL", () => {
      const map = new TtlMap<string, number>("5m");
      map.set("a", 1);

      expect(map.get("a")).toBe(1);
      expect(map.has("a")).toBe(true);
    });

    it("should return undefined for missing keys", () => {
      const map = new TtlMap<string, number>("5m");

      expect(map.get("missing")).toMatchSnapshot();
      expect(map.has("missing")).toMatchSnapshot();
    });

    it("should delete a key", () => {
      const map = new TtlMap<string, number>("5m");
      map.set("a", 1);

      expect(map.delete("a")).toBe(true);
      expect(map.get("a")).toBeUndefined();
      expect(map.delete("a")).toBe(false);
    });
  });

  describe("expiry with default TTL", () => {
    it("should return the value before TTL elapses", () => {
      const map = new TtlMap<string, number>("5m");
      map.set("a", 1);

      vi.advanceTimersByTime(4 * 60 * 1000);

      expect(map.get("a")).toBe(1);
      expect(map.has("a")).toBe(true);
    });

    it("should return undefined after TTL elapses", () => {
      const map = new TtlMap<string, number>("5m");
      map.set("a", 1);

      vi.advanceTimersByTime(5 * 60 * 1000);

      expect(map.get("a")).toMatchSnapshot();
      expect(map.has("a")).toMatchSnapshot();
    });
  });

  describe("per-entry TTL override", () => {
    it("should use per-entry TTL instead of default", () => {
      const map = new TtlMap<string, number>("5m");
      map.set("short", 1, "10s");
      map.set("long", 2, "1h");

      vi.advanceTimersByTime(15 * 1000);

      expect(map.get("short")).toBeUndefined();
      expect(map.get("long")).toBe(2);
    });
  });

  describe("clear", () => {
    it("should remove all entries", () => {
      const map = new TtlMap<string, number>("5m");
      map.set("a", 1);
      map.set("b", 2);
      map.clear();

      expect(map.size).toBe(0);
      expect(map.get("a")).toBeUndefined();
    });
  });

  describe("size", () => {
    it("should return live count excluding expired entries", () => {
      const map = new TtlMap<string, number>("5m");
      map.set("a", 1, "10s");
      map.set("b", 2, "1h");
      map.set("c", 3, "1h");

      vi.advanceTimersByTime(15 * 1000);

      expect(map.size).toMatchSnapshot();
    });
  });

  describe("cleanup", () => {
    it("should remove expired entries from internal store", () => {
      const map = new TtlMap<string, number>("10s");
      map.set("a", 1);
      map.set("b", 2, "1h");

      vi.advanceTimersByTime(15 * 1000);

      map.cleanup();

      expect(map.has("a")).toBe(false);
      expect(map.has("b")).toBe(true);
    });
  });

  describe("iteration", () => {
    const setup = () => {
      const map = new TtlMap<string, number>("1h");
      map.set("alive1", 1);
      map.set("alive2", 2);
      map.set("dead", 3, "10s");

      vi.advanceTimersByTime(15 * 1000);
      return map;
    };

    it("keys() should skip expired entries", () => {
      const map = setup();
      expect([...map.keys()]).toMatchSnapshot();
    });

    it("values() should skip expired entries", () => {
      const map = setup();
      expect([...map.values()]).toMatchSnapshot();
    });

    it("entries() should skip expired entries", () => {
      const map = setup();
      expect([...map.entries()]).toMatchSnapshot();
    });

    it("forEach() should skip expired entries", () => {
      const map = setup();
      const collected: Array<[string, number]> = [];
      map.forEach((value, key) => {
        collected.push([key, value]);
      });
      expect(collected).toMatchSnapshot();
    });

    it("[Symbol.iterator]() should skip expired entries", () => {
      const map = setup();
      expect([...map]).toMatchSnapshot();
    });
  });

  describe("[Symbol.toStringTag]", () => {
    it("should return TtlMap", () => {
      const map = new TtlMap<string, number>("5m");
      expect(Object.prototype.toString.call(map)).toMatchSnapshot();
    });
  });

  describe("set returns this for chaining", () => {
    it("should support method chaining", () => {
      const map = new TtlMap<string, number>("5m");
      const result = map.set("a", 1).set("b", 2);
      expect(result).toBe(map);
      expect(map.size).toBe(2);
    });
  });
});
