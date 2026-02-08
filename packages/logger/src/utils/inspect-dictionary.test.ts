import { inspectDictionary } from "./inspect-dictionary";

describe("inspectDictionary", () => {
  test("should inspect a simple dictionary", () => {
    const result = inspectDictionary({ a: 1, b: "two" }, false);
    expect(result).toContain("a: 1");
    expect(result).toContain("b: 'two'");
  });

  test("should inspect nested objects", () => {
    const result = inspectDictionary({ outer: { inner: "value" } }, false);
    expect(result).toContain("inner: 'value'");
  });

  test("should handle circular references", () => {
    const obj: any = { a: 1 };
    obj.self = obj;
    const result = inspectDictionary(obj, false);
    expect(result).toContain("[Circular");
  });

  test("should sort keys", () => {
    const result = inspectDictionary({ z: 3, a: 1, m: 2 }, false);
    const aIndex = result.indexOf("a:");
    const mIndex = result.indexOf("m:");
    const zIndex = result.indexOf("z:");
    expect(aIndex).toBeLessThan(mIndex);
    expect(mIndex).toBeLessThan(zIndex);
  });

  test("should respect depth parameter", () => {
    const result = inspectDictionary({ a: { b: { c: "deep" } } }, false, 1);
    expect(result).toContain("[Object]");
  });

  test("should handle empty dictionary", () => {
    const result = inspectDictionary({}, false);
    expect(result).toBe("{}");
  });
});
