import { hashIdentifier } from "../../../drivers/postgres/utils/hash-identifier.js";
import { describe, expect, test } from "vitest";

describe("hashIdentifier", () => {
  test("returns an 11-character base64url string", () => {
    const result = hashIdentifier("some_input");
    expect(result).toHaveLength(11);
    expect(result).toMatch(/^[A-Za-z0-9_-]{11}$/);
  });

  test("is deterministic — same input always produces same output", () => {
    expect(hashIdentifier("table_column")).toBe(hashIdentifier("table_column"));
  });

  test("produces different hashes for different inputs", () => {
    const a = hashIdentifier("orders_userId");
    const b = hashIdentifier("orders_companyId");
    expect(a).not.toBe(b);
  });

  test("snapshot for known input (regression guard)", () => {
    expect(hashIdentifier("users_email")).toMatchSnapshot();
  });

  test("snapshot for empty string input", () => {
    expect(hashIdentifier("")).toMatchSnapshot();
  });

  test("snapshot for long input", () => {
    expect(hashIdentifier("a".repeat(200))).toMatchSnapshot();
  });

  test("handles unicode and special characters", () => {
    const result = hashIdentifier("users_émojis_🎉");
    expect(result).toHaveLength(11);
    expect(result).toMatch(/^[A-Za-z0-9_-]{11}$/);
    expect(result).toMatchSnapshot();
  });
});
