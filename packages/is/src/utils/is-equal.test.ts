import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isEqual } from "./is-equal.js";
import { describe, expect, test } from "vitest";

describe("isEqual", () => {
  test.each(Object.entries(TEST_FIXTURES))(
    "should return true for identical %s",
    (_, value) => {
      expect(isEqual(value, value)).toBe(true);
    },
  );

  test("should return true for deeply equal objects", () => {
    const objA = { foo: { bar: "baz" } };
    const objB = { foo: { bar: "baz" } };
    expect(isEqual(objA, objB)).toBe(true);
  });

  test("should return false for objects with different structures", () => {
    const objA = { foo: { bar: "baz" } };
    const objB = { foo: { baz: "bar" } };
    expect(isEqual(objA, objB)).toBe(false);
  });

  test("should return true for deeply equal arrays", () => {
    const arrayA = [1, 2, { foo: "bar" }];
    const arrayB = [1, 2, { foo: "bar" }];
    expect(isEqual(arrayA, arrayB)).toBe(true);
  });

  test("should return false for arrays with different lengths", () => {
    const arrayA = [1, 2, 3];
    const arrayB = [1, 2];
    expect(isEqual(arrayA, arrayB)).toBe(false);
  });

  test("should return true for equal Dates", () => {
    const dateA = new Date("2024-01-01");
    const dateB = new Date("2024-01-01");
    expect(isEqual(dateA, dateB)).toBe(true);
  });

  test("should return false for non-equal Dates", () => {
    const dateA = new Date("2024-01-01");
    const dateB = new Date("2023-12-31");
    expect(isEqual(dateA, dateB)).toBe(false);
  });

  test("should handle circular references", () => {
    const objA: any = { foo: {} };
    const objB: any = { foo: {} };
    objA.foo.self = objA.foo;
    objB.foo.self = objB.foo;

    expect(isEqual(objA, objB)).toBe(true);
  });

  test("should return false for different types", () => {
    const valueA = "string";
    const valueB = 123;
    expect(isEqual(valueA, valueB)).toBe(false);
  });

  test("should handle special cases", () => {
    expect(isEqual(NaN, NaN)).toBe(true);
    expect(isEqual(Infinity, Infinity)).toBe(true);
    expect(isEqual(-Infinity, -Infinity)).toBe(true);
    expect(isEqual(Buffer.from("test"), Buffer.from("test"))).toBe(true);
    expect(isEqual(new URL("https://example.com"), new URL("https://example.com"))).toBe(
      true,
    );
  });

  test("should return false for mismatched Buffer contents", () => {
    const bufferA = Buffer.from("test");
    const bufferB = Buffer.from("different");
    expect(isEqual(bufferA, bufferB)).toBe(false);
  });

  test("should return false for mismatched URLs", () => {
    const urlA = new URL("https://example.com");
    const urlB = new URL("https://different.com");
    expect(isEqual(urlA, urlB)).toBe(false);
  });

  test("should compare RegExps by source and flags", () => {
    expect(isEqual(/test/i, /test/i)).toBe(true);
    expect(isEqual(/test/i, /test/g)).toBe(false);
    expect(isEqual(/test/i, /other/i)).toBe(false);
  });

  test("should compare typed arrays by content", () => {
    expect(isEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(isEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(isEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))).toBe(false);
    expect(isEqual(new BigInt64Array([1n]), new BigInt64Array([1n]))).toBe(true);
    expect(isEqual(new BigInt64Array([1n]), new BigInt64Array([2n]))).toBe(false);
  });

  test("should return false for typed arrays of different kinds", () => {
    expect(isEqual(new Uint8Array([1, 2]), new Int8Array([1, 2]))).toBe(false);
  });

  test("should compare array buffers by content", () => {
    const a = new Uint8Array([1, 2, 3]).buffer;
    const b = new Uint8Array([1, 2, 3]).buffer;
    const c = new Uint8Array([1, 2, 4]).buffer;

    expect(isEqual(a, b)).toBe(true);
    expect(isEqual(a, c)).toBe(false);
    expect(isEqual(a, new ArrayBuffer(2))).toBe(false);
  });

  test("should return false for distinct maps and sets with different contents", () => {
    expect(isEqual(new Set([1]), new Set([2]))).toBe(false);
    expect(isEqual(new Map([["a", 1]]), new Map([["a", 2]]))).toBe(false);
  });

  test("should return false when only one side is an exotic object", () => {
    expect(isEqual(new Set([1, 2]), {})).toBe(false);
    expect(isEqual(new Map([["a", 1]]), {})).toBe(false);
    expect(isEqual(/test/i, {})).toBe(false);
    expect(isEqual(new ArrayBuffer(8), {})).toBe(false);
  });

  test("should handle circular arrays", () => {
    const arrayA: Array<any> = [1];
    const arrayB: Array<any> = [1];
    arrayA.push(arrayA);
    arrayB.push(arrayB);

    expect(isEqual(arrayA, arrayB)).toBe(true);
  });

  test("should handle circular sets", () => {
    const setA = new Set<any>([1]);
    const setB = new Set<any>([1]);
    setA.add(setA);
    setB.add(setB);

    expect(isEqual(setA, setB)).toBe(true);
  });

  test("should handle circular maps", () => {
    const mapA = new Map<string, any>([["foo", "bar"]]);
    const mapB = new Map<string, any>([["foo", "bar"]]);
    mapA.set("self", mapA);
    mapB.set("self", mapB);

    expect(isEqual(mapA, mapB)).toBe(true);
  });

  test("should handle circular class instances", () => {
    class Node {
      public self: any = null;
    }

    const nodeA = new Node();
    const nodeB = new Node();
    nodeA.self = nodeA;
    nodeB.self = nodeB;

    expect(isEqual(nodeA, nodeB)).toBe(true);
  });

  test("should compare a repeated reference against equal values", () => {
    const shared = { foo: "bar" };
    const sharedArray = [1, 2];

    expect(isEqual([shared, shared], [{ foo: "bar" }, { foo: "bar" }])).toBe(true);
    expect(
      isEqual({ a: shared, b: shared }, { a: { foo: "bar" }, b: { foo: "bar" } }),
    ).toBe(true);
    expect(
      isEqual(
        [sharedArray, sharedArray],
        [
          [1, 2],
          [1, 2],
        ],
      ),
    ).toBe(true);
  });

  test("should return false for objects with the same key count but different keys", () => {
    expect(isEqual({ foo: undefined }, { bar: undefined })).toBe(false);
    expect(isEqual({ foo: undefined, bar: 1 }, { baz: undefined, bar: 1 })).toBe(false);
    expect(isEqual({ foo: undefined }, { foo: undefined })).toBe(true);
  });

  test("should compare class instances structurally", () => {
    class Point {
      public readonly x: number;
      public readonly y: number;

      public constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
      }
    }

    class Vector {
      public readonly x: number;
      public readonly y: number;

      public constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
      }
    }

    expect(isEqual(new Point(1, 2), new Point(1, 2))).toBe(true);
    expect(isEqual(new Point(1, 2), new Point(1, 3))).toBe(false);
    expect(isEqual(new Point(1, 2), new Vector(1, 2))).toBe(false);
    expect(isEqual(new Point(1, 2), { x: 1, y: 2 })).toBe(false);
    expect(isEqual({ point: new Point(1, 2) }, { point: new Point(1, 2) })).toBe(true);
    expect(isEqual({ point: new Point(1, 2) }, { point: new Point(1, 3) })).toBe(false);
    expect(isEqual([new Point(1, 2)], [new Point(1, 2)])).toBe(true);
  });

  test("should compare class instances holding exotic values", () => {
    class Entity {
      public readonly id: string;
      public readonly createdAt: Date;
      public readonly tags: Set<string>;

      public constructor(id: string, createdAt: Date, tags: Set<string>) {
        this.id = id;
        this.createdAt = createdAt;
        this.tags = tags;
      }
    }

    const args = (): [string, Date, Set<string>] => [
      "id",
      new Date("2024-01-01"),
      new Set(["a"]),
    ];

    expect(isEqual(new Entity(...args()), new Entity(...args()))).toBe(true);
    expect(
      isEqual(
        new Entity(...args()),
        new Entity("id", new Date("2024-01-02"), new Set(["a"])),
      ),
    ).toBe(false);
  });

  test("should not treat opaque built-ins as structurally equal", () => {
    expect(isEqual(Promise.resolve(1), Promise.resolve(2))).toBe(false);
    expect(isEqual(new WeakMap(), new WeakMap())).toBe(false);
    expect(isEqual(new WeakSet(), new WeakSet())).toBe(false);
    expect(isEqual(new Number(1), new Number(2))).toBe(false);
  });

  test("should compare subclassed errors by name and message", () => {
    class CustomError extends Error {
      public readonly code: string;

      public constructor(message: string, code: string) {
        super(message);
        this.name = "CustomError";
        this.code = code;
      }
    }

    expect(isEqual(new CustomError("boom", "a"), new CustomError("boom", "a"))).toBe(
      true,
    );
    expect(isEqual(new CustomError("boom", "a"), new CustomError("bang", "a"))).toBe(
      false,
    );
    expect(isEqual(new Error("boom"), new Error("boom"))).toBe(true);
    expect(isEqual(new Error("boom"), new TypeError("boom"))).toBe(false);
  });

  test("should keep typed array kinds sharing a byte layout distinct", () => {
    expect(isEqual(Buffer.from([1, 2]), new Uint8Array([1, 2]))).toBe(false);
    expect(isEqual(new Uint8Array([1, 2]), Buffer.from([1, 2]))).toBe(false);
    expect(isEqual(new Uint8Array([1, 2]), new Uint8ClampedArray([1, 2]))).toBe(false);
    expect(isEqual(new Float64Array([NaN]), new Float64Array([NaN]))).toBe(true);
  });

  test("should compare map keys deeply", () => {
    expect(isEqual(new Map([[{ foo: 1 }, "a"]]), new Map([[{ foo: 1 }, "a"]]))).toBe(
      true,
    );
    expect(isEqual(new Map([[{ foo: 1 }, "a"]]), new Map([[{ foo: 2 }, "a"]]))).toBe(
      false,
    );
    expect(isEqual(new Map([[{ foo: 1 }, "a"]]), new Map([[{ foo: 1 }, "b"]]))).toBe(
      false,
    );
    expect(
      isEqual(
        new Map<any, any>([
          [{ foo: 1 }, "a"],
          ["bar", "b"],
        ]),
        new Map<any, any>([
          ["bar", "b"],
          [{ foo: 1 }, "a"],
        ]),
      ),
    ).toBe(true);
  });

  test("should not match two set values against the same counterpart", () => {
    expect(
      isEqual(new Set([{ foo: 1 }, { foo: 1 }]), new Set([{ foo: 1 }, { bar: 2 }])),
    ).toBe(false);
    expect(
      isEqual(
        new Map<any, any>([
          [{ foo: 1 }, "a"],
          [{ foo: 1 }, "a"],
        ]),
        new Map<any, any>([
          [{ foo: 1 }, "a"],
          [{ bar: 2 }, "a"],
        ]),
      ),
    ).toBe(false);
  });

  test("should return false rather than throw for a prototype-less typed array", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    Object.setPrototypeOf(bytes, null);

    expect(isEqual(bytes, new Uint8Array([1, 2, 3]))).toBe(false);
    expect(isEqual(new Uint8Array([1, 2, 3]), bytes)).toBe(false);
  });

  test("should return false rather than throw for detached buffers", () => {
    const detachedA = new ArrayBuffer(8);
    const detachedB = new ArrayBuffer(8);
    structuredClone(detachedA, { transfer: [detachedA] });
    structuredClone(detachedB, { transfer: [detachedB] });

    expect(isEqual(detachedA, new ArrayBuffer(8))).toBe(false);
    expect(isEqual(new ArrayBuffer(8), detachedA)).toBe(false);
    // Neither holds any readable byte, so there is nothing to tell them apart.
    expect(isEqual(detachedA, detachedB)).toBe(true);
  });

  test("should return false rather than throw for a detached data view", () => {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    structuredClone(buffer, { transfer: [buffer] });

    expect(isEqual(view, new DataView(new ArrayBuffer(8)))).toBe(false);
    expect(isEqual(new DataView(new ArrayBuffer(8)), view)).toBe(false);
  });

  test("should return false rather than throw for a throwing getter", () => {
    const hostile = {
      get foo(): string {
        throw new Error("hostile getter");
      },
    };

    expect(isEqual(hostile, { foo: "bar" })).toBe(false);
    expect(isEqual({ foo: "bar" }, hostile)).toBe(false);
    expect(isEqual({ nested: hostile }, { nested: { foo: "bar" } })).toBe(false);
  });
});
