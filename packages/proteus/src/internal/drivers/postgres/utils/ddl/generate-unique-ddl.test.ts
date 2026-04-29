import { ProteusError } from "../../../../../errors/index.js";
import type { MetaUnique } from "../../../../entity/types/metadata.js";
import { generateUniqueDDL } from "./generate-unique-ddl.js";
import { describe, expect, test } from "vitest";

const TABLE = "products";

const unique = (keys: string[], name: string | null = null): MetaUnique => ({
  keys,
  name,
});

describe("generateUniqueDDL", () => {
  test("returns empty array when no unique constraints are provided", () => {
    expect(generateUniqueDDL([], TABLE, [])).toEqual([]);
  });

  test("generates named unique constraint when name is provided", () => {
    const uniques = [unique(["email"], "uq_email")];
    expect(generateUniqueDDL(uniques, TABLE, [])).toMatchSnapshot();
  });

  test("auto-generates hash-based constraint name when name is null", () => {
    const uniques = [unique(["sku"])];
    expect(generateUniqueDDL(uniques, TABLE, [])).toMatchSnapshot();
  });

  test("auto-generated name starts with uq_", () => {
    const uniques = [unique(["barcode"])];
    const result = generateUniqueDDL(uniques, TABLE, []);
    expect(result[0]).toMatch(/CONSTRAINT "uq_[A-Za-z0-9_-]{11}" UNIQUE/);
  });

  test("generates composite unique constraint with multiple columns", () => {
    const uniques = [unique(["tenant_id", "email"])];
    expect(generateUniqueDDL(uniques, TABLE, [])).toMatchSnapshot();
  });

  test("generates multiple unique constraints in order", () => {
    const uniques = [
      unique(["email"], "uq_email"),
      unique(["slug"]),
      unique(["tenant_id", "name"], "uq_tenant_name"),
    ];
    expect(generateUniqueDDL(uniques, TABLE, [])).toMatchSnapshot();
  });

  test("throws ProteusError when named constraint exceeds 63 characters", () => {
    const longName = "b".repeat(64);
    expect(() => generateUniqueDDL([unique(["email"], longName)], TABLE, [])).toThrow(
      ProteusError,
    );
  });

  test("accepts a named constraint of exactly 63 characters", () => {
    const exactName = "c".repeat(63);
    expect(generateUniqueDDL([unique(["code"], exactName)], TABLE, [])).toMatchSnapshot();
  });

  test("auto-name is deterministic for same table and keys", () => {
    const uniques = [unique(["tenant_id", "slug"])];
    const r1 = generateUniqueDDL(uniques, "articles", []);
    const r2 = generateUniqueDDL(uniques, "articles", []);
    expect(r1).toEqual(r2);
  });

  test("auto-names differ for different tables with the same key set", () => {
    const uniques = [unique(["name"])];
    const r1 = generateUniqueDDL(uniques, "table_a", []);
    const r2 = generateUniqueDDL(uniques, "table_b", []);
    expect(r1[0]).not.toBe(r2[0]);
  });

  test("throws ProteusError when keys array is empty", () => {
    expect(() => generateUniqueDDL([unique([])], TABLE, [])).toThrow(ProteusError);
  });

  test("throws ProteusError with message indicating empty keys are invalid SQL", () => {
    expect(() => generateUniqueDDL([unique([])], TABLE, [])).toThrow(
      /UNIQUE \(\) is invalid SQL/,
    );
  });
});
