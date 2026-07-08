import { describe, expect, test, vi } from "vitest";
import { createMockConduit } from "./vitest.js";

describe("createMockConduit", () => {
  test("should create mock with all interface methods", () => {
    const mock = createMockConduit();

    expect(vi.isMockFunction(mock.delete)).toBe(true);
    expect(vi.isMockFunction(mock.get)).toBe(true);
    expect(vi.isMockFunction(mock.head)).toBe(true);
    expect(vi.isMockFunction(mock.options)).toBe(true);
    expect(vi.isMockFunction(mock.patch)).toBe(true);
    expect(vi.isMockFunction(mock.post)).toBe(true);
    expect(vi.isMockFunction(mock.put)).toBe(true);
    expect(vi.isMockFunction(mock.request)).toBe(true);
  });

  test("should resolve the default response shape", async () => {
    const mock = createMockConduit();

    await expect(mock.get("https://test.lindorm.io/")).resolves.toEqual({
      cached: null,
      data: {},
      status: 200,
      statusText: "OK",
      headers: {},
    });
    await expect(mock.post("https://test.lindorm.io/")).resolves.toEqual({
      cached: null,
      data: {},
      status: 200,
      statusText: "OK",
      headers: {},
    });
  });
});
