import { describe, expect, test } from "vitest";
import { assertValidErrorType, createErrorTypeUrn } from "./error-type.js";

describe("createErrorTypeUrn", () => {
  test("derives slug from a string code", () => {
    expect(createErrorTypeUrn("unknown_error", "LindormError")).toBe(
      "urn:lindorm:error:unknown_error",
    );
  });

  test("derives slug from the class name when code is null", () => {
    expect(createErrorTypeUrn(null, "NotFoundError")).toBe("urn:lindorm:error:not_found");
  });

  test("derives slug from the class name when code is a number", () => {
    expect(createErrorTypeUrn(418, "ImATeapotError")).toBe(
      "urn:lindorm:error:im_a_teapot",
    );
  });

  test("maps the base LindormError to unknown rather than the brand name", () => {
    expect(createErrorTypeUrn(null, "LindormError")).toBe("urn:lindorm:error:unknown");
  });

  test("falls back to unknown when the slug is empty", () => {
    expect(createErrorTypeUrn(null, "Error")).toBe("urn:lindorm:error:unknown");
  });

  test("falls back to unknown when an empty string code resolves to empty slug", () => {
    expect(createErrorTypeUrn("", "Error")).toBe("urn:lindorm:error:unknown");
  });

  test("inserts the namespace segment when provided", () => {
    expect(createErrorTypeUrn("invalid_origin", "CorsError", "pylon")).toBe(
      "urn:lindorm:pylon:error:invalid_origin",
    );
  });

  test("derives a namespaced slug from the class name when code is null", () => {
    expect(createErrorTypeUrn(null, "CorsError", "pylon")).toBe(
      "urn:lindorm:pylon:error:cors",
    );
  });

  test("collapses a class name that equals the namespace to unknown", () => {
    expect(createErrorTypeUrn(null, "PylonError", "pylon")).toBe(
      "urn:lindorm:pylon:error:unknown",
    );
  });
});

describe("assertValidErrorType", () => {
  test("accepts a lowercase urn", () => {
    expect(() => assertValidErrorType("urn:lindorm:error:not_found")).not.toThrow();
  });

  test("accepts an uppercase URN", () => {
    expect(() => assertValidErrorType("URN:lindorm:error:not_found")).not.toThrow();
  });

  test("throws a TypeError for a non-urn value", () => {
    expect(() => assertValidErrorType("not_found")).toThrow(TypeError);
    expect(() => assertValidErrorType("not_found")).toThrow(
      'Invalid error type "not_found": must be a URN (e.g. "urn:lindorm:error:...")',
    );
  });
});
