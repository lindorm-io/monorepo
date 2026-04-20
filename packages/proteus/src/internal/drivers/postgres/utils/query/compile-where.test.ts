import { makeField } from "../../../../__fixtures__/make-field";
import type { EntityMetadata } from "../../../../entity/types/metadata";
import type { PredicateEntry } from "../../../../types/query";
import { compilePredicate, compileWhere } from "./compile-where";
import { describe, expect, test } from "vitest";

const metadata = {
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("email", { type: "string", name: "email_address" }),
    makeField("age", { type: "integer" }),
    makeField("tags", { type: "array" }),
    makeField("score", { type: "float" }),
  ],
} as EntityMetadata;

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

  test("should compile $eq: null to IS NULL", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $eq: null } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([]);
  });

  test("should compile $neq: null to IS NOT NULL", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $neq: null } }, conjunction: "and" },
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

  test("should compile $between", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { age: { $between: [18, 65] } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([18, 65]);
  });

  test("should compile $in with values", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $in: ["Alice", "Bob", "Charlie"] } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["Alice", "Bob", "Charlie"]);
  });

  test("should compile empty $in to FALSE", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $in: [] } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([]);
  });

  test("should compile $nin", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $nin: ["Alice"] } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["Alice"]);
  });

  test("should compile $like", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $like: "%alice%" } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["%alice%"]);
  });

  test("should compile $ilike", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $ilike: "%alice%" } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["%alice%"]);
  });

  test("should compile $regex (case-sensitive)", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $regex: /^Alice/ } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["^Alice"]);
  });

  test("should compile $regex (case-insensitive)", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: { $regex: /alice/i } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["alice"]);
  });

  test("should compile $exists", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { email: { $exists: true } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
  });

  test("should compile $all (array containment)", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { tags: { $all: ["js", "ts"] } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([["js", "ts"]]);
  });

  test("should compile $length", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { tags: { $length: 3 } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([3]);
  });

  test("should compile $mod", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { age: { $mod: [5, 0] } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([5, 0]);
  });

  test("should compile direct null value to IS NULL", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { email: null }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
  });

  test("should compile andWhere conjunction", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: "Alice" }, conjunction: "and" },
      { predicate: { age: { $gte: 18 } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["Alice", 18]);
  });

  test("should compile orWhere conjunction", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: "Alice" }, conjunction: "and" },
      { predicate: { name: "Bob" }, conjunction: "or" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
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
    const result = compileWhere(entries, metadata, "t0", params);
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
    const result = compileWhere(entries, metadata, "t0", params);
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
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["Alice"]);
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
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["Alice", 18, "Bob", 30]);
  });

  test("should handle multiple fields in one predicate", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: "Alice", age: 25 }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["Alice", 25]);
  });

  test("should increment params counter across clauses", () => {
    // Simulate shared params array with pre-existing params
    const params: Array<unknown> = ["existing"];
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { name: "Alice" }, conjunction: "and" },
    ];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toContain("$2");
    expect(params).toEqual(["existing", "Alice"]);
  });

  test("should compile $overlap (array overlap)", () => {
    const entries: Array<PredicateEntry<any>> = [
      { predicate: { tags: { $overlap: ["js", "rust"] } }, conjunction: "and" },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([["js", "rust"]]);
  });

  test("should compile $contained (array contained-by)", () => {
    const entries: Array<PredicateEntry<any>> = [
      {
        predicate: { tags: { $contained: ["js", "ts", "rust", "go"] } },
        conjunction: "and",
      },
    ];
    const params: Array<unknown> = [];
    const result = compileWhere(entries, metadata, "t0", params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([["js", "ts", "rust", "go"]]);
  });

  describe("array operator type guard", () => {
    test("should throw when $all is used on a non-array field", () => {
      const entries: Array<PredicateEntry<any>> = [
        { predicate: { name: { $all: ["a"] } }, conjunction: "and" },
      ];
      expect(() => compileWhere(entries, metadata, "t0", [])).toThrow(
        /requires an array-typed column.*"name".*type "string"/,
      );
    });

    test("should throw when $overlap is used on a non-array field", () => {
      const entries: Array<PredicateEntry<any>> = [
        { predicate: { age: { $overlap: [1, 2] } }, conjunction: "and" },
      ];
      expect(() => compileWhere(entries, metadata, "t0", [])).toThrow(
        /requires an array-typed column.*"age".*type "integer"/,
      );
    });

    test("should throw when $contained is used on a non-array field", () => {
      const entries: Array<PredicateEntry<any>> = [
        { predicate: { score: { $contained: [1.0] } }, conjunction: "and" },
      ];
      expect(() => compileWhere(entries, metadata, "t0", [])).toThrow(
        /requires an array-typed column.*"score".*type "float"/,
      );
    });

    test("should not throw when array operators are used on array-typed fields", () => {
      const entries: Array<PredicateEntry<any>> = [
        {
          predicate: { tags: { $all: ["a"], $overlap: ["b"], $contained: ["c"] } },
          conjunction: "and",
        },
      ];
      const params: Array<unknown> = [];
      expect(() => compileWhere(entries, metadata, "t0", params)).not.toThrow();
    });
  });

  describe("$nin: [] is a no-op (never filters anything)", () => {
    test("empty $nin produces no clause and adds no params", () => {
      const entries: Array<PredicateEntry<any>> = [
        { predicate: { name: { $nin: [] } }, conjunction: "and" },
      ];
      const params: Array<unknown> = [];
      const result = compileWhere(entries, metadata, "t0", params);
      // Empty NOT IN is a no-op — no clause should be emitted
      expect(result).toBe("");
      expect(params).toEqual([]);
    });

    test("empty $nin combined with another operator does not add extra clause", () => {
      // $nin: [] contributes nothing; only $gte should be present
      const entries: Array<PredicateEntry<any>> = [
        { predicate: { age: { $nin: [], $gte: 18 } }, conjunction: "and" },
      ];
      const params: Array<unknown> = [];
      const result = compileWhere(entries, metadata, "t0", params);
      expect(result).toMatchSnapshot();
      // $nin: [] adds no param; only $gte adds one
      expect(params).toEqual([18]);
      expect(result).not.toContain("NOT IN");
    });

    test("empty $nin does not add any params to the shared array", () => {
      // Verify the params array is not polluted by empty $nin
      const params: Array<unknown> = ["pre"];
      const entries: Array<PredicateEntry<any>> = [
        { predicate: { name: { $nin: [] } }, conjunction: "and" },
      ];
      compileWhere(entries, metadata, "t0", params);
      expect(params).toEqual(["pre"]);
    });

    test("non-empty $nin still produces NOT IN clause", () => {
      // Regression guard: empty check must not suppress non-empty arrays
      const entries: Array<PredicateEntry<any>> = [
        { predicate: { name: { $nin: ["Alice", "Bob"] } }, conjunction: "and" },
      ];
      const params: Array<unknown> = [];
      const result = compileWhere(entries, metadata, "t0", params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual(["Alice", "Bob"]);
      expect(result).toContain("NOT IN");
    });
  });

  describe("$regex flags handling", () => {
    test("case-sensitive regex uses ~ operator (no flags)", () => {
      const entries: Array<PredicateEntry<any>> = [
        { predicate: { name: { $regex: /^hello/ } }, conjunction: "and" },
      ];
      const params: Array<unknown> = [];
      const result = compileWhere(entries, metadata, "t0", params);
      expect(result).toMatchSnapshot();
      // ~ is the case-sensitive PG regex operator
      expect(result).toContain("~ $");
      expect(result).not.toContain("~* $");
      expect(params).toEqual(["^hello"]);
    });

    test("case-insensitive regex (i flag) uses ~* operator", () => {
      const entries: Array<PredicateEntry<any>> = [
        { predicate: { name: { $regex: /^hello/i } }, conjunction: "and" },
      ];
      const params: Array<unknown> = [];
      const result = compileWhere(entries, metadata, "t0", params);
      expect(result).toMatchSnapshot();
      // ~* is the case-insensitive PG regex operator
      expect(result).toContain("~* $");
      expect(result).not.toMatch(/"name" ~ \$/);
      expect(params).toEqual(["^hello"]);
    });

    test("regex with global flag (g) alongside i flag uses ~* operator", () => {
      // 'gi' flags — i is present so should use ~*
      const entries: Array<PredicateEntry<any>> = [
        { predicate: { name: { $regex: /pattern/gi } }, conjunction: "and" },
      ];
      const params: Array<unknown> = [];
      const result = compileWhere(entries, metadata, "t0", params);
      expect(result).toMatchSnapshot();
      expect(result).toContain("~* $");
      expect(params).toEqual(["pattern"]);
    });

    test("regex with only global flag (g, no i) uses case-sensitive ~ operator", () => {
      const entries: Array<PredicateEntry<any>> = [
        { predicate: { name: { $regex: /pattern/g } }, conjunction: "and" },
      ];
      const params: Array<unknown> = [];
      const result = compileWhere(entries, metadata, "t0", params);
      expect(result).toMatchSnapshot();
      // g flag does not imply case-insensitive — must use ~
      expect(result).toContain("~ $");
      expect(result).not.toContain("~* $");
      expect(params).toEqual(["pattern"]);
    });

    test("regex source (not the full regex) is pushed as param", () => {
      // Only the source string is passed — not the RegExp object itself
      const entries: Array<PredicateEntry<any>> = [
        { predicate: { name: { $regex: /foo\d+bar/i } }, conjunction: "and" },
      ];
      const params: Array<unknown> = [];
      compileWhere(entries, metadata, "t0", params);
      expect(params).toHaveLength(1);
      expect(typeof params[0]).toBe("string");
      expect(params[0]).toBe("foo\\d+bar");
    });
  });

  describe("tableAlias = null — column references without alias prefix", () => {
    test("omits table alias prefix when tableAlias is null (compilePredicate)", () => {
      // compilePredicate is exported and accepts null tableAlias
      const params: Array<unknown> = [];
      const result = compilePredicate({ name: "Alice" }, metadata, null, params);
      expect(result).toMatchSnapshot();
      // Should NOT contain any alias prefix like "t0"."name"; just "name" = $1
      expect(result).not.toContain('"t0".');
      expect(result).toContain('"name"');
      expect(params).toEqual(["Alice"]);
    });

    test("omits alias prefix for column name mapping when tableAlias is null", () => {
      const params: Array<unknown> = [];
      // email maps to email_address — verify no alias prefix in result
      const result = compilePredicate({ email: "x@x.com" }, metadata, null, params);
      expect(result).toMatchSnapshot();
      expect(result).not.toContain('"t0".');
      expect(result).toContain('"email_address"');
    });

    test("omits alias prefix for operator clauses when tableAlias is null", () => {
      const params: Array<unknown> = [];
      const result = compilePredicate({ age: { $gt: 18 } }, metadata, null, params);
      expect(result).toMatchSnapshot();
      expect(result).not.toContain('"t0".');
      expect(result).toContain('"age" >');
    });

    test("omits alias prefix for IS NULL when tableAlias is null", () => {
      const params: Array<unknown> = [];
      const result = compilePredicate({ name: null }, metadata, null, params);
      expect(result).toMatchSnapshot();
      expect(result).not.toContain('"t0".');
      expect(result).toContain('"name" IS NULL');
    });
  });

  describe("empty first-entry conjunction bug (clauses.length === 0 guard)", () => {
    // Regression test: before the fix, when entries[0] compiled to an empty string (skipped),
    // entries[1] would be pushed with a conjunction prefix (e.g. "AND ...") making invalid SQL.
    // The fix: use `clauses.length === 0` instead of `i === 0` to decide whether to prefix.

    test("should not emit conjunction when first entry compiles to empty", () => {
      // entries[0] has an empty predicate {}, which compilePredicate returns "" for
      // entries[1] has a valid predicate — must be the FIRST clause (no AND/OR prefix)
      const entries: Array<PredicateEntry<any>> = [
        { predicate: {}, conjunction: "and" },
        { predicate: { name: "Alice" }, conjunction: "and" },
      ];
      const params: Array<unknown> = [];
      const result = compileWhere(entries, metadata, "t0", params);

      // Output must be "WHERE ..." not "WHERE AND ..." or "WHERE OR ..."
      expect(result).toMatchSnapshot();
      expect(params).toEqual(["Alice"]);
      expect(result).not.toMatch(/WHERE\s+(AND|OR)/);
    });

    test("should not emit OR prefix when first entry compiles to empty and second uses or conjunction", () => {
      const entries: Array<PredicateEntry<any>> = [
        { predicate: {}, conjunction: "and" },
        { predicate: { age: { $gte: 18 } }, conjunction: "or" },
      ];
      const params: Array<unknown> = [];
      const result = compileWhere(entries, metadata, "t0", params);

      expect(result).toMatchSnapshot();
      expect(params).toEqual([18]);
      // The first real clause must not be prefixed with OR
      expect(result).not.toMatch(/WHERE\s+(AND|OR)/);
    });

    test("should handle third entry normally when first two are empty", () => {
      const entries: Array<PredicateEntry<any>> = [
        { predicate: {}, conjunction: "and" },
        { predicate: {}, conjunction: "and" },
        { predicate: { name: "Bob" }, conjunction: "and" },
      ];
      const params: Array<unknown> = [];
      const result = compileWhere(entries, metadata, "t0", params);

      expect(result).toMatchSnapshot();
      expect(params).toEqual(["Bob"]);
      expect(result).not.toMatch(/WHERE\s+(AND|OR)/);
    });

    test("returns empty string when all entries have empty predicates", () => {
      const entries: Array<PredicateEntry<any>> = [
        { predicate: {}, conjunction: "and" },
        { predicate: {}, conjunction: "or" },
      ];
      const result = compileWhere(entries, metadata, "t0", []);
      expect(result).toBe("");
    });
  });

  describe("isObject boundary — Date and RegExp as direct values", () => {
    // After replacing `typeof x === "object"` with isObject(), Date instances are
    // correctly routed to equality comparison rather than the operator branch.
    // (isObject(new Date()) === false; typeof new Date() === "object" === true)

    test("should treat Date value as direct equality (not operator object)", () => {
      const metaWithDate = {
        ...metadata,
        fields: [
          ...metadata.fields,
          makeField("createdAt", { type: "timestamp", name: "created_at" }),
        ],
      } as EntityMetadata;

      const date = new Date("2024-01-15T12:00:00Z");
      const entries: Array<PredicateEntry<any>> = [
        { predicate: { createdAt: date }, conjunction: "and" },
      ];
      const params: Array<unknown> = [];
      const result = compileWhere(entries, metaWithDate, "t0", params);

      // Date should be pushed as a param and compiled as equality, not as an operator
      expect(result).toMatchSnapshot();
      expect(params).toEqual([date]);
      expect(result).toContain("= $1");
    });

    test("should treat RegExp value as direct equality (RegExp excluded from operator path by !(value instanceof RegExp))", () => {
      const entries: Array<PredicateEntry<any>> = [
        { predicate: { name: /alice/i }, conjunction: "and" },
      ];
      const params: Array<unknown> = [];
      const result = compileWhere(entries, metadata, "t0", params);

      // RegExp bypasses operator path (the existing instanceof RegExp guard); pushed as param
      expect(result).toMatchSnapshot();
      expect(params).toHaveLength(1);
      expect(params[0]).toBeInstanceOf(RegExp);
    });

    test("should treat null predicate value as IS NULL (null is not isObject)", () => {
      // Regression: typeof null === "object" is true, but isObject(null) is false.
      // The null check on line 77 handles this before isObject is called —
      // this test documents the correct path.
      const entries: Array<PredicateEntry<any>> = [
        { predicate: { age: null }, conjunction: "and" },
      ];
      const params: Array<unknown> = [];
      const result = compileWhere(entries, metadata, "t0", params);

      expect(result).toMatchSnapshot();
      expect(params).toHaveLength(0);
      expect(result).toContain("IS NULL");
    });
  });
});
