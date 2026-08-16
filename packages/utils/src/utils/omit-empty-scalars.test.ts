import { describe, expect, test } from "vitest";
import { omitEmpty } from "./omit-empty.js";
import { omitEmptyScalars } from "./omit-empty-scalars.js";

describe("omitEmptyScalars", () => {
  describe("empty scalars are removed", () => {
    test("should remove an empty-string property", () => {
      expect(omitEmptyScalars({ a: "" })).toMatchSnapshot();
    });

    test("should remove a null property", () => {
      expect(omitEmptyScalars({ a: null })).toMatchSnapshot();
    });

    test("should remove an undefined property", () => {
      expect(omitEmptyScalars({ a: undefined })).toMatchSnapshot();
    });

    test("should remove empty scalars from an array and reindex", () => {
      expect(
        omitEmptyScalars({ a: ["pwd", "", null, undefined, "otp"] }),
      ).toMatchSnapshot();
    });
  });

  describe("containers always survive", () => {
    test("should keep an object that becomes empty after cleaning", () => {
      expect(omitEmptyScalars({ a: { b: "" } })).toMatchSnapshot();
    });

    test("should keep an array that becomes empty after cleaning", () => {
      expect(omitEmptyScalars({ a: ["", ""] })).toMatchSnapshot();
    });

    test("should keep a container that was already empty on input", () => {
      expect(omitEmptyScalars({ a: [], b: {} })).toMatchSnapshot();
    });

    test("should keep an emptied object nested in an array", () => {
      expect(omitEmptyScalars([{ a: "" }])).toMatchSnapshot();
    });

    test("should keep containers at every level of a deep nest", () => {
      expect(
        omitEmptyScalars({
          a: { b: { c: "" } },
          d: [[{ e: null }], []],
          keep: 1,
        }),
      ).toMatchSnapshot();
    });
  });

  describe("falsy values that are NOT empty", () => {
    test("should keep zero", () => {
      expect(omitEmptyScalars({ a: 0 })).toMatchSnapshot();
    });

    test("should keep false", () => {
      expect(omitEmptyScalars({ a: false })).toMatchSnapshot();
    });

    test("should keep zero, false and NaN wherever they appear", () => {
      expect(
        omitEmptyScalars({ a: [0, false, NaN, ""], b: { c: 0, d: false, e: null } }),
      ).toMatchSnapshot();
    });
  });

  describe("input handling", () => {
    test("should clean a top-level array", () => {
      expect(omitEmptyScalars(["a", "", null, undefined, 0])).toMatchSnapshot();
    });

    test("should throw on an unsupported input", () => {
      // @ts-expect-error — testing the runtime guard
      expect(() => omitEmptyScalars("string")).toThrow(TypeError);
      // @ts-expect-error — testing the runtime guard
      expect(() => omitEmptyScalars(null)).toThrow(TypeError);
    });
  });

  describe("exotic values", () => {
    test("should carry exotics through by reference without walking them", () => {
      const buffer = Buffer.from([1, 2, 3]);
      const bytes = new Uint8Array([1, 2, 3]);
      const date = new Date("2026-08-14T00:00:00.000Z");
      const regExp = /^cookie/;
      const url = new URL("https://test.lindorm.io");
      const map = new Map([["a", 1]]);
      const set = new Set([1, 2]);

      const result = omitEmptyScalars({
        buffer,
        bytes,
        date,
        regExp,
        url,
        map,
        set,
        gone: "",
      });

      expect(result.buffer).toBe(buffer);
      expect(result.bytes).toBe(bytes);
      expect(result.date).toBe(date);
      expect(result.regExp).toBe(regExp);
      expect(result.url).toBe(url);
      expect(result.map).toBe(map);
      expect(result.set).toBe(set);
      expect(result).not.toHaveProperty("gone");
    });

    test("should keep an EMPTY Map/Set where omitEmpty strips it", () => {
      const emptyMap = new Map();
      const emptySet = new Set();
      const emptyBuffer = Buffer.alloc(0);

      const result = omitEmptyScalars({ emptyMap, emptySet, emptyBuffer });

      expect(result.emptyMap).toBe(emptyMap);
      expect(result.emptySet).toBe(emptySet);
      expect(result.emptyBuffer).toBe(emptyBuffer);

      // The divergence is the whole reason this function exists — assert it
      // against the sibling so a change to either is caught here.
      expect(omitEmpty({ emptyMap, emptySet })).toEqual({});
    });
  });

  describe("divergence from omitEmpty", () => {
    test("should keep every container omitEmpty destroys", () => {
      const input = { a: { b: { c: "" } }, d: [], e: {}, keep: 1 };

      expect(omitEmptyScalars(input)).toMatchSnapshot();
      expect(omitEmpty(input)).toMatchSnapshot();
    });

    test("should not mutate its input", () => {
      const input = { a: { b: "" }, c: ["", "x"] };

      omitEmptyScalars(input);

      expect(input).toEqual({ a: { b: "" }, c: ["", "x"] });
    });
  });
});
