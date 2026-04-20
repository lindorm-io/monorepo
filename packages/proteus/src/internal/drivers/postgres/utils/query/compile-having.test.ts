import { makeField } from "../../../../__fixtures__/make-field";
import type { EntityMetadata } from "../../../../entity/types/metadata";
import type { PredicateEntry, RawWhereEntry } from "../../../../types/query";
import { compileHaving } from "./compile-having";
import { describe, expect, test } from "vitest";

const metadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "orders",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("status", { type: "string" }),
    makeField("amount", { type: "float" }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

describe("compileHaving", () => {
  // Case 1: Both empty arrays — returns empty string immediately
  test("should return empty string when both entries and rawEntries are empty", () => {
    const params: Array<unknown> = [];
    const result = compileHaving([], [], metadata, "t0", params);
    expect(result).toBe("");
    expect(params).toEqual([]);
  });

  // Case 2: Single typed predicate with "and" conjunction
  test("should compile a single typed predicate (first clause has no conjunction prefix)", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { status: "active" }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileHaving(entries, [], metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["active"]);
  });

  // Case 3: Multiple typed predicates — AND and OR conjunctions
  test("should compile multiple typed predicates with AND and OR conjunctions", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { status: "active" }, conjunction: "and" },
      { predicate: { amount: { $gte: 100 } }, conjunction: "and" },
      { predicate: { status: "pending" }, conjunction: "or" },
    ];
    const params: Array<unknown> = [];
    const result = compileHaving(entries, [], metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["active", 100, "pending"]);
  });

  // Case 4: Single raw HAVING entry — inlines SQL with reindexed params (no offset)
  test("should compile a single raw HAVING entry with its params starting at $1", () => {
    const rawEntries: Array<RawWhereEntry> = [
      { sql: "COUNT(*) > $1", params: [5], conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileHaving([], rawEntries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([5]);
  });

  // Case 5: Multiple raw HAVING entries with mixed conjunctions
  test("should compile multiple raw HAVING entries with mixed AND/OR conjunctions", () => {
    const rawEntries: Array<RawWhereEntry> = [
      { sql: "COUNT(*) > $1", params: [5], conjunction: "and" },
      { sql: "SUM(amount) < $1", params: [1000], conjunction: "and" },
      { sql: "MAX(amount) > $1", params: [500], conjunction: "or" },
    ];
    const params: Array<unknown> = [];
    const result = compileHaving([], rawEntries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([5, 1000, 500]);
  });

  // Case 6: Mix of typed and raw entries
  test("should compile a mix of typed predicates and raw HAVING entries", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { status: "active" }, conjunction: "and" },
    ];
    const rawEntries: Array<RawWhereEntry> = [
      { sql: "COUNT(*) > $1", params: [10], conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileHaving(entries, rawEntries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["active", 10]);
  });

  // Case 7: Raw entries with existing params in the shared array (param offset)
  test("should reindex raw entry $N placeholders when shared params array already has values", () => {
    // Pre-populate params as if a WHERE clause already consumed $1
    const params: Array<unknown> = ["pre-existing"];
    const rawEntries: Array<RawWhereEntry> = [
      { sql: "COUNT(*) > $1 AND SUM(amount) < $2", params: [5, 999], conjunction: "and" },
    ];
    const result = compileHaving([], rawEntries, metadata, "t0", params);
    // $1 and $2 in the raw SQL must shift to $2 and $3 due to offset of 1
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["pre-existing", 5, 999]);
  });

  // Case 8: Typed predicates with "or" conjunction produce OR keyword
  test("should emit OR keyword for typed predicates with or conjunction", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { status: "active" }, conjunction: "and" },
      { predicate: { status: "pending" }, conjunction: "or" },
      { predicate: { status: "cancelled" }, conjunction: "or" },
    ];
    const params: Array<unknown> = [];
    const result = compileHaving(entries, [], metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["active", "pending", "cancelled"]);
  });

  // Case 9: All typed predicates resolve to empty string — returns empty string overall
  test("should return empty string when all typed predicates compile to empty (empty predicate objects)", () => {
    // An empty predicate object {} produces no parts → compilePredicate returns ""
    const entries: Array<PredicateEntry<any>> = [
      { predicate: {}, conjunction: "and" },
      { predicate: {}, conjunction: "or" },
    ];
    const params: Array<unknown> = [];
    const result = compileHaving(entries, [], metadata, "t0", params);
    expect(result).toBe("");
    expect(params).toEqual([]);
  });

  // Additional: mix of empty typed predicates and a valid raw entry
  test("should skip empty typed predicates and still include valid raw entry", () => {
    const entries: Array<PredicateEntry<any>> = [{ predicate: {}, conjunction: "and" }];
    const rawEntries: Array<RawWhereEntry> = [
      { sql: "COUNT(*) >= $1", params: [1], conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileHaving(entries, rawEntries, metadata, "t0", params);
    // Raw entry becomes the first clause (no AND prefix) because all typed ones were skipped
    expect(result).toMatchSnapshot();
    expect(params).toEqual([1]);
  });

  // Additional: raw entry following empty typed predicate uses "and" for second raw clause
  test("should join multiple raw entries — second raw uses AND when raw has 'and' conjunction after first clause", () => {
    const rawEntries: Array<RawWhereEntry> = [
      { sql: "COUNT(*) > $1", params: [3], conjunction: "and" },
      { sql: "AVG(amount) > $1", params: [50], conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileHaving([], rawEntries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([3, 50]);
  });
});

// ---------------------------------------------------------------------------
// T13 — complex typed predicates: $or and $between through HAVING path
// ---------------------------------------------------------------------------

describe("compileHaving — complex typed predicates", () => {
  // T13-a: $or nested predicate in HAVING
  test("should compile a nested $or predicate in HAVING", () => {
    // compilePredicate wraps $or sub-clauses with OR and parentheses
    const entries: Array<PredicateEntry<any>> = [
      {
        predicate: {
          $or: [{ status: "active" }, { status: "pending" }],
        },
        conjunction: "and",
      },
    ];
    const params: Array<unknown> = [];
    const result = compileHaving(entries, [], metadata, "t0", params);
    expect(result).toContain("OR");
    expect(result).toContain('"t0"."status"');
    expect(params).toEqual(["active", "pending"]);
    expect(result).toMatchSnapshot();
  });

  test("should compile $or predicate combined with a plain field condition in HAVING", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { amount: { $gte: 500 } }, conjunction: "and" },
      {
        predicate: {
          $or: [{ status: "active" }, { status: "pending" }],
        },
        conjunction: "and",
      },
    ];
    const params: Array<unknown> = [];
    const result = compileHaving(entries, [], metadata, "t0", params);
    expect(result).toContain("HAVING");
    expect(result).toContain("AND");
    expect(result).toContain("OR");
    expect(params).toEqual([500, "active", "pending"]);
    expect(result).toMatchSnapshot();
  });

  // T13-b: $between operator in HAVING
  test("should compile a $between operator in HAVING", () => {
    // compilePredicate emits "col BETWEEN $N AND $M" for $between
    const entries: Array<PredicateEntry<any>> = [
      {
        predicate: { amount: { $between: [100, 999] } },
        conjunction: "and",
      },
    ];
    const params: Array<unknown> = [];
    const result = compileHaving(entries, [], metadata, "t0", params);
    expect(result).toContain("BETWEEN");
    expect(result).toContain('"t0"."amount"');
    expect(params).toEqual([100, 999]);
    expect(result).toMatchSnapshot();
  });

  test("should compile $between with correct param indices when params array is pre-populated", () => {
    // Pre-existing params simulate a WHERE clause already added two values
    const params: Array<unknown> = ["pre1", "pre2"];
    const entries: Array<PredicateEntry<any>> = [
      {
        predicate: { amount: { $between: [200, 800] } },
        conjunction: "and",
      },
    ];
    const result = compileHaving(entries, [], metadata, "t0", params);
    // Low bound → $3, high bound → $4
    expect(result).toContain("$3");
    expect(result).toContain("$4");
    expect(params).toEqual(["pre1", "pre2", 200, 800]);
    expect(result).toMatchSnapshot();
  });

  test("should compile combined $or and $between predicates in the same HAVING clause", () => {
    const entries: Array<PredicateEntry<any>> = [
      {
        predicate: { amount: { $between: [50, 500] } },
        conjunction: "and",
      },
      {
        predicate: {
          $or: [{ status: "active" }, { status: "cancelled" }],
        },
        conjunction: "and",
      },
    ];
    const params: Array<unknown> = [];
    const result = compileHaving(entries, [], metadata, "t0", params);
    expect(result).toContain("BETWEEN");
    expect(result).toContain("OR");
    expect(params).toEqual([50, 500, "active", "cancelled"]);
    expect(result).toMatchSnapshot();
  });
});
