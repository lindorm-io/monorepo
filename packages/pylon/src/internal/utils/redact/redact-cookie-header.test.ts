import { describe, expect, test } from "vitest";
import { redactCookieHeader, redactSetCookieHeader } from "./redact-cookie-header.js";

describe("redactCookieHeader", () => {
  test("should keep cookie names and filter every value", () => {
    const redacted = redactCookieHeader("sid=abc123; theme=dark");

    expect(redacted).toMatchSnapshot();
    expect(redacted).not.toContain("abc123");
    expect(redacted).not.toContain("dark");
  });

  test("should keep the name of a single cookie", () => {
    expect(redactCookieHeader("sid=abc123")).toMatchSnapshot();
  });

  test("should filter a value containing an equals sign in full", () => {
    const redacted = redactCookieHeader("sid=YWJjPT09; theme=dark");

    expect(redacted).toMatchSnapshot();
    expect(redacted).not.toContain("YWJjPT09");
  });

  test("should filter a malformed pair with no equals sign", () => {
    expect(redactCookieHeader("sid=abc123; malformed")).toMatchSnapshot();
  });

  test("should tolerate surplus whitespace and empty pairs", () => {
    expect(redactCookieHeader("  sid=abc123 ;; theme=dark ; ")).toMatchSnapshot();
  });

  test.each([undefined, null, "", 0, {}])("should filter %p", (input) => {
    expect(redactCookieHeader(input)).toBe("[Filtered]");
  });
});

describe("redactSetCookieHeader", () => {
  test("should keep the name and attributes of each set cookie, filtering the value", () => {
    const redacted = redactSetCookieHeader([
      "sid=abc123; Path=/; HttpOnly; SameSite=Strict",
      "theme=dark; Path=/",
    ]);

    expect(redacted).toMatchSnapshot();
    expect(JSON.stringify(redacted)).not.toContain("abc123");
    expect(JSON.stringify(redacted)).not.toContain("dark");
  });

  test("should redact a single set-cookie string", () => {
    expect(redactSetCookieHeader("sid=abc123; Path=/; HttpOnly")).toMatchSnapshot();
  });

  test("should filter a set-cookie with no equals sign", () => {
    expect(redactSetCookieHeader("malformed")).toMatchSnapshot();
  });

  test.each([undefined, null, ""])("should filter %p", (input) => {
    expect(redactSetCookieHeader(input)).toBe("[Filtered]");
  });
});
