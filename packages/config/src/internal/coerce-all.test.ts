import { describe, expect, test } from "vitest";
import { z } from "zod";
import { coerceAll } from "./coerce-all.js";

describe("coerceAll", () => {
  describe("boolean", () => {
    const schema = coerceAll(z.boolean());

    test.each([
      ["true", true],
      ["1", true],
      ["yes", true],
      ["on", true],
      ["TRUE", true],
      ["false", false],
      ["0", false],
      ["no", false],
      ["off", false],
      ["", false],
      [true, true],
      [false, false],
    ] as const)("coerces %j → %j", (input, expected) => {
      expect(schema.parse(input)).toBe(expected);
    });

    test("does not treat the string 'false' as truthy (z.coerce.boolean footgun)", () => {
      expect(schema.parse("false")).toBe(false);
    });

    test("rejects an unrecognised token", () => {
      expect(() => schema.parse("maybe")).toThrow();
    });
  });

  describe("primitive coercion from strings", () => {
    test("coerces number", () => {
      expect(coerceAll(z.number()).parse("42")).toBe(42);
    });

    test("coerces bigint losslessly (beyond MAX_SAFE_INTEGER)", () => {
      expect(coerceAll(z.bigint()).parse("1521764590667698297")).toBe(
        1521764590667698297n,
      );
    });
  });

  describe("wrappers", () => {
    test("coerces inside a prefault-wrapped object", () => {
      const schema = coerceAll(
        z
          .object({ count: z.number(), flag: z.boolean() })
          .prefault({ count: 0, flag: false }),
      );
      expect(schema.parse({ count: "7", flag: "false" })).toEqual({
        count: 7,
        flag: false,
      });
    });

    test("coerces inside readonly and nonoptional wrappers", () => {
      expect(coerceAll(z.number().readonly()).parse("3")).toBe(3);
      expect(coerceAll(z.number().nonoptional()).parse("4")).toBe(4);
    });
  });
});
