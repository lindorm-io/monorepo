import { compileCtes } from "./compile-cte";
import type { CteSpec } from "../../../../types/query";

// Helper to build a CteSpec with sensible defaults
const makeCte = (overrides: Partial<CteSpec> = {}): CteSpec => ({
  name: "cte_name",
  sql: "SELECT 1",
  params: [],
  materialized: null,
  ...overrides,
});

describe("compileCtes", () => {
  describe("empty ctes array", () => {
    test("should return empty string when ctes is empty", () => {
      const globalParams: Array<unknown> = [];
      const result = compileCtes([], globalParams);
      expect(result).toEqual("");
    });

    test("should not mutate globalParams when ctes is empty", () => {
      const globalParams: Array<unknown> = ["existing"];
      compileCtes([], globalParams);
      expect(globalParams).toEqual(["existing"]);
    });
  });

  describe("single CTE — no params, materialized=null", () => {
    test("should return a WITH clause with no materialization hint", () => {
      const globalParams: Array<unknown> = [];
      const result = compileCtes(
        [makeCte({ name: "base_data", sql: "SELECT id FROM users" })],
        globalParams,
      );
      expect(result).toMatchSnapshot();
    });

    test("should not mutate globalParams when CTE has no params", () => {
      const globalParams: Array<unknown> = [];
      compileCtes(
        [makeCte({ name: "base_data", sql: "SELECT id FROM users" })],
        globalParams,
      );
      expect(globalParams).toEqual([]);
    });
  });

  describe("single CTE — with params", () => {
    test("should append CTE params to globalParams and reindex placeholders from $1", () => {
      const globalParams: Array<unknown> = [];
      const result = compileCtes(
        [
          makeCte({
            name: "filtered",
            sql: "SELECT id FROM users WHERE status = $1",
            params: ["active"],
          }),
        ],
        globalParams,
      );
      expect(result).toMatchSnapshot();
      expect(globalParams).toEqual(["active"]);
    });
  });

  describe("single CTE — materialized=true", () => {
    test("should include MATERIALIZED hint", () => {
      const globalParams: Array<unknown> = [];
      const result = compileCtes(
        [makeCte({ name: "mat_cte", sql: "SELECT 1", materialized: true })],
        globalParams,
      );
      expect(result).toMatchSnapshot();
    });

    test("should contain the MATERIALIZED keyword", () => {
      const globalParams: Array<unknown> = [];
      const result = compileCtes(
        [makeCte({ name: "mat_cte", sql: "SELECT 1", materialized: true })],
        globalParams,
      );
      expect(result).toContain("MATERIALIZED");
      expect(result).not.toContain("NOT MATERIALIZED");
    });
  });

  describe("single CTE — materialized=false", () => {
    test("should include NOT MATERIALIZED hint", () => {
      const globalParams: Array<unknown> = [];
      const result = compileCtes(
        [makeCte({ name: "inline_cte", sql: "SELECT 1", materialized: false })],
        globalParams,
      );
      expect(result).toMatchSnapshot();
    });

    test("should contain the NOT MATERIALIZED keyword", () => {
      const globalParams: Array<unknown> = [];
      const result = compileCtes(
        [makeCte({ name: "inline_cte", sql: "SELECT 1", materialized: false })],
        globalParams,
      );
      expect(result).toContain("NOT MATERIALIZED");
    });
  });

  describe("multiple CTEs", () => {
    test("should join multiple CTEs in a single WITH clause", () => {
      const globalParams: Array<unknown> = [];
      const result = compileCtes(
        [
          makeCte({ name: "first_cte", sql: "SELECT 1" }),
          makeCte({ name: "second_cte", sql: "SELECT 2" }),
          makeCte({ name: "third_cte", sql: "SELECT 3" }),
        ],
        globalParams,
      );
      expect(result).toMatchSnapshot();
    });

    test("should produce only one WITH keyword", () => {
      const globalParams: Array<unknown> = [];
      const result = compileCtes(
        [
          makeCte({ name: "a", sql: "SELECT 1" }),
          makeCte({ name: "b", sql: "SELECT 2" }),
        ],
        globalParams,
      );
      const withCount = (result.match(/\bWITH\b/g) ?? []).length;
      expect(withCount).toEqual(1);
    });
  });

  describe("multiple CTEs — params reindexed correctly", () => {
    test("should reindex second CTE params to continue after first CTE params ($1,$2 then $3,$4)", () => {
      const globalParams: Array<unknown> = [];
      const result = compileCtes(
        [
          makeCte({
            name: "cte_a",
            sql: "SELECT * FROM a WHERE x = $1 AND y = $2",
            params: ["foo", 42],
          }),
          makeCte({
            name: "cte_b",
            sql: "SELECT * FROM b WHERE p = $1 AND q = $2",
            params: ["bar", 99],
          }),
        ],
        globalParams,
      );
      expect(result).toMatchSnapshot();
      // All four params must have been pushed in order
      expect(globalParams).toEqual(["foo", 42, "bar", 99]);
    });

    test("should reindex $1 placeholders in first CTE as $1 (offset=0, no-op)", () => {
      const globalParams: Array<unknown> = [];
      const result = compileCtes(
        [makeCte({ name: "cte_a", sql: "SELECT $1", params: ["first"] })],
        globalParams,
      );
      expect(result).toContain("$1");
    });

    test("should reindex $1 placeholder in second CTE as $3 when first CTE has two params", () => {
      const globalParams: Array<unknown> = [];
      const result = compileCtes(
        [
          makeCte({ name: "cte_a", sql: "SELECT $1, $2", params: ["p1", "p2"] }),
          makeCte({ name: "cte_b", sql: "SELECT $1", params: ["p3"] }),
        ],
        globalParams,
      );
      expect(result).toContain("$3");
    });
  });

  describe("CTE with pre-existing globalParams — offset applied", () => {
    test("should offset CTE param placeholders by the number of pre-existing globalParams", () => {
      // Simulate two params already accumulated before compileCtes is called
      const globalParams: Array<unknown> = ["pre1", "pre2"];
      const result = compileCtes(
        [makeCte({ name: "offset_cte", sql: "SELECT $1 AND $2", params: ["a", "b"] })],
        globalParams,
      );
      expect(result).toMatchSnapshot();
      // Placeholders must be shifted by 2 — $1→$3, $2→$4
      expect(result).toContain("$3");
      expect(result).toContain("$4");
      expect(result).not.toContain("$1");
      expect(result).not.toContain("$2");
      // Pre-existing params untouched, CTE params appended
      expect(globalParams).toEqual(["pre1", "pre2", "a", "b"]);
    });

    test("should handle multiple CTEs with pre-existing globalParams", () => {
      const globalParams: Array<unknown> = ["existing"];
      const result = compileCtes(
        [
          makeCte({ name: "cte_a", sql: "SELECT $1", params: ["x"] }),
          makeCte({ name: "cte_b", sql: "SELECT $1", params: ["y"] }),
        ],
        globalParams,
      );
      expect(result).toMatchSnapshot();
      expect(globalParams).toEqual(["existing", "x", "y"]);
    });
  });

  describe("zero-param CTE with pre-existing globalParams", () => {
    test("result SQL contains no $N references when CTE has no params", () => {
      const globalParams: Array<unknown> = ["pre1", "pre2"];
      const result = compileCtes(
        [makeCte({ name: "no_param_cte", sql: "SELECT id FROM snapshots" })],
        globalParams,
      );
      expect(result).toMatchSnapshot();
      // The CTE SQL has no placeholders at all
      expect(result).not.toMatch(/\$\d/);
    });

    test("globalParams is not mutated when CTE has no params", () => {
      const globalParams: Array<unknown> = ["pre1", "pre2"];
      compileCtes(
        [makeCte({ name: "no_param_cte", sql: "SELECT id FROM snapshots" })],
        globalParams,
      );
      // Nothing should have been added to globalParams
      expect(globalParams).toEqual(["pre1", "pre2"]);
    });
  });

  describe("identifier quoting", () => {
    test("should quote CTE names as SQL identifiers", () => {
      const globalParams: Array<unknown> = [];
      const result = compileCtes([makeCte({ name: "my_cte" })], globalParams);
      expect(result).toContain('"my_cte"');
    });

    test("should escape double-quotes inside CTE names", () => {
      const globalParams: Array<unknown> = [];
      const result = compileCtes([makeCte({ name: 'tricky"name' })], globalParams);
      expect(result).toMatchSnapshot();
      expect(result).toContain('"tricky""name"');
    });
  });
});
