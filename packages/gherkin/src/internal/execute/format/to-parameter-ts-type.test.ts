import { describe, expect, test } from "vitest";
import { toParameterTsType } from "./to-parameter-ts-type.js";

describe("toParameterTsType", () => {
  test("should map built-in constructor names to TypeScript types", () => {
    expect(toParameterTsType("String")).toBe("string");
    expect(toParameterTsType("Number")).toBe("number");
    expect(toParameterTsType("BigInt")).toBe("bigint");
  });

  test("should render unknown for custom parameter types and unrecognised names", () => {
    expect(toParameterTsType(null)).toBe("unknown");
    expect(toParameterTsType("Buffer")).toBe("unknown");
  });
});
