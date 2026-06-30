import { groupBy, keyBy } from "./group-by.js";
import { describe, expect, test } from "vitest";

describe("groupBy", () => {
  test("should group items by the selector key", () => {
    const result = groupBy(
      [
        { type: "a", n: 1 },
        { type: "b", n: 2 },
        { type: "a", n: 3 },
      ],
      (item) => item.type,
    );

    expect(result).toEqual(
      new Map([
        [
          "a",
          [
            { type: "a", n: 1 },
            { type: "a", n: 3 },
          ],
        ],
        ["b", [{ type: "b", n: 2 }]],
      ]),
    );
  });

  test("should preserve insertion order of keys", () => {
    const result = groupBy([3, 1, 2, 1, 3], (n) => n);
    expect([...result.keys()]).toEqual([3, 1, 2]);
  });

  test("should return an empty map for empty input", () => {
    expect(groupBy([], (x) => x)).toEqual(new Map());
  });
});

describe("keyBy", () => {
  test("should index items by the selector key", () => {
    const result = keyBy([{ id: "a" }, { id: "b" }], (item) => item.id);
    expect(result).toEqual(
      new Map([
        ["a", { id: "a" }],
        ["b", { id: "b" }],
      ]),
    );
  });

  test("should keep the last item when keys collide", () => {
    const result = keyBy(
      [
        { id: "a", n: 1 },
        { id: "a", n: 2 },
      ],
      (item) => item.id,
    );
    expect(result.get("a")).toEqual({ id: "a", n: 2 });
  });
});
