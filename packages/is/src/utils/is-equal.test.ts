import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isEqual } from "./is-equal";

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
});
