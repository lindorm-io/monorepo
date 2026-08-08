import { describe, expect, test } from "vitest";
import { copySnapshotValue } from "./copy-snapshot-value.js";

class Address {
  street!: string;
  city!: string;
}

describe("copySnapshotValue", () => {
  test.each([
    ["a string", "value"],
    ["a number", 42],
    ["a boolean", true],
    ["a bigint", 10n],
    ["null", null],
    ["undefined", undefined],
  ])("should return %s as-is", (_name, value) => {
    expect(copySnapshotValue(value)).toBe(value);
  });

  test("should detach a Date so setting it in place cannot reach the copy", () => {
    const value = new Date("2020-01-01T00:00:00.000Z");
    const copy = copySnapshotValue(value) as Date;

    value.setUTCFullYear(2031);

    expect(copy).not.toBe(value);
    expect(copy.toISOString()).toBe("2020-01-01T00:00:00.000Z");
  });

  test("should keep an invalid Date a Date rather than an empty object", () => {
    const copy = copySnapshotValue(new Date("nonsense"));

    expect(copy).toBeInstanceOf(Date);
    expect(Number.isNaN((copy as Date).getTime())).toBe(true);
  });

  test("should detach a Buffer so writing into it cannot reach the copy", () => {
    const value = Buffer.from("old");
    const copy = copySnapshotValue(value) as Buffer;

    value.write("new");

    expect(copy).not.toBe(value);
    expect(copy.toString()).toBe("old");
    expect(Buffer.isBuffer(copy)).toBe(true);
  });

  test("should detach an array so pushing into it cannot reach the copy", () => {
    const value = ["a"];
    const copy = copySnapshotValue(value) as Array<string>;

    value.push("b");

    expect(copy).toEqual(["a"]);
  });

  test("should detach an object so assigning to it cannot reach the copy", () => {
    const value = { tier: "old" };
    const copy = copySnapshotValue(value) as typeof value;

    value.tier = "new";

    expect(copy).toEqual({ tier: "old" });
  });

  test("should copy deeply, not shallowly", () => {
    const value = { outer: { inner: { items: ["a"], at: new Date(0) } } };
    const copy = copySnapshotValue(value) as typeof value;

    value.outer.inner.items.push("b");
    value.outer.inner.at.setUTCFullYear(2031);

    expect(copy.outer.inner.items).toEqual(["a"]);
    expect(copy.outer.inner.at.toISOString()).toBe("1970-01-01T00:00:00.000Z");
  });

  test("should preserve the prototype of a class instance", () => {
    const value = new Address();
    value.street = "Old St";
    value.city = "Oslo";

    const copy = copySnapshotValue(value) as Address;

    value.street = "New St";

    expect(copy).toBeInstanceOf(Address);
    expect(copy.street).toBe("Old St");
    expect(copy.city).toBe("Oslo");
  });

  test("should preserve a null prototype", () => {
    const value = Object.create(null) as Record<string, string>;
    value.key = "value";

    const copy = copySnapshotValue(value) as Record<string, string>;

    expect(Object.getPrototypeOf(copy)).toBeNull();
    expect(copy.key).toBe("value");
  });

  test("should copy a shared reference once, keeping it shared", () => {
    const shared = { count: 1 };
    const copy = copySnapshotValue({ a: shared, b: shared }) as {
      a: object;
      b: object;
    };

    expect(copy.a).toBe(copy.b);
    expect(copy.a).not.toBe(shared);
  });

  test("should terminate on a cyclic value and keep the cycle", () => {
    const value: Record<string, unknown> = { name: "root" };
    value.self = value;

    const copy = copySnapshotValue(value) as Record<string, unknown>;

    expect(copy).not.toBe(value);
    expect(copy.self).toBe(copy);
    expect(copy.name).toBe("root");
  });

  test("should preserve a null and an undefined member", () => {
    expect(copySnapshotValue({ a: null, b: undefined })).toEqual({
      a: null,
      b: undefined,
    });
  });
});
