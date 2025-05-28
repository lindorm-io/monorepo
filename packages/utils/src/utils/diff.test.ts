import { diff, diffAny, diffObject } from "./diff";

describe("diff", () => {
  test("should return an empty array if all elements are in source", () => {
    expect(diff([1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 5])).toEqual([]);
  });

  test("should return array of items if not all elements are in source", () => {
    expect(diff([1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 5, 10])).toEqual([10]);
  });

  test("should return array of items in complex object array", () => {
    expect(
      diff([{ test: 1 }, { test: 2 }, { test: 3 }], [{ test: 1 }, { test: 4 }]),
    ).toEqual([{ test: 4 }]);
  });
});

describe("diffAny", () => {
  test("should return array of all items not equal in source or target", () => {
    expect(diffAny([1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 5, 10])).toEqual([
      10, 6, 7, 8, 9,
    ]);
  });
});

describe("diffObject", () => {
  test("returns empty for identical flat objects", () => {
    const a = { x: 1, y: "foo" };
    const patch = diffObject(a, { ...a });
    expect(patch).toEqual({});
  });

  test("detects added keys", () => {
    const src = { a: 1 };
    const tgt = { a: 1, b: 2 };
    const patch = diffObject(src, tgt);
    expect(patch).toEqual({ b: 2 });
  });

  test("detects removed keys", () => {
    const src = { a: 1, b: 2 };
    const tgt = { a: 1 };
    const patch = diffObject(src, tgt);
    expect(patch).toEqual({ b: undefined });
  });

  test("overwrites changed primitive values", () => {
    const src = { a: 1, b: true, c: "foo" };
    const tgt = { a: 2, b: false, c: "foo" };
    const patch = diffObject(src, tgt);
    expect(patch).toEqual({ a: 2, b: false });
  });

  test("overwrites when type changes", () => {
    const src = { a: 1, b: { nested: true } };
    const tgt = { a: { nested: false }, b: 42 };
    const patch = diffObject(src, tgt);
    expect(patch).toEqual({
      a: { nested: false },
      b: 42,
    });
  });

  test("handles nested object diffs", () => {
    const src = {
      a: { x: 1, y: 2 },
      b: { foo: "bar" },
    };
    const tgt = {
      a: { x: 1, y: 3, z: 4 },
      b: { foo: "bar" },
    };
    const patch = diffObject(src, tgt);
    expect(patch).toEqual({
      a: {
        y: 3,
        z: 4,
      },
    });
  });

  test("multiple nested additions and removals", () => {
    const src = {
      outer: {
        keep: true,
        removeMe: "gone",
      },
    };
    const tgt = {
      outer: {
        keep: true,
        addMe: 123,
      },
    };
    const patch = diffObject(src, tgt);
    expect(patch).toEqual({
      outer: {
        removeMe: undefined,
        addMe: 123,
      },
    });
  });

  test("arrays are overwritten, not recursed", () => {
    const src = { list: [1, 2, 3] };
    const tgt = { list: [1, 2, 4] };
    const patch = diffObject(src, tgt);
    expect(patch).toEqual({ list: [1, 2, 4] });
  });

  test("Date values get overwritten when unequal", () => {
    const date1 = new Date("2023-01-01");
    const date2 = new Date("2024-01-01");
    const src = { when: date1 };
    const tgt = { when: date2 };
    const patch = diffObject(src, tgt);
    expect(patch).toEqual({ when: date2 });
  });

  test("handles completely new nested object", () => {
    const src = {};
    const tgt = { nested: { a: 1 } };
    const patch = diffObject(src, tgt);
    expect(patch).toEqual({ nested: { a: 1 } });
  });

  test("handles removal of entire nested object", () => {
    const src = { nested: { a: 1 } };
    const tgt = {};
    const patch = diffObject(src, tgt);
    expect(patch).toEqual({ nested: undefined });
  });

  test("cycle safety: does not infinite-loop on self-references", () => {
    const a: any = { foo: {} };
    a.foo.self = a.foo;
    const b: any = { foo: {} };
    b.foo.self = b.foo;

    // Even though they’re structurally equal, we expect no crash and empty patch
    expect(() => diffObject(a, b)).not.toThrow();
    expect(diffObject(a, b)).toEqual({});
  });

  test("mixed additions, removals, and changes at top level", () => {
    const src = { keep: 1, change: "old", remove: true };
    const tgt = { keep: 1, change: "new", add: 2 };
    const patch = diffObject(src, tgt);
    expect(patch).toEqual({
      change: "new",
      remove: undefined,
      add: 2,
    });
  });

  test("deeply nested combination of all cases", () => {
    const src = {
      level1: {
        level2: {
          foo: "bar",
          toRemove: 5,
        },
        keep: true,
      },
    };
    const tgt = {
      level1: {
        level2: {
          foo: "baz",
          newKey: "added",
        },
        keep: true,
      },
    };
    const patch = diffObject(src, tgt);
    expect(patch).toEqual({
      level1: {
        level2: {
          foo: "baz",
          toRemove: undefined,
          newKey: "added",
        },
      },
    });
  });
});
