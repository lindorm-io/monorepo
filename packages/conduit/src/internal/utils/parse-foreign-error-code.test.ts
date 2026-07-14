import { describe, expect, test } from "vitest";
import { parseForeignErrorCode } from "./parse-foreign-error-code.js";

describe("parseForeignErrorCode", () => {
  test("should read a nested envelope code", () => {
    expect(parseForeignErrorCode({ error: { code: "rate_limited" } })).toEqual(
      "rate_limited",
    );
  });

  test("should read a flat code", () => {
    expect(parseForeignErrorCode({ code: "rate_limited" })).toEqual("rate_limited");
  });

  test("should read a numeric code", () => {
    expect(parseForeignErrorCode({ code: 42 })).toEqual(42);
  });

  test("should read a snake_case error_code", () => {
    expect(parseForeignErrorCode({ error_code: "rate_limited" })).toEqual("rate_limited");
  });

  test("should read a camelCase errorCode", () => {
    expect(parseForeignErrorCode({ errorCode: "rate_limited" })).toEqual("rate_limited");
  });

  test("should read the oauth2 error form", () => {
    expect(parseForeignErrorCode({ error: "invalid_grant" })).toEqual("invalid_grant");
  });

  test("should prefer the nested envelope over a flat code", () => {
    expect(parseForeignErrorCode({ code: "flat", error: { code: "nested" } })).toEqual(
      "nested",
    );
  });

  test("should skip an error object carrying no code", () => {
    expect(
      parseForeignErrorCode({ code: "flat", error: { message: "no code here" } }),
    ).toEqual("flat");
  });

  test("should return null when the body names no code", () => {
    expect(parseForeignErrorCode({ message: "nope" })).toBeNull();
  });

  test("should return null for an empty string code", () => {
    expect(parseForeignErrorCode({ code: "" })).toBeNull();
  });

  test("should return null for a non-object body", () => {
    expect(parseForeignErrorCode("rate limited")).toBeNull();
    expect(parseForeignErrorCode(undefined)).toBeNull();
    expect(parseForeignErrorCode(null)).toBeNull();
  });
});
