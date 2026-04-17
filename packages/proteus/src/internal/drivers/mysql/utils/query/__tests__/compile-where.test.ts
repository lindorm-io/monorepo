import { makeField } from "../../../../../__fixtures__/make-field";
import type { EntityMetadata } from "../../../../../entity/types/metadata";
import type { PredicateEntry } from "../../../../../types/query";
import { compileWhere } from "../compile-where";

const metadata = {
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("email", { type: "string", name: "email_address" }),
    makeField("age", { type: "integer" }),
    makeField("tags", { type: "array" }),
    makeField("score", { type: "float" }),
    makeField("data", { type: "json" }),
  ],
  relations: [],
} as unknown as EntityMetadata;

describe("compileWhere", () => {
  test("should return empty string for no predicates", () => {
    expect(compileWhere([], metadata, "t0", [])).toBe("");
  });

  test("should compile simple equality", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: "Alice" }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["Alice"]);
  });

  test("should use column name mapping", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { email: "test@test.com" }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["test@test.com"]);
  });

  test("should compile $ilike using LOWER() wrapping", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $ilike: "%alice%" } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(result).toContain("LOWER");
    expect(params).toEqual(["%alice%"]);
  });

  test("should compile $regex as REGEXP (string pattern)", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $regex: "^A.*e$" } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(result).toContain("REGEXP");
    expect(params).toEqual(["^A.*e$"]);
  });

  test("should compile $regex with RegExp object by extracting .source", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $regex: /^foo.*bar$/i } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(result).toContain("REGEXP");
    expect(params).toEqual(["(?i)^foo.*bar$"]);
  });

  test("should compile $has using JSON_CONTAINS", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { data: { $has: { key: "value" } } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(result).toContain("JSON_CONTAINS");
  });

  test("should compile $all using JSON_CONTAINS", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { tags: { $all: ["a", "b"] } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(result).toContain("JSON_CONTAINS");
  });

  test("should compile $overlap using JSON_OVERLAPS", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { tags: { $overlap: ["x", "y"] } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(result).toContain("JSON_OVERLAPS");
  });

  test("should compile $contained using reversed JSON_CONTAINS", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { tags: { $contained: ["a", "b", "c"] } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(result).toContain("JSON_CONTAINS(?,");
  });

  test("should compile $length using JSON_LENGTH", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { tags: { $length: 3 } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(result).toContain("JSON_LENGTH");
  });

  test("should compile $eq: null to IS NULL", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $eq: null } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([]);
  });

  test("should compile comparison operators", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { age: { $gt: 18, $lte: 65 } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([18, 65]);
  });

  test("should compile $in with values", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $in: ["Alice", "Bob"] } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["Alice", "Bob"]);
  });

  test("should compile empty $in to FALSE", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $in: [] } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
  });

  test("should compile $between", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { age: { $between: [18, 65] } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([18, 65]);
  });

  test("should compile $or groups", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { $or: [{ name: "Alice" }, { name: "Bob" }] }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
  });
});
