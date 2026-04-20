import { generateCheckDDL } from "./generate-check-ddl";
import { ProteusError } from "../../../../../errors";
import type { MetaCheck } from "../../../../entity/types/metadata";
import { describe, expect, test } from "vitest";

const TABLE = "users";

const check = (expression: string, name: string | null = null): MetaCheck => ({
  expression,
  name,
});

describe("generateCheckDDL", () => {
  test("returns empty array when no check constraints are provided", () => {
    expect(generateCheckDDL([], TABLE)).toEqual([]);
  });

  test("generates named check constraint when name is provided", () => {
    const checks = [check("age >= 0", "age_positive")];
    expect(generateCheckDDL(checks, TABLE)).toMatchSnapshot();
  });

  test("auto-generates hash-based constraint name when name is null", () => {
    const checks = [check("score BETWEEN 0 AND 100")];
    expect(generateCheckDDL(checks, TABLE)).toMatchSnapshot();
  });

  test("auto-generated name starts with chk_", () => {
    const checks = [check("salary > 0")];
    const result = generateCheckDDL(checks, TABLE);
    expect(result[0]).toMatch(/CONSTRAINT "chk_[A-Za-z0-9_-]{11}" CHECK/);
  });

  test("generates multiple check constraints in order", () => {
    const checks = [
      check("age >= 0", "chk_age"),
      check("score <= 100"),
      check("name IS NOT NULL"),
    ];
    expect(generateCheckDDL(checks, TABLE)).toMatchSnapshot();
  });

  test("throws ProteusError when named constraint exceeds 63 characters", () => {
    const longName = "a".repeat(64);
    expect(() => generateCheckDDL([check("x > 0", longName)], TABLE)).toThrow(
      ProteusError,
    );
  });

  test("accepts a named constraint of exactly 63 characters", () => {
    const exactName = "a".repeat(63);
    const checks = [check("x > 0", exactName)];
    expect(generateCheckDDL(checks, TABLE)).toMatchSnapshot();
  });

  test("auto-name is deterministic for the same table and expression", () => {
    const checks = [check("value > 0")];
    const r1 = generateCheckDDL(checks, TABLE);
    const r2 = generateCheckDDL(checks, TABLE);
    expect(r1).toEqual(r2);
  });

  test("auto-names are different for different tables with same expression", () => {
    const checks = [check("value > 0")];
    const r1 = generateCheckDDL(checks, "table_a");
    const r2 = generateCheckDDL(checks, "table_b");
    expect(r1[0]).not.toBe(r2[0]);
  });
});
