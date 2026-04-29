import { generateAppendOnlyDDL } from "./generate-append-only-ddl.js";
import { describe, expect, test } from "vitest";

describe("generateAppendOnlyDDL (SQLite)", () => {
  test("generates triggers for a simple table", () => {
    expect(generateAppendOnlyDDL("audit_log")).toMatchSnapshot();
  });

  test("returns exactly 2 statements (update + delete)", () => {
    const result = generateAppendOnlyDDL("events");
    expect(result).toHaveLength(2);
  });

  test("generates BEFORE UPDATE trigger", () => {
    const result = generateAppendOnlyDDL("events");
    const update = result.find((s) => s.includes("BEFORE UPDATE"));
    expect(update).toBeDefined();
    expect(update).toContain("CREATE TRIGGER IF NOT EXISTS");
    expect(update).toContain("FOR EACH ROW");
    expect(update).toContain("RAISE(ABORT");
  });

  test("generates BEFORE DELETE trigger", () => {
    const result = generateAppendOnlyDDL("events");
    const del = result.find((s) => s.includes("BEFORE DELETE"));
    expect(del).toBeDefined();
    expect(del).toContain("CREATE TRIGGER IF NOT EXISTS");
    expect(del).toContain("RAISE(ABORT");
  });

  test("uses double-quote quoting for identifiers", () => {
    const result = generateAppendOnlyDDL("events");
    expect(result[0]).toContain('"events"');
    expect(result[0]).toContain('"proteus_ao_events_no_update"');
  });

  test("escapes double quotes in table name", () => {
    expect(generateAppendOnlyDDL('my"table')).toMatchSnapshot();
  });

  test("does not include TRUNCATE trigger (not supported in SQLite)", () => {
    const result = generateAppendOnlyDDL("events");
    const truncate = result.find((s) => s.includes("TRUNCATE"));
    expect(truncate).toBeUndefined();
  });

  test("uses IF NOT EXISTS for idempotent creation", () => {
    const result = generateAppendOnlyDDL("events");
    expect(result.every((s) => s.includes("IF NOT EXISTS"))).toBe(true);
  });
});
