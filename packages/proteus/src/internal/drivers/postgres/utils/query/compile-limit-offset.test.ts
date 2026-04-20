import { compileLimitOffset } from "./compile-limit-offset";
import { describe, expect, test } from "vitest";

describe("compileLimitOffset", () => {
  test("should return empty string when both null", () => {
    expect(compileLimitOffset(null, null, [])).toBe("");
  });

  test("should compile LIMIT only", () => {
    const params: Array<unknown> = [];
    const result = compileLimitOffset(null, 10, params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([10]);
  });

  test("should compile OFFSET only", () => {
    const params: Array<unknown> = [];
    const result = compileLimitOffset(20, null, params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([20]);
  });

  test("should compile LIMIT and OFFSET", () => {
    const params: Array<unknown> = [];
    const result = compileLimitOffset(20, 10, params);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([10, 20]);
  });

  test("should increment params from existing array", () => {
    const params: Array<unknown> = ["existing1", "existing2"];
    const result = compileLimitOffset(5, 25, params);
    expect(result).toContain("$3");
    expect(result).toContain("$4");
    expect(params).toEqual(["existing1", "existing2", 25, 5]);
  });

  describe("zero values — != null guard correctly handles 0", () => {
    // take: 0 / skip: 0 must produce SQL — zero is a valid LIMIT/OFFSET value,
    // and `0 != null` is true, so neither should be falsy-skipped.

    test("should compile LIMIT 0", () => {
      const params: Array<unknown> = [];
      const result = compileLimitOffset(null, 0, params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual([0]);
      expect(result).toContain("LIMIT $1");
    });

    test("should compile OFFSET 0", () => {
      const params: Array<unknown> = [];
      const result = compileLimitOffset(0, null, params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual([0]);
      expect(result).toContain("OFFSET $1");
    });

    test("should compile LIMIT 0 and OFFSET 0", () => {
      const params: Array<unknown> = [];
      const result = compileLimitOffset(0, 0, params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual([0, 0]);
      expect(result).toContain("LIMIT $1");
      expect(result).toContain("OFFSET $2");
    });
  });
});
