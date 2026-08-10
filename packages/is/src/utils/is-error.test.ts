import vm from "node:vm";
import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isError } from "./is-error.js";
import { describe, expect, test } from "vitest";

describe("isError", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isError(value)).toMatchSnapshot();
  });

  test.each([
    ["Error", new Error("x")],
    ["TypeError", new TypeError("x")],
    ["subclass", new (class Custom extends Error {})("x")],
  ])("should resolve a real %s", (_, value) => {
    expect(isError(value)).toBe(true);
  });

  // The reason a fallback exists at all: an Error from another realm fails
  // `instanceof` against ours, but still carries the `[object Error]` tag.
  test("should resolve an Error from another realm", () => {
    const foreign = vm.runInContext("new TypeError('x')", vm.createContext({}));

    expect(foreign instanceof Error).toBe(false);
    expect(isError(foreign)).toBe(true);
  });

  // Ordinary data trips a `name` + `message` duck-type by accident — a form
  // field, a contact record, a log entry. None of it is an Error.
  test.each([
    ["name and message", { name: "a", message: "b" }],
    ["with extra keys", { name: "a", message: "b", extra: 1 }],
    ["empty object", {}],
    ["string", "an error happened"],
  ])("should NOT resolve plain data: %s", (_, value) => {
    expect(isError(value)).toBe(false);
  });
});
