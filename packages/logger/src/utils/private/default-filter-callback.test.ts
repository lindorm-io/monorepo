import { defaultFilterCallback } from "./default-filter-callback";

describe("defaultFilterCallback", () => {
  test("should return [Filtered] for truthy values", () => {
    expect(defaultFilterCallback("secret")).toBe("[Filtered]");
    expect(defaultFilterCallback(123)).toBe("[Filtered]");
    expect(defaultFilterCallback(true)).toBe("[Filtered]");
    expect(defaultFilterCallback({ key: "value" })).toBe("[Filtered]");
  });

  test("should return falsy values unchanged", () => {
    expect(defaultFilterCallback(null)).toBe(null);
    expect(defaultFilterCallback(undefined)).toBe(undefined);
    expect(defaultFilterCallback("")).toBe("");
    expect(defaultFilterCallback(0)).toBe(0);
  });
});
