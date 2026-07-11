import {
  buildCheckName,
  buildForeignKeyName,
  buildIndexName,
  buildInheritanceForeignKeyName,
  buildUniqueName,
} from "./constraint-names.js";
import { describe, expect, test } from "vitest";

describe("constraint-names", () => {
  describe("buildForeignKeyName", () => {
    test("snapshot for known input (canonical postgres formula)", () => {
      expect(buildForeignKeyName("orders", "user_id")).toMatchSnapshot();
    });

    test("is deterministic", () => {
      expect(buildForeignKeyName("orders", "user_id")).toBe(
        buildForeignKeyName("orders", "user_id"),
      );
    });

    test("different columns on the same table produce different names", () => {
      expect(buildForeignKeyName("orders", "user_id")).not.toBe(
        buildForeignKeyName("orders", "company_id"),
      );
    });

    test("stays within the 63-char postgres identifier limit for long inputs", () => {
      const name = buildForeignKeyName("t".repeat(63), "c".repeat(63));
      expect(name).toHaveLength(14);
      expect(name).toMatchSnapshot();
    });
  });

  describe("buildInheritanceForeignKeyName", () => {
    test("snapshot for known input", () => {
      expect(buildInheritanceForeignKeyName("managers", "employees")).toMatchSnapshot();
    });

    test("differs from a relation FK on the same table/name pair", () => {
      expect(buildInheritanceForeignKeyName("managers", "employees")).not.toBe(
        buildForeignKeyName("managers", "employees"),
      );
    });
  });

  describe("buildUniqueName", () => {
    test("snapshot for single column", () => {
      expect(buildUniqueName("users", ["email"])).toMatchSnapshot();
    });

    test("snapshot for composite columns", () => {
      expect(buildUniqueName("users", ["tenant_id", "email"])).toMatchSnapshot();
    });

    test("column order matters", () => {
      expect(buildUniqueName("users", ["a", "b"])).not.toBe(
        buildUniqueName("users", ["b", "a"]),
      );
    });
  });

  describe("buildCheckName", () => {
    test("snapshot for known expression", () => {
      expect(buildCheckName("users", "age >= 0")).toMatchSnapshot();
    });

    test("changed expression yields a new name", () => {
      expect(buildCheckName("users", "age >= 0")).not.toBe(
        buildCheckName("users", "age >= 18"),
      );
    });
  });

  describe("buildIndexName", () => {
    test("snapshot for single column", () => {
      expect(buildIndexName("orders", ["created_at"])).toMatchSnapshot();
    });

    test("snapshot for composite columns", () => {
      expect(buildIndexName("orders", ["user_id", "created_at"])).toMatchSnapshot();
    });

    test("differs from the unique name for the same table/columns", () => {
      expect(buildIndexName("users", ["email"])).not.toBe(
        buildUniqueName("users", ["email"]),
      );
    });
  });

  describe("cross-builder collision guard", () => {
    test("join separator means (t, [a_b]) collides with (t, [a, b]) by design — document it", () => {
      // The canonical formula joins columns with "_" before hashing, so a column
      // literally named "a_b" hashes identically to the pair ["a", "b"]. This is
      // inherited from the original postgres formula and is accepted (D1).
      expect(buildIndexName("t", ["a_b"])).toBe(buildIndexName("t", ["a", "b"]));
    });
  });
});
