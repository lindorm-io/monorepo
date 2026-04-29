import { TtlSet } from "./TtlSet.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("TtlSet", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("add / has / delete", () => {
    it("should add and check for a value with default TTL", () => {
      const set = new TtlSet<string>("5m");
      set.add("a");

      expect(set.has("a")).toBe(true);
      expect(set.has("b")).toBe(false);
    });

    it("should delete a value", () => {
      const set = new TtlSet<string>("5m");
      set.add("a");

      expect(set.delete("a")).toBe(true);
      expect(set.has("a")).toBe(false);
      expect(set.delete("a")).toBe(false);
    });
  });

  describe("expiry with default TTL", () => {
    it("should return true before TTL elapses", () => {
      const set = new TtlSet<string>("5m");
      set.add("a");

      vi.advanceTimersByTime(4 * 60 * 1000);

      expect(set.has("a")).toBe(true);
    });

    it("should return false after TTL elapses", () => {
      const set = new TtlSet<string>("5m");
      set.add("a");

      vi.advanceTimersByTime(5 * 60 * 1000);

      expect(set.has("a")).toMatchSnapshot();
    });
  });

  describe("per-entry TTL override", () => {
    it("should use per-entry TTL instead of default", () => {
      const set = new TtlSet<string>("5m");
      set.add("short", "10s");
      set.add("long", "1h");

      vi.advanceTimersByTime(15 * 1000);

      expect(set.has("short")).toBe(false);
      expect(set.has("long")).toBe(true);
    });
  });

  describe("clear", () => {
    it("should remove all entries", () => {
      const set = new TtlSet<string>("5m");
      set.add("a");
      set.add("b");
      set.clear();

      expect(set.size).toBe(0);
      expect(set.has("a")).toBe(false);
    });
  });

  describe("size", () => {
    it("should return live count excluding expired entries", () => {
      const set = new TtlSet<string>("5m");
      set.add("a", "10s");
      set.add("b", "1h");
      set.add("c", "1h");

      vi.advanceTimersByTime(15 * 1000);

      expect(set.size).toMatchSnapshot();
    });
  });

  describe("cleanup", () => {
    it("should remove expired entries from internal store", () => {
      const set = new TtlSet<string>("10s");
      set.add("a");
      set.add("b", "1h");

      vi.advanceTimersByTime(15 * 1000);

      set.cleanup();

      expect(set.has("a")).toBe(false);
      expect(set.has("b")).toBe(true);
    });
  });

  describe("iteration", () => {
    const setup = () => {
      const set = new TtlSet<string>("1h");
      set.add("alive1");
      set.add("alive2");
      set.add("dead", "10s");

      vi.advanceTimersByTime(15 * 1000);
      return set;
    };

    it("keys() should skip expired entries", () => {
      const set = setup();
      expect([...set.keys()]).toMatchSnapshot();
    });

    it("values() should skip expired entries", () => {
      const set = setup();
      expect([...set.values()]).toMatchSnapshot();
    });

    it("entries() should skip expired entries", () => {
      const set = setup();
      expect([...set.entries()]).toMatchSnapshot();
    });

    it("forEach() should skip expired entries", () => {
      const set = setup();
      const collected: Array<[string, string]> = [];
      set.forEach((value, value2) => {
        collected.push([value, value2]);
      });
      expect(collected).toMatchSnapshot();
    });

    it("[Symbol.iterator]() should skip expired entries", () => {
      const set = setup();
      expect([...set]).toMatchSnapshot();
    });
  });

  describe("[Symbol.toStringTag]", () => {
    it("should return TtlSet", () => {
      const set = new TtlSet<string>("5m");
      expect(Object.prototype.toString.call(set)).toMatchSnapshot();
    });
  });

  describe("add returns this for chaining", () => {
    it("should support method chaining", () => {
      const set = new TtlSet<string>("5m");
      const result = set.add("a").add("b");
      expect(result).toBe(set);
      expect(set.size).toBe(2);
    });
  });
});
