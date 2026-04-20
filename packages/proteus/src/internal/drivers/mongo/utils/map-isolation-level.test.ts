import { mapIsolationLevel } from "./map-isolation-level";
import { describe, expect, test } from "vitest";

describe("mapIsolationLevel", () => {
  test("should return majority concern for READ COMMITTED", () => {
    expect(mapIsolationLevel("READ COMMITTED")).toMatchSnapshot();
  });

  test("should return snapshot concern for REPEATABLE READ", () => {
    expect(mapIsolationLevel("REPEATABLE READ")).toMatchSnapshot();
  });

  test("should return snapshot concern for SERIALIZABLE", () => {
    expect(mapIsolationLevel("SERIALIZABLE")).toMatchSnapshot();
  });

  test("should default to majority concern when no isolation level specified", () => {
    expect(mapIsolationLevel()).toMatchSnapshot();
  });

  test("should default to majority concern for undefined", () => {
    expect(mapIsolationLevel(undefined)).toMatchSnapshot();
  });
});
