import { describe, expect, test } from "vitest";
import { deserialise } from "./deserialise.js";
import { serialise, serialiseArray } from "./serialise.js";

describe("serialise", () => {
  describe("bigint", () => {
    test("should stringify a bigint", () => {
      expect(serialise(9007199254740993n, "bigint")).toBe("9007199254740993");
    });

    test("should stringify a number for a bigint field", () => {
      expect(serialise(10, "bigint")).toBe("10");
    });

    test("should round-trip through deserialise", () => {
      expect(deserialise(serialise(42n, "bigint"), "bigint")).toBe(42n);
    });

    test("should pass null through", () => {
      expect(serialise(null, "bigint")).toBeNull();
    });
  });

  describe("date / timestamp", () => {
    test("should convert a Date to an ISO string", () => {
      const date = new Date("2024-01-15T12:00:00.000Z");
      expect(serialise(date, "timestamp")).toBe("2024-01-15T12:00:00.000Z");
    });

    test("should round-trip a timestamp through deserialise", () => {
      const date = new Date("2024-02-20T08:30:45.123Z");
      const result = deserialise(serialise(date, "timestamp"), "timestamp");
      expect(result).toEqual(date);
    });

    test("should pass a non-Date through untouched", () => {
      expect(serialise("2024-01-15", "date")).toBe("2024-01-15");
    });
  });

  describe("passthrough types", () => {
    test("should pass numbers through", () => {
      expect(serialise(3.14, "float")).toBe(3.14);
    });

    test("should pass booleans through", () => {
      expect(serialise(true, "boolean")).toBe(true);
    });

    test("should pass strings through", () => {
      expect(serialise("hello", "string")).toBe("hello");
    });

    test("should pass decimals through in both modes", () => {
      expect(serialise(1.5, "decimal")).toBe(1.5);
      expect(serialise("1.5", "decimal", "string")).toBe("1.5");
    });
  });
});

describe("serialiseArray", () => {
  test("should serialise each element of a bigint array", () => {
    expect(serialiseArray([1n, 2n], "bigint")).toEqual(["1", "2"]);
  });

  test("should serialise each element of a timestamp array", () => {
    const dates = [
      new Date("2024-01-15T12:00:00.000Z"),
      new Date("2024-02-20T08:30:45.123Z"),
    ];
    expect(serialiseArray(dates, "timestamp")).toEqual([
      "2024-01-15T12:00:00.000Z",
      "2024-02-20T08:30:45.123Z",
    ]);
  });

  test("should leave primitive arrays untouched", () => {
    expect(serialiseArray([1, 2, 3], "integer")).toEqual([1, 2, 3]);
    expect(serialiseArray(["a", "b"], "string")).toEqual(["a", "b"]);
    expect(serialiseArray([true, false], "boolean")).toEqual([true, false]);
  });

  test("should round-trip a bigint array through deserialise", () => {
    const serialised = serialiseArray([9007199254740993n, 10n], "bigint");
    expect(deserialise(serialised, "array", null, "bigint")).toEqual([
      9007199254740993n,
      10n,
    ]);
  });

  test("should pass a non-array value through", () => {
    expect(serialiseArray(null, "bigint")).toBeNull();
    expect(serialiseArray("x", "string")).toBe("x");
  });
});
