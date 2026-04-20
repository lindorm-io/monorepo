import { makeField } from "../../__fixtures__/make-field";
import type { EntityMetadata } from "../../entity/types/metadata";
import type { PredicateEntry } from "../../types/query";
import { postgresDialect } from "../../drivers/postgres/utils/postgres-dialect";
import { mysqlDialect } from "../../drivers/mysql/utils/mysql-dialect";
import { sqliteDialect } from "../../drivers/sqlite/utils/sqlite-dialect";
import type { SqlDialect } from "./sql-dialect";
import { compileWhere, compilePredicate } from "./compile-where";
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
    makeField("data", { type: "json" }),
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
      expect(result).toMatchSnapshot();
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
