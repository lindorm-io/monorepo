import { generateAppendOnlyDDL } from "./generate-append-only-ddl.js";
import { describe, expect, test } from "vitest";

describe("generateAppendOnlyDDL (PostgreSQL)", () => {
  test("generates guard function and triggers without namespace", () => {
    expect(generateAppendOnlyDDL("audit_log", null)).toMatchSnapshot();
  });

  test("generates guard function and triggers with namespace", () => {
    expect(generateAppendOnlyDDL("audit_log", "reporting")).toMatchSnapshot();
  });

  test("returns exactly 7 statements (function + 3x drop/create pairs)", () => {
    const result = generateAppendOnlyDDL("events", null);
    // 1 function + 2*(drop+create) for update/delete + 1*(drop+create) for truncate = 7
    expect(result).toHaveLength(7);
  });

  test("first statement creates the guard function", () => {
    const result = generateAppendOnlyDDL("events", null);
    expect(result[0]).toContain("CREATE OR REPLACE FUNCTION");
    expect(result[0]).toContain("proteus_append_only_guard");
    expect(result[0]).toContain("LANGUAGE plpgsql");
  });

  test("uses public schema when namespace is null", () => {
    const result = generateAppendOnlyDDL("events", null);
    expect(result[0]).toContain('"public"."proteus_append_only_guard"');
  });

  test("uses provided namespace for function schema", () => {
    const result = generateAppendOnlyDDL("events", "analytics");
    expect(result[0]).toContain('"analytics"."proteus_append_only_guard"');
  });

  test("generates BEFORE UPDATE trigger", () => {
    const result = generateAppendOnlyDDL("events", null);
    const updateCreate = result.find(
      (s) => s.includes("CREATE TRIGGER") && s.includes("BEFORE UPDATE"),
    );
    expect(updateCreate).toBeDefined();
    expect(updateCreate).toContain("FOR EACH ROW");
  });

  test("generates BEFORE DELETE trigger", () => {
    const result = generateAppendOnlyDDL("events", null);
    const deleteCreate = result.find(
      (s) => s.includes("CREATE TRIGGER") && s.includes("BEFORE DELETE"),
    );
    expect(deleteCreate).toBeDefined();
    expect(deleteCreate).toContain("FOR EACH ROW");
  });

  test("generates BEFORE TRUNCATE trigger without FOR EACH ROW", () => {
    const result = generateAppendOnlyDDL("events", null);
    const truncateCreate = result.find(
      (s) => s.includes("CREATE TRIGGER") && s.includes("BEFORE TRUNCATE"),
    );
    expect(truncateCreate).toBeDefined();
    expect(truncateCreate).not.toContain("FOR EACH ROW");
  });

  test("includes DROP TRIGGER IF EXISTS before each CREATE TRIGGER", () => {
    const result = generateAppendOnlyDDL("events", null);
    const drops = result.filter((s) => s.includes("DROP TRIGGER IF EXISTS"));
    expect(drops).toHaveLength(3);
  });

  test("escapes identifier with embedded double quotes", () => {
    const result = generateAppendOnlyDDL('my"table', null);
    expect(result).toMatchSnapshot();
  });

  test("qualifies table name with namespace", () => {
    const result = generateAppendOnlyDDL("audit_log", "core");
    const updateDrop = result.find(
      (s) => s.includes("DROP TRIGGER") && s.includes("no_update"),
    );
    expect(updateDrop).toContain('"core"."audit_log"');
  });
});
