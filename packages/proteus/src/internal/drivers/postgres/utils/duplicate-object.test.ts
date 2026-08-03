import { isPgDuplicateObjectError } from "./duplicate-object.js";
import { describe, expect, it } from "vitest";

const makePgError = (code: string): Error => {
  const error = new Error(`pg error ${code}`);
  (error as Error & { code: string }).code = code;
  return error;
};

describe("isPgDuplicateObjectError", () => {
  it.each(["23505", "42710", "42P07", "42723"])(
    "should classify sqlstate %s as a duplicate object",
    (code) => {
      expect(isPgDuplicateObjectError(makePgError(code))).toBe(true);
    },
  );

  it.each(["55P03", "42501", "58P01", "23503", "3F000"])(
    "should not classify sqlstate %s as a duplicate object",
    (code) => {
      expect(isPgDuplicateObjectError(makePgError(code))).toBe(false);
    },
  );

  it("should return false for an error without a code", () => {
    expect(isPgDuplicateObjectError(new Error("boom"))).toBe(false);
  });

  it("should return false for a non-string code", () => {
    const error = new Error("boom");
    (error as Error & { code: unknown }).code = 23505;
    expect(isPgDuplicateObjectError(error)).toBe(false);
  });

  it.each([null, undefined, "23505", { code: "23505" }])(
    "should return false for the non-error value %s",
    (value) => {
      expect(isPgDuplicateObjectError(value)).toBe(false);
    },
  );
});
