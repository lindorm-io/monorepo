import { buildCacheKey, buildCachePrefix } from "./build-cache-key.js";
import { describe, expect, test } from "vitest";

describe("buildCacheKey", () => {
  const base = {
    namespace: "app",
    entityName: "User",
    operation: "find",
  };

  test("should produce deterministic keys for identical inputs", () => {
    const a = buildCacheKey({ ...base, criteria: { id: "abc" } });
    const b = buildCacheKey({ ...base, criteria: { id: "abc" } });
    expect(a).toBe(b);
    expect(a).toMatchSnapshot();
  });

  test("should produce the same key regardless of object key order in criteria", () => {
    const a = buildCacheKey({ ...base, criteria: { a: 1, b: 2 } });
    const b = buildCacheKey({ ...base, criteria: { b: 2, a: 1 } });
    expect(a).toBe(b);
  });

  test("should produce different keys for different operations", () => {
    const a = buildCacheKey({ ...base, operation: "find" });
    const b = buildCacheKey({ ...base, operation: "findOne" });
    expect(a).not.toBe(b);
  });

  test("should produce the same key regardless of relations array order", () => {
    const a = buildCacheKey({ ...base, options: { relations: ["posts", "comments"] } });
    const b = buildCacheKey({ ...base, options: { relations: ["comments", "posts"] } });
    expect(a).toBe(b);
  });

  test("should produce the same key regardless of select array order", () => {
    const a = buildCacheKey({ ...base, options: { select: ["name", "email"] } });
    const b = buildCacheKey({ ...base, options: { select: ["email", "name"] } });
    expect(a).toBe(b);
  });

  test("should strip cache option from key computation", () => {
    const a = buildCacheKey({ ...base, options: { limit: 10 } });
    const b = buildCacheKey({ ...base, options: { limit: 10, cache: true } });
    const c = buildCacheKey({
      ...base,
      options: { limit: 10, cache: { ttl: "5 Minutes" } },
    });
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  test("should strip lock option from key computation", () => {
    const a = buildCacheKey({ ...base, options: { limit: 10 } });
    const b = buildCacheKey({
      ...base,
      options: { limit: 10, lock: "pessimistic_read" },
    });
    expect(a).toBe(b);
  });

  test("should produce consistent keys for Date values", () => {
    const date = new Date("2024-06-15T12:00:00.000Z");
    const a = buildCacheKey({ ...base, criteria: { createdAt: date } });
    const b = buildCacheKey({ ...base, criteria: { createdAt: date } });
    expect(a).toBe(b);
    expect(a).toMatchSnapshot();
  });

  test("should produce consistent keys for BigInt values", () => {
    const a = buildCacheKey({ ...base, criteria: { count: BigInt(42) } });
    const b = buildCacheKey({ ...base, criteria: { count: BigInt(42) } });
    expect(a).toBe(b);
  });

  test("should produce a valid key when namespace is null", () => {
    const key = buildCacheKey({ ...base, namespace: null });
    expect(key).toMatchSnapshot();
  });

  test("should produce different keys for different criteria values", () => {
    const a = buildCacheKey({ ...base, criteria: { id: "abc" } });
    const b = buildCacheKey({ ...base, criteria: { id: "def" } });
    expect(a).not.toBe(b);
  });

  test("should handle deeply nested criteria deterministically", () => {
    const a = buildCacheKey({
      ...base,
      criteria: { meta: { nested: { z: 3, a: 1 } } },
    });
    const b = buildCacheKey({
      ...base,
      criteria: { meta: { nested: { a: 1, z: 3 } } },
    });
    expect(a).toBe(b);
  });

  test("should handle undefined criteria and options", () => {
    const key = buildCacheKey({ ...base });
    expect(key).toMatchSnapshot();
  });

  test("should preserve array order in criteria (order matters)", () => {
    const a = buildCacheKey({ ...base, criteria: { ids: ["a", "b", "c"] } });
    const b = buildCacheKey({ ...base, criteria: { ids: ["c", "b", "a"] } });
    expect(a).not.toBe(b);
  });

  test("should produce a stable key for Map criteria (entries converted to sorted object)", () => {
    const mapA = new Map([
      ["foo", "bar"],
      ["baz", "qux"],
    ]);
    const mapB = new Map([
      ["foo", "bar"],
      ["baz", "qux"],
    ]);
    const a = buildCacheKey({ ...base, criteria: mapA });
    const b = buildCacheKey({ ...base, criteria: mapB });
    expect(a).toBe(b);
    expect(a).toMatchSnapshot();
  });

  test("should produce different keys for Maps with different entries", () => {
    const mapA = new Map([["foo", "bar"]]);
    const mapB = new Map([["foo", "different"]]);
    const a = buildCacheKey({ ...base, criteria: mapA });
    const b = buildCacheKey({ ...base, criteria: mapB });
    expect(a).not.toBe(b);
  });

  test("should produce a stable key for Set criteria (converted to array)", () => {
    const setA = new Set(["x", "y", "z"]);
    const setB = new Set(["x", "y", "z"]);
    const a = buildCacheKey({ ...base, criteria: setA });
    const b = buildCacheKey({ ...base, criteria: setB });
    expect(a).toBe(b);
    expect(a).toMatchSnapshot();
  });

  test("should produce different keys for Sets with different values", () => {
    const setA = new Set(["x", "y"]);
    const setB = new Set(["a", "b"]);
    const a = buildCacheKey({ ...base, criteria: setA });
    const b = buildCacheKey({ ...base, criteria: setB });
    expect(a).not.toBe(b);
  });

  test("should produce a stable key for RegExp criteria (converted to string)", () => {
    const regexpA = /^foo\d+$/i;
    const regexpB = /^foo\d+$/i;
    const a = buildCacheKey({ ...base, criteria: regexpA });
    const b = buildCacheKey({ ...base, criteria: regexpB });
    expect(a).toBe(b);
    expect(a).toMatchSnapshot();
  });

  test("should produce different keys for different RegExp patterns", () => {
    const regexpA = /^foo$/i;
    const regexpB = /^bar$/i;
    const a = buildCacheKey({ ...base, criteria: regexpA });
    const b = buildCacheKey({ ...base, criteria: regexpB });
    expect(a).not.toBe(b);
  });
});

describe("buildCachePrefix", () => {
  test("should return correct prefix with namespace", () => {
    expect(buildCachePrefix("app", "User")).toMatchSnapshot();
  });

  test("should return correct prefix with null namespace", () => {
    expect(buildCachePrefix(null, "User")).toMatchSnapshot();
  });
});
