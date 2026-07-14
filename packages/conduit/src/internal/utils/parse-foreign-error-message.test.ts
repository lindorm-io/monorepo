import { describe, expect, test } from "vitest";
import { parseForeignErrorMessage } from "./parse-foreign-error-message.js";

describe("parseForeignErrorMessage", () => {
  test("should read a nested envelope message", () => {
    expect(parseForeignErrorMessage({ error: { message: "Too many" } })).toEqual(
      "Too many",
    );
  });

  test("should read a flat message", () => {
    expect(parseForeignErrorMessage({ message: "Too many" })).toEqual("Too many");
  });

  test("should read the oauth2 error_description", () => {
    expect(parseForeignErrorMessage({ error_description: "Grant expired" })).toEqual(
      "Grant expired",
    );
  });

  test("should read the problem+json detail", () => {
    expect(parseForeignErrorMessage({ detail: "Quota exceeded" })).toEqual(
      "Quota exceeded",
    );
  });

  test("should read the oauth2 error form", () => {
    expect(parseForeignErrorMessage({ error: "invalid_grant" })).toEqual("invalid_grant");
  });

  test("should read a text/plain body", () => {
    expect(parseForeignErrorMessage("Too Many Requests")).toEqual("Too Many Requests");
  });

  test("should prefer the nested envelope over a flat message", () => {
    expect(
      parseForeignErrorMessage({ message: "flat", error: { message: "nested" } }),
    ).toEqual("nested");
  });

  test("should prefer message over error_description", () => {
    expect(
      parseForeignErrorMessage({
        message: "Too many",
        error_description: "Grant expired",
      }),
    ).toEqual("Too many");
  });

  test("should return null when the body carries no message", () => {
    expect(parseForeignErrorMessage({ code: "rate_limited" })).toBeNull();
  });

  test("should return null for a blank message", () => {
    expect(parseForeignErrorMessage({ message: "   " })).toBeNull();
  });

  test("should return null for a non-object body", () => {
    expect(parseForeignErrorMessage(undefined)).toBeNull();
    expect(parseForeignErrorMessage(null)).toBeNull();
  });
});
