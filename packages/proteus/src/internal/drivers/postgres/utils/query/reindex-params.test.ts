import { reindexParams } from "./reindex-params.js";
import { describe, expect, test } from "vitest";

describe("reindexParams", () => {
  describe("when globalParams is empty (offset = 0)", () => {
    test("should return SQL unchanged", () => {
      const globalParams: Array<unknown> = [];
      const result = reindexParams(
        "SELECT * FROM t WHERE id = $1",
        ["abc"],
        globalParams,
      );
      expect(result).toMatchSnapshot();
    });

    test("should append fragmentParams to globalParams", () => {
      const globalParams: Array<unknown> = [];
      reindexParams("SELECT * FROM t WHERE id = $1", ["abc"], globalParams);
      expect(globalParams).toEqual(["abc"]);
    });
  });

  describe("when globalParams has existing entries (offset > 0)", () => {
    test("should reindex a single $N placeholder by the offset", () => {
      const globalParams: Array<unknown> = ["existing"];
      const result = reindexParams("WHERE id = $1", ["new-val"], globalParams);
      expect(result).toMatchSnapshot();
    });

    test("should reindex multiple $N placeholders by the offset", () => {
      const globalParams: Array<unknown> = ["x", "y"];
      const result = reindexParams(
        "WHERE a = $1 AND b = $2 AND c = $3",
        ["p", "q", "r"],
        globalParams,
      );
      expect(result).toMatchSnapshot();
    });

    test("should append fragmentParams to globalParams after existing entries", () => {
      const globalParams: Array<unknown> = ["existing1", "existing2"];
      reindexParams("WHERE id = $1", ["new-val"], globalParams);
      expect(globalParams).toEqual(["existing1", "existing2", "new-val"]);
    });
  });

  describe("empty fragmentParams", () => {
    test("should return SQL unchanged when fragmentParams is empty and globalParams is empty", () => {
      const globalParams: Array<unknown> = [];
      const result = reindexParams("SELECT 1", [], globalParams);
      expect(result).toMatchSnapshot();
    });

    test("should not mutate globalParams when fragmentParams is empty", () => {
      const globalParams: Array<unknown> = ["prior"];
      reindexParams("SELECT 1", [], globalParams);
      expect(globalParams).toEqual(["prior"]);
    });

    test("should return SQL unchanged even with non-zero offset when fragmentParams is empty", () => {
      // offset > 0 but no placeholders exist in this fragment's SQL — should still reindex (no-op)
      const globalParams: Array<unknown> = ["prior"];
      const result = reindexParams("SELECT 1", [], globalParams);
      expect(result).toMatchSnapshot();
    });
  });

  describe("SQL with no $N placeholders", () => {
    test("should return SQL unchanged when there are no placeholders and offset is zero", () => {
      const globalParams: Array<unknown> = [];
      const result = reindexParams("SELECT NOW()", ["val"], globalParams);
      expect(result).toMatchSnapshot();
    });

    test("should return SQL unchanged when there are no placeholders even with a non-zero offset", () => {
      const globalParams: Array<unknown> = ["prior"];
      const result = reindexParams("SELECT NOW()", ["val"], globalParams);
      expect(result).toMatchSnapshot();
    });
  });

  describe("double-digit and large placeholders", () => {
    test("should correctly reindex $10 and beyond", () => {
      const globalParams: Array<unknown> = new Array(5).fill("x");
      const fragmentParams = new Array(12).fill("p");
      const result = reindexParams(
        "WHERE a = $1 AND b = $10 AND c = $12",
        fragmentParams,
        globalParams,
      );
      expect(result).toMatchSnapshot();
    });
  });

  describe("chaining multiple fragments", () => {
    test("should correctly reindex two fragments appended sequentially", () => {
      const globalParams: Array<unknown> = [];

      // First fragment: $1, $2
      const sql1 = reindexParams(
        "a = $1 AND b = $2",
        ["first-a", "first-b"],
        globalParams,
      );
      // Second fragment: $1 should become $3
      const sql2 = reindexParams(
        "c = $1 AND d = $2",
        ["second-c", "second-d"],
        globalParams,
      );

      expect({ sql1, sql2 }).toMatchSnapshot();
      expect(globalParams).toEqual(["first-a", "first-b", "second-c", "second-d"]);
    });

    test("should correctly reindex three chained fragments", () => {
      const globalParams: Array<unknown> = [];

      const sql1 = reindexParams("x = $1", [10], globalParams);
      const sql2 = reindexParams("y = $1", [20], globalParams);
      const sql3 = reindexParams("z = $1", [30], globalParams);

      expect({ sql1, sql2, sql3 }).toMatchSnapshot();
      expect(globalParams).toEqual([10, 20, 30]);
    });
  });
});
