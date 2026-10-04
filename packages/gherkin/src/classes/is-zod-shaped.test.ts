import { describe, expect, test } from "vitest";
import { z } from "zod";
import { z as zMini } from "zod/mini";
import { z as z3 } from "zod/v3";
import { errorNamed, ZOD_ISSUES as ISSUES } from "../__fixtures__/test-helpers.js";
import { isZodShaped } from "./is-zod-shaped.js";

const thrownBy = (parse: () => unknown): unknown => {
  try {
    parse();
  } catch (error) {
    return error;
  }
  throw new Error("expected parse to throw");
};

describe("isZodShaped", () => {
  test("should match the error a real zod 4 classic parse throws", () => {
    expect(isZodShaped(thrownBy(() => z.coerce.number().parse("oops")))).toBe(true);
  });

  test("should match the error a real zod/mini parse throws", () => {
    expect(isZodShaped(thrownBy(() => zMini.coerce.number().parse("oops")))).toBe(true);
  });

  test("should match the error a real zod 3 parse throws", () => {
    expect(isZodShaped(thrownBy(() => z3.coerce.number().parse("oops")))).toBe(true);
  });

  test("should match a zod 4 ZodError and $ZodError a consumer built, though neither is an Error", () => {
    const classic = new z.ZodError(ISSUES);
    const core = new z.core.$ZodError(ISSUES);

    expect(classic).not.toBeInstanceOf(Error);
    expect(core).not.toBeInstanceOf(Error);
    expect(isZodShaped(classic)).toBe(true);
    expect(isZodShaped(core)).toBe(true);
  });

  test("should match an Error named ZodError or $ZodError carrying an issues array — the shape is all a foreign zod copy presents", () => {
    expect(isZodShaped(errorNamed("ZodError", ISSUES))).toBe(true);
    expect(isZodShaped(errorNamed("$ZodError", ISSUES))).toBe(true);
  });

  test("should match a plain object named ZodError or $ZodError carrying an issues array", () => {
    expect(isZodShaped({ name: "ZodError", issues: ISSUES })).toBe(true);
    expect(isZodShaped({ name: "$ZodError", issues: [] })).toBe(true);
  });

  test("should reject an object named ZodError whose issues is not an array", () => {
    expect(isZodShaped(errorNamed("ZodError"))).toBe(false);
    expect(isZodShaped({ name: "ZodError" })).toBe(false);
    expect(isZodShaped({ name: "$ZodError", issues: { 0: ISSUES[0] } })).toBe(false);
  });

  test("should reject an object carrying an issues array under any other name", () => {
    expect(isZodShaped(errorNamed("ValidationError", ISSUES))).toBe(false);
    expect(isZodShaped({ name: "zodError", issues: ISSUES })).toBe(false);
    expect(isZodShaped({ issues: ISSUES })).toBe(false);
  });

  test("should reject zod's sync-parse-of-async error", () => {
    const asyncError = thrownBy(() =>
      z
        .string()
        .refine(async () => true)
        .parse("x"),
    );

    expect((asyncError as Error).message).toBe(
      "Encountered Promise during synchronous parse. Use .parseAsync() instead.",
    );
    expect(isZodShaped(asyncError)).toBe(false);
  });

  test("should reject values that are not objects", () => {
    expect(isZodShaped(undefined)).toBe(false);
    expect(isZodShaped(null)).toBe(false);
    expect(isZodShaped("ZodError")).toBe(false);
    expect(isZodShaped(42)).toBe(false);
  });
});
