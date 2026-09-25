import { describe, expect, test } from "vitest";
import { GherkinError } from "./GherkinError.js";

describe("GherkinError", () => {
  test("should extend Error directly", () => {
    expect(Object.getPrototypeOf(GherkinError)).toBe(Error);
    expect(new GherkinError("message", { code: "scope_violation" })).toBeInstanceOf(
      Error,
    );
  });

  test("should set name to GherkinError", () => {
    expect(new GherkinError("message", { code: "scope_violation" }).name).toEqual(
      "GherkinError",
    );
  });

  test("should carry exactly code, data, details, id, message, name and stack", () => {
    const error = new GherkinError("message", { code: "scope_violation" });

    expect(Object.getOwnPropertyNames(error).sort()).toEqual([
      "code",
      "data",
      "details",
      "id",
      "message",
      "name",
      "stack",
    ]);
  });

  test("should carry code, data, details and the file as id", () => {
    const error = new GherkinError("message", {
      code: "custom_code",
      data: { value: "data" },
      details: "details",
      file: "src/greeting.steps.ts",
    });

    expect({
      code: error.code,
      data: error.data,
      details: error.details,
      id: error.id,
      message: error.message,
    }).toMatchSnapshot();
  });

  test("should default data to an empty object", () => {
    expect(new GherkinError("message", { code: "scope_violation" }).data).toEqual({});
  });

  test("should default details to null", () => {
    expect(new GherkinError("message", { code: "scope_violation" }).details).toBeNull();
  });

  test("should default id to null", () => {
    expect(new GherkinError("message", { code: "scope_violation" }).id).toBeNull();
  });

  test("should retain the wrapped error as the ES cause", () => {
    const inner = new Error("inner");

    expect(
      new GherkinError("message", { code: "scope_violation", cause: inner }).cause,
    ).toBe(inner);
  });

  test("should leave cause absent when none is given", () => {
    expect(
      Object.hasOwn(new GherkinError("message", { code: "scope_violation" }), "cause"),
    ).toBe(false);
  });
});
