import { isSqlFragment, sql } from "./sql-fragment";

describe("sql", () => {
  describe("no interpolations", () => {
    test("returns SQL string with empty params", () => {
      const result = sql`SELECT * FROM users`;
      expect(result).toMatchSnapshot();
    });
  });

  describe("single value", () => {
    test("becomes $1 with value in params", () => {
      const result = sql`WHERE id = ${42}`;
      expect(result).toMatchSnapshot();
    });
  });

  describe("multiple values", () => {
    test("become $1, $2, $3 with values in params order", () => {
      const result = sql`WHERE a = ${1} AND b = ${2} AND c = ${3}`;
      expect(result).toMatchSnapshot();
    });
  });

  describe("value types", () => {
    test("handles a string value", () => {
      const result = sql`WHERE name = ${"alice"}`;
      expect(result).toMatchSnapshot();
    });

    test("handles a number value", () => {
      const result = sql`WHERE age = ${30}`;
      expect(result).toMatchSnapshot();
    });

    test("handles a boolean value", () => {
      const result = sql`WHERE active = ${true}`;
      expect(result).toMatchSnapshot();
    });

    test("handles a null value", () => {
      const result = sql`WHERE deleted_at = ${null}`;
      expect(result).toMatchSnapshot();
    });

    test("handles a Date value", () => {
      const date = new Date("2024-01-15T00:00:00.000Z");
      const result = sql`WHERE created_at = ${date}`;
      expect(result).toMatchSnapshot();
    });
  });

  describe("nested SqlFragment", () => {
    test("inlines nested fragment SQL and reindexes its params", () => {
      const inner = sql`id = ${99}`;
      const outer = sql`SELECT * FROM t WHERE ${inner}`;
      expect(outer).toMatchSnapshot();
    });

    test("reindexes nested fragment params when outer has preceding values", () => {
      const inner = sql`score > ${10}`;
      const outer = sql`SELECT * FROM t WHERE name = ${"bob"} AND ${inner}`;
      expect(outer).toMatchSnapshot();
    });

    test("nested fragment with multiple params gets all reindexed", () => {
      const inner = sql`(x = ${1} OR y = ${2})`;
      const outer = sql`SELECT * FROM t WHERE ${inner}`;
      expect(outer).toMatchSnapshot();
    });
  });

  describe("multiple nested SqlFragments", () => {
    test("inlines two fragments with correct param offsets", () => {
      const cond1 = sql`a = ${10}`;
      const cond2 = sql`b = ${20}`;
      const outer = sql`SELECT * FROM t WHERE ${cond1} AND ${cond2}`;
      expect(outer).toMatchSnapshot();
    });

    test("inlines three fragments with sequential param offsets", () => {
      const f1 = sql`x = ${"alpha"}`;
      const f2 = sql`y = ${"beta"}`;
      const f3 = sql`z = ${"gamma"}`;
      const outer = sql`SELECT * FROM t WHERE ${f1} AND ${f2} AND ${f3}`;
      expect(outer).toMatchSnapshot();
    });

    test("nested fragment with 10+ params does not corrupt $1 when reindexing to $10/$11", () => {
      // Build a fragment with 9 prior scalar params, then nest a fragment whose $1 must become $10
      // without incorrectly matching the leading "1" in "$10" or "$11".
      const inner = sql`(x = ${100} AND y = ${200})`;
      // 9 preceding scalar values means inner.$1 → $10, inner.$2 → $11
      const outer = sql`WHERE c1=${1} AND c2=${2} AND c3=${3} AND c4=${4} AND c5=${5} AND c6=${6} AND c7=${7} AND c8=${8} AND c9=${9} AND ${inner}`;
      expect(outer).toMatchSnapshot();
      // Verify the final SQL has both $10 and $11 (not $101 or $110 from naive string-replace)
      expect(outer.sql).toContain("$10");
      expect(outer.sql).toContain("$11");
      expect(outer.params).toHaveLength(11);
      expect(outer.params[9]).toBe(100);
      expect(outer.params[10]).toBe(200);
    });
  });

  describe("mix of regular values and nested SqlFragments", () => {
    test("interleaves scalar values and fragment params with correct indices", () => {
      const inner = sql`b = ${2}`;
      const outer = sql`SELECT * FROM t WHERE a = ${1} AND ${inner} AND c = ${3}`;
      expect(outer).toMatchSnapshot();
    });

    test("fragment first, then scalar value", () => {
      const inner = sql`status = ${"active"}`;
      const outer = sql`SELECT * FROM t WHERE ${inner} AND count > ${5}`;
      expect(outer).toMatchSnapshot();
    });

    test("scalar first, nested fragment with two params, then scalar", () => {
      const inner = sql`(low = ${10} AND high = ${20})`;
      const outer = sql`DELETE FROM t WHERE tenant = ${"acme"} AND ${inner} AND flag = ${true}`;
      expect(outer).toMatchSnapshot();
    });
  });
});

describe("isSqlFragment", () => {
  test("returns true for the output of sql tag", () => {
    const fragment = sql`SELECT 1`;
    expect(isSqlFragment(fragment)).toBe(true);
  });

  test("returns false for null", () => {
    expect(isSqlFragment(null)).toBe(false);
  });

  test("returns false for a plain string", () => {
    expect(isSqlFragment("SELECT 1")).toBe(false);
  });

  test("returns false for a number", () => {
    expect(isSqlFragment(42)).toBe(false);
  });

  test("returns false for a plain object without __brand", () => {
    expect(isSqlFragment({ sql: "SELECT 1", params: [] })).toBe(false);
  });

  test("returns false for an object with wrong __brand value", () => {
    expect(isSqlFragment({ __brand: "NotSqlFragment", sql: "", params: [] })).toBe(false);
  });
});
