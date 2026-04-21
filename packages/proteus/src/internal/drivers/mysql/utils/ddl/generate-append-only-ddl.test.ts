import { generateAppendOnlyDDL } from "./generate-append-only-ddl.js";
import { describe, expect, test } from "vitest";

describe("generateAppendOnlyDDL (MySQL)", () => {
  test("generates triggers for a simple table", () => {
    expect(generateAppendOnlyDDL("audit_log")).toMatchSnapshot();
  });

  test("returns exactly 4 statements (2x drop/create pairs)", () => {
    const result = generateAppendOnlyDDL("events");
    // 2 ops * (drop + create) = 4
    expect(result).toHaveLength(4);
  });

  test("generates BEFORE UPDATE trigger", () => {
    const result = generateAppendOnlyDDL("events");
    const updateCreate = result.find(
      (s) => s.includes("CREATE TRIGGER") && s.includes("BEFORE UPDATE"),
    );
    expect(updateCreate).toBeDefined();
    expect(updateCreate).toContain("FOR EACH ROW");
    expect(updateCreate).toContain("SIGNAL SQLSTATE '45000'");
  });

  test("generates BEFORE DELETE trigger", () => {
    const result = generateAppendOnlyDDL("events");
    const deleteCreate = result.find(
      (s) => s.includes("CREATE TRIGGER") && s.includes("BEFORE DELETE"),
    );
    expect(deleteCreate).toBeDefined();
    expect(deleteCreate).toContain("SIGNAL SQLSTATE '45000'");
  });

  test("includes DROP TRIGGER IF EXISTS before each CREATE TRIGGER", () => {
    const result = generateAppendOnlyDDL("events");
    const drops = result.filter((s) => s.includes("DROP TRIGGER IF EXISTS"));
    expect(drops).toHaveLength(2);
  });

  test("uses backtick quoting for identifiers", () => {
    const result = generateAppendOnlyDDL("events");
    expect(result[1]).toContain("`events`");
    expect(result[1]).toContain("`proteus_ao_events_no_update`");
  });

  test("escapes backticks in table name", () => {
    expect(generateAppendOnlyDDL("my`table")).toMatchSnapshot();
  });

  test("does not include TRUNCATE trigger (not supported in MySQL)", () => {
    const result = generateAppendOnlyDDL("events");
    const truncate = result.find((s) => s.includes("TRUNCATE"));
    expect(truncate).toBeUndefined();
  });
});
