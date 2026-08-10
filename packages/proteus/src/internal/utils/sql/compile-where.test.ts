import { makeField } from "../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../../entity/types/metadata.js";
import type { PredicateEntry } from "../../types/query.js";
import { postgresDialect } from "../../drivers/postgres/utils/postgres-dialect.js";
import { mysqlDialect } from "../../drivers/mysql/utils/mysql-dialect.js";
import { sqliteDialect } from "../../drivers/sqlite/utils/sqlite-dialect.js";
import type { SqlDialect } from "./sql-dialect.js";
import { compileWhere, compilePredicate } from "./compile-where.js";
import { renderCondition } from "./compiled-condition.js";
import { describe, expect, test } from "vitest";

const dialects: Array<[string, SqlDialect]> = [
  ["postgres", postgresDialect],
  ["mysql", mysqlDialect],
  ["sqlite", sqliteDialect],
];

const metadata = {
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("email", { type: "string", name: "email_address" }),
    makeField("age", { type: "integer" }),
    makeField("tags", { type: "array" }),
    makeField("score", { type: "float" }),
    makeField("data", { type: "object" }),
  ],
  relations: [],
} as unknown as EntityMetadata;

describe.each(dialects)("compileWhere [%s]", (_name, dialect) => {
  test("should return empty string for no predicates", () => {
    expect(compileWhere([], metadata, "t0", [], dialect)).toBe("");
  });

  test("should compile simple equality", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: "Alice" }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["Alice"]);
  });

  test("should use column name mapping", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { email: "test@test.com" }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["test@test.com"]);
  });

  test("should compile $eq: null to IS NULL", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $eq: null } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([]);
  });

  test("should compile $neq: null to IS NOT NULL", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $neq: null } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([]);
  });

  test("should compile comparison operators ($gt, $lte)", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { age: { $gt: 18, $lte: 65 } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([18, 65]);
  });

  test("should compile $between", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { age: { $between: [18, 65] } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([18, 65]);
  });

  test("should compile $in with values", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $in: ["Alice", "Bob", "Charlie"] } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["Alice", "Bob", "Charlie"]);
  });

  test("should compile empty $in to FALSE", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $in: [] } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([]);
  });

  test("should compile $nin", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $nin: ["Alice"] } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["Alice"]);
  });

  test("empty $nin is a no-op", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $nin: [] } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toBe("");
    expect(params).toEqual([]);
  });

  test("should compile $like", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $like: "%alice%" } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["%alice%"]);
  });

  test("should compile $ilike", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $ilike: "%alice%" } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
  });

  test("should compile $exists: true to IS NOT NULL", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { email: { $exists: true } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
  });

  test("should compile $exists: false to IS NULL", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { email: { $exists: false } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
  });

  test("should compile $all (array containment)", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { tags: { $all: ["js", "ts"] } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
  });

  test("should compile $overlap (array overlap)", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { tags: { $overlap: ["js", "rust"] } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
  });

  test("should compile $contained (array contained-by)", () => {
    const entries: Array<PredicateEntry<any>> = [
      {
        predicate: { tags: { $contained: ["js", "ts", "rust", "go"] } },
        conjunction: "and",
      },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
  });

  test("should compile $length", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { tags: { $length: 3 } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
  });

  test("should compile $mod", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { age: { $mod: [5, 0] } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([5, 0]);
  });

  test("should compile $has (JSON containment)", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { data: { $has: { key: "value" } } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
  });

  test("should compile direct null value to IS NULL", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { email: null }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
  });

  test("should compile AND conjunction between two predicates", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: "Alice" }, conjunction: "and" },
      { predicate: { age: { $gte: 18 } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["Alice", 18]);
  });

  test("should compile OR conjunction between two predicates", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: "Alice" }, conjunction: "and" },
      { predicate: { name: "Bob" }, conjunction: "or" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["Alice", "Bob"]);
  });

  test("should compile $and at root level", () => {
    const entries: Array<PredicateEntry<any>> = [
      {
        predicate: {
          $and: [{ name: "Alice" }, { age: { $gte: 18 } }],
        },
        conjunction: "and",
      },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["Alice", 18]);
  });

  test("should compile $or at root level", () => {
    const entries: Array<PredicateEntry<any>> = [
      {
        predicate: {
          $or: [{ name: "Alice" }, { name: "Bob" }],
        },
        conjunction: "and",
      },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["Alice", "Bob"]);
  });

  test("should compile $not at root level", () => {
    const entries: Array<PredicateEntry<any>> = [
      {
        predicate: {
          $not: { name: "Alice" },
        },
        conjunction: "and",
      },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["Alice"]);
  });

  // `$not` follows the JS matcher's TWO-valued negation (`!matches(row, sub)`),
  // not SQL's three-valued `NOT (…)`: for a NULL column `NOT (col = 'x')` is
  // UNKNOWN and drops the row, while the matcher keeps it. `IS NOT TRUE`
  // collapses false and unknown into true, which is the matcher's semantic.
  test("should negate with IS NOT TRUE so NULL columns survive", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { $not: { name: "Alice" } }, conjunction: "and" },
    ];
    const result = compileWhere(entries, metadata, "t0", [], dialect);
    expect(result).toContain("IS NOT TRUE");
    expect(result).not.toContain("NOT (");
  });

  test("should compile a nested $not inside $and", () => {
    const entries: Array<PredicateEntry<any>> = [
      {
        predicate: { $and: [{ age: { $gte: 18 } }, { $not: { name: "Alice" } }] },
        conjunction: "and",
      },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([18, "Alice"]);
  });

  test("should compile a nested $not inside $or", () => {
    const entries: Array<PredicateEntry<any>> = [
      {
        predicate: { $or: [{ age: { $gte: 18 } }, { $not: { name: "Alice" } }] },
        conjunction: "and",
      },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([18, "Alice"]);
  });

  // An empty sub-predicate compiles to NO clause, which means "matches every
  // row" — so its negation matches none. Without an explicit constant the
  // `$not` would vanish entirely and match everything, the exact inverse.
  test("should compile an empty $not to FALSE", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { $not: {} }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([]);
  });

  // `$nin: []` is a no-op clause ("not in nothing" is always true), so negating
  // it must also match nothing.
  test("should compile a $not over a no-op sub-clause to FALSE", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { $not: { name: { $nin: [] } } }, conjunction: "and" },
    ];
    const result = compileWhere(entries, metadata, "t0", [], dialect);
    expect(result).toMatchSnapshot();
  });

  test("compilePredicate returns always-true for an empty predicate", () => {
    expect(compilePredicate({}, metadata, "t0", [], dialect)).toEqual({
      kind: "always-true",
    });
  });

  // ── Field-level `$not` ──
  // `{ field: { $not: … } }` negates ONE column's condition and is a different
  // operator from the criteria-level `$not` above. It carries the same
  // two-valued meaning, so it also compiles to `(…) IS NOT TRUE` — emitting
  // nothing at all would drop the predicate and return every row.

  test("should compile a field-level $not over an operator object", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $not: { $eq: "Alice" } } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["Alice"]);
  });

  test("should negate a field-level $not with IS NOT TRUE, not NOT (…)", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $not: { $eq: "Alice" } } }, conjunction: "and" },
    ];
    const result = compileWhere(entries, metadata, "t0", [], dialect);
    expect(result).toContain("IS NOT TRUE");
    expect(result).not.toContain("NOT (");
  });

  test("should compile a field-level $not over $in", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $not: { $in: ["Alice", "Bob"] } } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["Alice", "Bob"]);
  });

  // The matcher ANDs every operator present in one operator object, so negating
  // it negates the conjunction — one `IS NOT TRUE` over both clauses.
  test("should compile a field-level $not over several operators as one negation", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { age: { $not: { $gt: 18, $lte: 65 } } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([18, 65]);
  });

  test("should compile a field-level $not over $eq: null to IS NOT NULL", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $not: { $eq: null } } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([]);
  });

  // Outside the declared type, but the matcher reads a non-object `$not` as
  // `value !== inner`, so compile it as a negated equality rather than dropping.
  test("should compile a field-level $not over a bare value", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $not: "Alice" } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["Alice"]);
  });

  test("should compile a nested field-level $not as a double negation", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $not: { $not: { $eq: "Alice" } } } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["Alice"]);
  });

  test("should compile an empty field-level $not to FALSE", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $not: {} } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([]);
  });

  test("should compile a field-level $not over a no-op sub-clause to FALSE", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $not: { $nin: [] } } }, conjunction: "and" },
    ];
    const result = compileWhere(entries, metadata, "t0", [], dialect);
    expect(result).toMatchSnapshot();
  });

  test("should compile a field-level $not over an array operator", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { tags: { $not: { $all: ["a"] } } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params.length).toBeGreaterThan(0);
  });

  // The array-typed guard must still fire from inside a negation.
  test("should reject an array operator on a non-array column inside $not", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $not: { $all: ["a"] } } }, conjunction: "and" },
    ];
    expect(() => compileWhere(entries, metadata, "t0", [], dialect)).toThrow(
      /requires an array-typed column/,
    );
  });

  test("should compile complex nested predicates", () => {
    const entries: Array<PredicateEntry<any>> = [
      {
        predicate: {
          $or: [
            { $and: [{ name: "Alice" }, { age: { $gte: 18 } }] },
            { $and: [{ name: "Bob" }, { age: { $lt: 30 } }] },
          ],
        },
        conjunction: "and",
      },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["Alice", 18, "Bob", 30]);
  });

  test("should handle multiple fields in one predicate", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: "Alice", age: 25 }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["Alice", 25]);
  });

  test("should not emit conjunction when first entry compiles to empty", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: {}, conjunction: "and" },
      { predicate: { name: "Alice" }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, dialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["Alice"]);
    expect(result).not.toMatch(/WHERE\s+(AND|OR)/);
  });

  test("returns empty string when all entries have empty predicates", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: {}, conjunction: "and" },
      { predicate: {}, conjunction: "or" },
    ];
    const result = compileWhere(entries, metadata, "t0", [], dialect);
    expect(result).toBe("");
  });

  describe("array operator type guard", () => {
    test("should throw when $all is used on a non-array field", () => {
      const entries: Array<PredicateEntry<any>> = [
        { predicate: { name: { $all: ["a"] } }, conjunction: "and" },
      ];
      expect(() => compileWhere(entries, metadata, "t0", [], dialect)).toThrow(
        /requires an array-typed column.*"name".*type "string"/,
      );
    });

    test("should throw when $overlap is used on a non-array field", () => {
      const entries: Array<PredicateEntry<any>> = [
        { predicate: { age: { $overlap: [1, 2] } }, conjunction: "and" },
      ];
      expect(() => compileWhere(entries, metadata, "t0", [], dialect)).toThrow(
        /requires an array-typed column.*"age".*type "integer"/,
      );
    });

    test("should throw when $contained is used on a non-array field", () => {
      const entries: Array<PredicateEntry<any>> = [
        { predicate: { score: { $contained: [1.0] } }, conjunction: "and" },
      ];
      expect(() => compileWhere(entries, metadata, "t0", [], dialect)).toThrow(
        /requires an array-typed column.*"score".*type "float"/,
      );
    });
  });

  describe("tableAlias = null", () => {
    test("omits table alias prefix when tableAlias is null", () => {
      const params: Array<unknown> = [];
      const result = compilePredicate({ name: "Alice" }, metadata, null, params, dialect);
      expect(renderCondition(result)).toMatchSnapshot();
    });
  });

  // ── The three-state compiled result ──
  //
  // "This places no restriction" and "there is nothing to emit" used to share
  // the empty string, and every call site read the empty string as *skip*. The
  // two are now different values, which is what lets a destructive operation
  // refuse the first one.

  describe("three-state compiled result", () => {
    test("should compile $nin: [] to always-true, not to nothing", () => {
      const params: Array<unknown> = [];
      const result = compilePredicate(
        { name: { $nin: [] } },
        metadata,
        "t0",
        params,
        dialect,
      );

      expect(result).toEqual({ kind: "always-true" });
      expect(params).toEqual([]);
    });

    test("should compile $in: [] to always-false", () => {
      const params: Array<unknown> = [];
      const result = compilePredicate(
        { name: { $in: [] } },
        metadata,
        "t0",
        params,
        dialect,
      );

      expect(result).toEqual({ kind: "always-false" });
      expect(params).toEqual([]);
    });

    // The live wipe this phase exists for: both compiled to a WHERE clause that
    // restricts nothing, so `deleteMany({ name: { $nin: [] } })` ran
    // `DELETE FROM t`. The SQL is unchanged — what changed is that the compiled
    // result now SAYS which of the two it is.
    test("should distinguish an unrestricted criterion from an empty one", () => {
      const unrestricted = compilePredicate(
        { name: { $nin: [] } },
        metadata,
        "t0",
        [],
        dialect,
      );
      const empty = compilePredicate({}, metadata, "t0", [], dialect);
      const impossible = compilePredicate(
        { name: { $in: [] } },
        metadata,
        "t0",
        [],
        dialect,
      );

      expect(renderCondition(unrestricted)).toBe("");
      expect(renderCondition(empty)).toBe("");
      expect(renderCondition(impossible)).toBe("FALSE");
    });

    test("should emit no WHERE for an always-true criterion", () => {
      const entries: Array<PredicateEntry<any>> = [
        { predicate: { name: { $nin: [] } }, conjunction: "and" },
      ];

      expect(compileWhere(entries, metadata, "t0", [], dialect)).toBe("");
    });

    test("should emit WHERE FALSE for an always-false criterion", () => {
      const entries: Array<PredicateEntry<any>> = [
        { predicate: { name: { $in: [] } }, conjunction: "and" },
      ];

      expect(compileWhere(entries, metadata, "t0", [], dialect)).toBe("WHERE FALSE");
    });

    test("should drop an always-true member from a conjunction", () => {
      const params: Array<unknown> = [];
      const result = compilePredicate(
        { $and: [{ name: "Alice" }, { age: { $nin: [] } }] },
        metadata,
        "t0",
        params,
        dialect,
      );

      expect(renderCondition(result)).toMatchSnapshot();
      expect(params).toEqual(["Alice"]);
    });

    test("should collapse a conjunction holding an always-false member", () => {
      const result = compilePredicate(
        { $and: [{ name: "Alice" }, { age: { $in: [] } }] },
        metadata,
        "t0",
        [],
        dialect,
      );

      expect(result).toEqual({ kind: "always-false" });
    });

    test("should collapse a disjunction holding an always-true member", () => {
      const result = compilePredicate(
        { $or: [{ name: "Alice" }, { age: { $nin: [] } }] },
        metadata,
        "t0",
        [],
        dialect,
      );

      expect(result).toEqual({ kind: "always-true" });
    });

    // An empty sub-condition used to be dropped by `.filter(Boolean)`, so the
    // disjunction UNDER-matched: `$or: [{}, x]` compiled to `x`.
    test("should collapse a disjunction holding an empty sub-condition", () => {
      const result = compilePredicate(
        { $or: [{}, { name: "Alice" }] },
        metadata,
        "t0",
        [],
        dialect,
      );

      expect(result).toEqual({ kind: "always-true" });
    });

    test("should drop an always-false member from a disjunction", () => {
      const params: Array<unknown> = [];
      const result = compilePredicate(
        { $or: [{ name: "Alice" }, { age: { $in: [] } }] },
        metadata,
        "t0",
        params,
        dialect,
      );

      expect(renderCondition(result)).toMatchSnapshot();
      expect(params).toEqual(["Alice"]);
    });

    test("should compile an empty $and to always-true", () => {
      expect(compilePredicate({ $and: [] }, metadata, "t0", [], dialect)).toEqual({
        kind: "always-true",
      });
    });

    // `$or: []` is the empty disjunction, which nothing satisfies. It used to
    // compile to no clause at all and therefore matched every row.
    test("should compile an empty $or to always-false", () => {
      expect(compilePredicate({ $or: [] }, metadata, "t0", [], dialect)).toEqual({
        kind: "always-false",
      });
    });

    test("should flip the constant states through $not", () => {
      expect(
        compilePredicate({ $not: { name: { $nin: [] } } }, metadata, "t0", [], dialect),
      ).toEqual({ kind: "always-false" });

      expect(
        compilePredicate({ $not: { name: { $in: [] } } }, metadata, "t0", [], dialect),
      ).toEqual({ kind: "always-true" });
    });

    test("should flip the constant states through a field-level $not", () => {
      expect(
        compilePredicate({ name: { $not: { $nin: [] } } }, metadata, "t0", [], dialect),
      ).toEqual({ kind: "always-false" });

      expect(
        compilePredicate({ name: { $not: { $in: [] } } }, metadata, "t0", [], dialect),
      ).toEqual({ kind: "always-true" });
    });
  });

  // ── The operator switch ──

  describe("operator dispatch", () => {
    test("should throw for an unknown operator instead of matching every row", () => {
      const entries: Array<PredicateEntry<any>> = [
        { predicate: { name: { $ne: "Alice" } }, conjunction: "and" },
      ];

      expect(() => compileWhere(entries, metadata, "t0", [], dialect)).toThrow(
        /Unknown operator "\$ne"/,
      );
    });

    test("should throw and name the operator for a field-level $and", () => {
      const entries: Array<PredicateEntry<any>> = [
        { predicate: { age: { $and: [{ $gt: 18 }, { $lt: 65 }] } }, conjunction: "and" },
      ];

      expect(() => compileWhere(entries, metadata, "t0", [], dialect)).toThrow(
        /Field-level operator "\$and" is not supported/,
      );
    });

    test("should throw and name the operator for a field-level $or", () => {
      const entries: Array<PredicateEntry<any>> = [
        { predicate: { age: { $or: [{ $lt: 18 }, { $gt: 65 }] } }, conjunction: "and" },
      ];

      expect(() => compileWhere(entries, metadata, "t0", [], dialect)).toThrow(
        /Field-level operator "\$or" is not supported/,
      );
    });

    // Emission follows the ORDER THE CONDITION IS WRITTEN IN, where the
    // replaced if-chain imposed its own fixed order. Placeholders are numbered
    // as clauses are emitted, so the parameter order follows too.
    test("should emit clauses in the order the operators are written", () => {
      const params: Array<unknown> = [];
      const result = compilePredicate(
        { age: { $lte: 65, $gt: 18 } },
        metadata,
        "t0",
        params,
        dialect,
      );

      expect(renderCondition(result)).toMatchSnapshot();
      expect(params).toEqual([65, 18]);
    });

    // A bare nested object on a NON-embedded column still compiles to no clause,
    // so it matches every row. Pinned deliberately: it is a known gap that
    // belongs with the containment work, not with the representation change.
    test("should still compile a bare nested object on a plain column to always-true", () => {
      expect(
        compilePredicate({ data: { city: "Oslo" } }, metadata, "t0", [], dialect),
      ).toEqual({ kind: "always-true" });
    });
  });
});

// Dialect-specific tests for operators that differ across dialects

describe("compileWhere dialect-specific: $regex", () => {
  test("postgres: case-sensitive regex uses ~ operator", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $regex: /^Alice/ } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, postgresDialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["^Alice"]);
  });

  test("postgres: case-insensitive regex uses ~* operator", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $regex: /alice/i } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, postgresDialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["alice"]);
  });

  test("mysql: uses REGEXP with inline (?i) for case-insensitive", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $regex: /^foo.*bar$/i } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, mysqlDialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["(?i)^foo.*bar$"]);
  });

  test("mysql: case-sensitive regex uses REGEXP without (?i)", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $regex: /^Alice/ } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, mysqlDialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["^Alice"]);
  });

  test("sqlite: $regex throws NotSupportedError", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $regex: /alice/ } }, conjunction: "and" },
    ];
    expect(() => compileWhere(entries, metadata, "t0", [], sqliteDialect)).toThrow(
      /not supported/i,
    );
  });
});

describe("compileWhere dialect-specific: $similar", () => {
  test("postgres: string form uses % trigram match operator", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $similar: "beatles" } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, postgresDialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["beatles"]);
  });

  test("postgres: threshold form uses similarity() with explicit threshold", () => {
    const entries: Array<PredicateEntry<any>> = [
      {
        predicate: { name: { $similar: { value: "beatles", threshold: 0.3 } } },
        conjunction: "and",
      },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, postgresDialect);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["beatles", 0.3]);
  });

  test("mysql: $similar throws NotSupportedError", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $similar: "beatles" } }, conjunction: "and" },
    ];
    expect(() => compileWhere(entries, metadata, "t0", [], mysqlDialect)).toThrow(
      /only supported by the PostgreSQL driver/i,
    );
  });

  test("sqlite: $similar throws NotSupportedError", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $similar: "beatles" } }, conjunction: "and" },
    ];
    expect(() => compileWhere(entries, metadata, "t0", [], sqliteDialect)).toThrow(
      /only supported by the PostgreSQL driver/i,
    );
  });
});

describe("compileWhere dialect-specific: placeholder style", () => {
  test("postgres: uses $1, $2, $3 indexed placeholders", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: "Alice", age: 25 }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, postgresDialect);
    expect(result).toContain("$1");
    expect(result).toContain("$2");
  });

  test("mysql: uses ? positional placeholders", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: "Alice", age: 25 }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, mysqlDialect);
    expect(result).not.toContain("$");
    expect(result).toContain("?");
  });

  test("sqlite: uses ? positional placeholders", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: "Alice", age: 25 }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, sqliteDialect);
    expect(result).not.toContain("$");
    expect(result).toContain("?");
  });
});

describe("compileWhere dialect-specific: quoting style", () => {
  test("postgres: uses double-quote identifiers", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: "Alice" }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, postgresDialect);
    expect(result).toContain('"t0"."name"');
  });

  test("mysql: uses backtick identifiers", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: "Alice" }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, mysqlDialect);
    expect(result).toContain("`t0`.`name`");
  });

  test("sqlite: uses double-quote identifiers", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: "Alice" }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params, sqliteDialect);
    expect(result).toContain('"t0"."name"');
  });
});
