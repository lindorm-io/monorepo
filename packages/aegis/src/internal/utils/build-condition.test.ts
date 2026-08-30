import { describe, expect, test, vi } from "vitest";
import { buildCondition, type LeafHandler } from "./build-condition.js";

const equality: LeafHandler = (key, value) => [key, { $eq: value }];

describe("buildCondition", () => {
  test("should apply the leaf handler to every claim key at every level", () => {
    expect(
      buildCondition(
        { a: 1, $and: [{ b: 2 }, { $or: [{ c: 3 }, { $not: { d: 4 } }] }] },
        () => equality,
      ),
    ).toEqual({
      a: { $eq: 1 },
      $and: [
        { b: { $eq: 2 } },
        { $or: [{ c: { $eq: 3 } }, { $not: { d: { $eq: 4 } } }] },
      ],
    });
  });

  test("should key the output by what the leaf handler answers", () => {
    expect(
      buildCondition({ subject: "s", $or: [{ tokenId: "t" }] }, () => (key, value) => [
        `wire_${key}`,
        { $eq: value },
      ]),
    ).toEqual({ wire_subject: { $eq: "s" }, $or: [{ wire_tokenId: { $eq: "t" } }] });
  });

  // The factory is what scopes per-object state: a handler built for one
  // condition object never sees the keys of a sibling or a parent.
  test("should call the leaf factory once per condition object", () => {
    const createLeaf = vi.fn(() => equality);

    buildCondition(
      { a: 1, $and: [{ b: 2 }, { $or: [{ c: 3 }, { $not: { d: 4 } }] }] },
      createLeaf,
    );

    expect(createLeaf).toHaveBeenCalledTimes(6);
  });

  test("should hand each condition object its own leaf handler", () => {
    const seen: Array<Array<string>> = [];

    buildCondition({ a: 1, b: 2, $or: [{ a: 3 }, { c: 4, a: 5 }] }, () => {
      const keys: Array<string> = [];
      seen.push(keys);
      return (key, value) => {
        keys.push(key);
        return [key, { $eq: value }];
      };
    });

    expect(seen).toEqual([["a", "b"], ["a"], ["c", "a"]]);
  });

  test("should skip an undefined value at every level without consulting the leaf handler", () => {
    const leaf = vi.fn(equality);

    expect(
      buildCondition(
        {
          a: undefined,
          b: 1,
          $and: [{ c: undefined, d: 2 }, { $not: { e: undefined } }],
        },
        () => leaf,
      ),
    ).toEqual({ b: { $eq: 1 }, $and: [{ d: { $eq: 2 } }, { $not: {} }] });

    expect(leaf.mock.calls.map(([key]) => key)).toEqual(["b", "d"]);
  });

  test("should pass a $and or $or payload that is not an array through untouched", () => {
    const leaf = vi.fn(equality);
    const and = { a: 1 };
    const or = "x";

    const built = buildCondition({ $and: and, $or: or }, () => leaf);

    expect(built.$and).toBe(and);
    expect(built.$or).toBe(or);
    expect(leaf).not.toHaveBeenCalled();
  });

  test("should pass a $not payload that is not an object through untouched", () => {
    const leaf = vi.fn(equality);
    const not = ["a"];

    const built = buildCondition({ $not: not }, () => leaf);

    expect(built.$not).toBe(not);
    expect(leaf).not.toHaveBeenCalled();
  });

  test("should pass an empty $and or $or array through as an empty array", () => {
    expect(buildCondition({ $and: [], $or: [] }, () => equality)).toEqual({
      $and: [],
      $or: [],
    });
  });

  /**
   * ⛔ A CALLER-CHOSEN KEY IS DEFINED, NEVER ASSIGNED. `__proto__` assigned by
   * index onto a plain object swaps the prototype and creates no own key, so the
   * assertion is dropped. Asserted on the PROPERTY at the root and inside a
   * branch, never through `JSON.stringify`, which renders both outcomes alike.
   */
  test("should carry a __proto__ key as an own property at the root and inside a branch", () => {
    const condition = JSON.parse(
      String.raw`{"__proto__":"forged","$or":[{"__proto__":"nested"}]}`,
    );

    const built = buildCondition(condition, () => equality);
    const branch = (built.$or as Array<Record<string, unknown>>)[0];

    expect(Object.hasOwn(built, "__proto__")).toBe(true);
    expect(Object.getOwnPropertyDescriptor(built, "__proto__")?.value).toEqual({
      $eq: "forged",
    });
    expect(Object.hasOwn(branch, "__proto__")).toBe(true);
    expect(Object.getOwnPropertyDescriptor(branch, "__proto__")?.value).toEqual({
      $eq: "nested",
    });
  });

  test("should let a leaf handler's throw escape from inside a branch", () => {
    expect(() =>
      buildCondition({ $or: [{ a: 1 }, { $not: { b: 2 } }] }, () => (key) => {
        if (key === "b") throw new Error(`refused ${key}`);
        return [key, { $eq: 1 }];
      }),
    ).toThrow("refused b");
  });
});
