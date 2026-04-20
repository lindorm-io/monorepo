import type { SetOperationEntry } from "../../../../types/query";
import { compileSetOperations } from "./compile-set-operation";
import { describe, expect, test } from "vitest";

describe("compileSetOperations", () => {
  describe("empty entries", () => {
    test("should return empty string when entries array is empty", () => {
      const globalParams: Array<unknown> = [];
      const result = compileSetOperations([], globalParams);
      expect(result).toBe("");
    });

    test("should not mutate globalParams when entries array is empty", () => {
      const globalParams: Array<unknown> = ["existing"];
      compileSetOperations([], globalParams);
      expect(globalParams).toEqual(["existing"]);
    });
  });

  describe("single UNION operation", () => {
    test("should produce UNION prefix with the entry SQL", () => {
      const globalParams: Array<unknown> = [];
      const entries: Array<SetOperationEntry> = [
        { operation: "UNION", sql: "SELECT id FROM archived_orders", params: [] },
      ];
      const result = compileSetOperations(entries, globalParams);
      expect(result).toMatchSnapshot();
    });
  });

  describe("single UNION ALL operation", () => {
    test("should produce UNION ALL prefix with the entry SQL", () => {
      const globalParams: Array<unknown> = [];
      const entries: Array<SetOperationEntry> = [
        { operation: "UNION ALL", sql: "SELECT id FROM deleted_orders", params: [] },
      ];
      const result = compileSetOperations(entries, globalParams);
      expect(result).toMatchSnapshot();
    });
  });

  describe("single INTERSECT operation", () => {
    test("should produce INTERSECT prefix with the entry SQL", () => {
      const globalParams: Array<unknown> = [];
      const entries: Array<SetOperationEntry> = [
        { operation: "INTERSECT", sql: "SELECT id FROM premium_users", params: [] },
      ];
      const result = compileSetOperations(entries, globalParams);
      expect(result).toMatchSnapshot();
    });
  });

  describe("single INTERSECT ALL operation", () => {
    test("should produce INTERSECT ALL prefix with the entry SQL", () => {
      const globalParams: Array<unknown> = [];
      const entries: Array<SetOperationEntry> = [
        { operation: "INTERSECT ALL", sql: "SELECT id FROM active_users", params: [] },
      ];
      const result = compileSetOperations(entries, globalParams);
      expect(result).toMatchSnapshot();
    });
  });

  describe("single EXCEPT operation", () => {
    test("should produce EXCEPT prefix with the entry SQL", () => {
      const globalParams: Array<unknown> = [];
      const entries: Array<SetOperationEntry> = [
        { operation: "EXCEPT", sql: "SELECT id FROM banned_users", params: [] },
      ];
      const result = compileSetOperations(entries, globalParams);
      expect(result).toMatchSnapshot();
    });
  });

  describe("single EXCEPT ALL operation", () => {
    test("should produce EXCEPT ALL prefix with the entry SQL", () => {
      const globalParams: Array<unknown> = [];
      const entries: Array<SetOperationEntry> = [
        { operation: "EXCEPT ALL", sql: "SELECT id FROM suspended_users", params: [] },
      ];
      const result = compileSetOperations(entries, globalParams);
      expect(result).toMatchSnapshot();
    });
  });

  describe("multiple operations chained", () => {
    test("should join multiple no-param entries with spaces", () => {
      const globalParams: Array<unknown> = [];
      const entries: Array<SetOperationEntry> = [
        { operation: "UNION", sql: "SELECT id FROM archived_orders", params: [] },
        { operation: "EXCEPT", sql: "SELECT id FROM cancelled_orders", params: [] },
        { operation: "UNION ALL", sql: "SELECT id FROM pending_orders", params: [] },
      ];
      const result = compileSetOperations(entries, globalParams);
      expect(result).toMatchSnapshot();
    });
  });

  describe("single operation with params", () => {
    test("should append entry params to globalParams", () => {
      const globalParams: Array<unknown> = [];
      const entries: Array<SetOperationEntry> = [
        {
          operation: "UNION",
          sql: "SELECT id FROM orders WHERE status = $1",
          params: ["active"],
        },
      ];
      compileSetOperations(entries, globalParams);
      expect(globalParams).toEqual(["active"]);
    });

    test("should reindex $1 to $1 when globalParams is initially empty", () => {
      const globalParams: Array<unknown> = [];
      const entries: Array<SetOperationEntry> = [
        {
          operation: "UNION",
          sql: "SELECT id FROM orders WHERE status = $1",
          params: ["active"],
        },
      ];
      const result = compileSetOperations(entries, globalParams);
      expect(result).toMatchSnapshot();
    });
  });

  describe("multiple operations with params — correct reindexing across entries", () => {
    test("should reindex $N placeholders sequentially across multiple entries", () => {
      const globalParams: Array<unknown> = [];
      const entries: Array<SetOperationEntry> = [
        {
          operation: "UNION",
          sql: "SELECT id FROM orders WHERE status = $1",
          params: ["active"],
        },
        {
          operation: "UNION ALL",
          sql: "SELECT id FROM orders WHERE region = $1 AND tier = $2",
          params: ["eu-west", "gold"],
        },
      ];
      const result = compileSetOperations(entries, globalParams);
      expect(result).toMatchSnapshot();
      expect(globalParams).toEqual(["active", "eu-west", "gold"]);
    });

    test("should accumulate all params from all entries into globalParams", () => {
      const globalParams: Array<unknown> = [];
      const entries: Array<SetOperationEntry> = [
        { operation: "UNION", sql: "SELECT id FROM t WHERE a = $1", params: [1] },
        { operation: "EXCEPT", sql: "SELECT id FROM t WHERE b = $1", params: [2] },
        { operation: "INTERSECT", sql: "SELECT id FROM t WHERE c = $1", params: [3] },
      ];
      compileSetOperations(entries, globalParams);
      expect(globalParams).toEqual([1, 2, 3]);
    });
  });

  describe("parameterless entry with non-empty globalParams", () => {
    test("globalParams length does not change when entry has no params", () => {
      const globalParams: Array<unknown> = ["pre1", "pre2"];
      const entries: Array<SetOperationEntry> = [
        { operation: "UNION", sql: "SELECT id FROM archived_orders", params: [] },
      ];
      compileSetOperations(entries, globalParams);
      expect(globalParams).toHaveLength(2);
      expect(globalParams).toEqual(["pre1", "pre2"]);
    });

    test("result SQL is correct when entry has no params but globalParams is non-empty", () => {
      const globalParams: Array<unknown> = ["pre1", "pre2"];
      const entries: Array<SetOperationEntry> = [
        { operation: "UNION", sql: "SELECT id FROM archived_orders", params: [] },
      ];
      const result = compileSetOperations(entries, globalParams);
      expect(result).toMatchSnapshot();
      // No $N placeholders should appear since the entry has none
      expect(result).not.toMatch(/\$\d/);
    });
  });

  describe("pre-existing globalParams — offset applied correctly", () => {
    test("should offset $N placeholders by the number of pre-existing globalParams", () => {
      const globalParams: Array<unknown> = ["pre1", "pre2"];
      const entries: Array<SetOperationEntry> = [
        {
          operation: "UNION",
          sql: "SELECT id FROM orders WHERE status = $1",
          params: ["active"],
        },
      ];
      const result = compileSetOperations(entries, globalParams);
      expect(result).toMatchSnapshot();
      expect(globalParams).toEqual(["pre1", "pre2", "active"]);
    });

    test("should correctly offset multiple entries when globalParams already has entries", () => {
      const globalParams: Array<unknown> = ["existing"];
      const entries: Array<SetOperationEntry> = [
        {
          operation: "UNION",
          sql: "SELECT id FROM t WHERE x = $1 AND y = $2",
          params: ["a", "b"],
        },
        {
          operation: "EXCEPT",
          sql: "SELECT id FROM t WHERE z = $1",
          params: ["c"],
        },
      ];
      const result = compileSetOperations(entries, globalParams);
      expect(result).toMatchSnapshot();
      expect(globalParams).toEqual(["existing", "a", "b", "c"]);
    });
  });
});
