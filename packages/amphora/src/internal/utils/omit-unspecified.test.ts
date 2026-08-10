import { describe, expect, test } from "vitest";
import { omitUnspecified } from "./omit-unspecified.js";

describe("omitUnspecified", () => {
  test("should drop a key holding undefined", () => {
    const result = omitUnspecified({ use: "sig", publish: undefined });

    expect(result).toEqual({ use: "sig" });
    expect("publish" in result).toBe(false);
  });

  test("should keep every falsy value that is not undefined", () => {
    expect(
      omitUnspecified({ publish: false, isActive: false, ownerId: null, id: "" }),
    ).toEqual({ publish: false, isActive: false, ownerId: null, id: "" });
  });

  test("should keep an explicit true", () => {
    expect("publish" in omitUnspecified({ publish: true })).toBe(true);
  });

  test("should return an empty condition for a condition of only undefined values", () => {
    expect(omitUnspecified({ publish: undefined, purpose: undefined })).toEqual({});
  });

  test("should return a fresh object, mutating nothing", () => {
    const condition = { use: "sig" as const, publish: undefined };
    const result = omitUnspecified(condition);

    expect(result).not.toBe(condition);
    expect("publish" in condition).toBe(true);
  });

  // TOP-LEVEL only. A recursive strip rebuilds an operator's operand, and a
  // `RegExp` has no own enumerable properties — so `{ $regex: /^cookie/ }` would
  // come back as `{ $regex: {} }`, matching everything instead of one purpose.
  test("should leave an operator operand untouched, RegExp included", () => {
    const regex = /^cookie/;
    const result = omitUnspecified({ purpose: { $regex: regex } });

    expect((result.purpose as { $regex: RegExp }).$regex).toBe(regex);
  });

  // The recursion would reach here too: an operand's own `undefined` member is
  // the operator's business, not this function's.
  test("should not strip undefined from inside an operand", () => {
    const result = omitUnspecified({ purpose: { $in: ["cookie"], $exists: undefined } });

    expect(result.purpose).toEqual({ $in: ["cookie"], $exists: undefined });
  });
});
