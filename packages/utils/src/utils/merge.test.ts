import type { Dict } from "@lindorm/types";
import { merge } from "./merge.js";
import { describe, expect, test } from "vitest";

describe("merge", () => {
  test("should merge objects", () => {
    expect(
      merge<Dict>(
        {
          a: 1,
          b: 1,
          c: 1,
          d: 1,
        },
        {
          b: 2,
          c: 2,
          d: 2,
        },
        {
          c: 3,
          d: 4,
          e: 5,
        },
      ),
    ).toEqual({
      a: 1,
      b: 2,
      c: 3,
      d: 4,
      e: 5,
    });
  });

  test("should merge objects with arrays", () => {
    expect(
      merge<Dict>(
        {
          a: [1],
          b: [1],
          c: [1],
          d: [1],
        },
        {
          b: [2],
          c: [2],
          d: [2],
        },
        {
          c: [3],
          d: [4],
          e: [5],
        },
      ),
    ).toEqual({
      a: [1],
      b: [1, 2],
      c: [1, 2, 3],
      d: [1, 2, 4],
      e: [5],
    });
  });

  test("should assign built-in exotic objects by reference", () => {
    const regExp = /^cookie/;
    const set = new Set([1, 2]);
    const map = new Map([["a", 1]]);
    const bytes = new Uint8Array([1, 2, 3]);

    const result = merge<Dict>({ a: 1 }, { regExp, set, map, bytes });

    expect(result.regExp).toBe(regExp);
    expect(result.set).toBe(set);
    expect(result.map).toBe(map);
    expect(result.bytes).toBe(bytes);
  });

  test("should throw when merging an object into an exotic value", () => {
    expect(() => merge<Dict>({ a: new Map() }, { a: { b: 1 } })).toThrow(TypeError);
  });
});
