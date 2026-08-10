import { describe, expect, test } from "vitest";
import { guardFindSortKey } from "./guard-find-sort-key.js";

describe("guardFindSortKey", () => {
  test("should throw when orderBy is passed to an offset-based find", () => {
    expect(() => guardFindSortKey({ orderBy: { name: "ASC" } })).toThrow(
      "Invalid option `orderBy` for an offset-based find — use `order`",
    );
  });

  test("should pass for order", () => {
    expect(() => guardFindSortKey({ order: { name: "ASC" } })).not.toThrow();
  });

  test("should pass for undefined options", () => {
    expect(() => guardFindSortKey(undefined)).not.toThrow();
  });

  test("should pass when orderBy is present but undefined", () => {
    // `undefined` is ABSENT. Nothing was specified, so there is no footgun to
    // guard against — spreading an options object with an unset `orderBy` must
    // not blow up an otherwise valid find.
    expect(() =>
      guardFindSortKey({ order: { name: "ASC" }, orderBy: undefined }),
    ).not.toThrow();
  });
});
