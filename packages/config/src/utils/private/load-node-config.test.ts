import { loadNodeConfig } from "./load-node-config";

describe("loadNodeConfig", () => {
  test("should return empty object when NODE_CONFIG is not set", () => {
    expect(loadNodeConfig({})).toEqual({});
  });

  test("should return parsed object when NODE_CONFIG is set", () => {
    const config = { key: "value" };
    const env = { NODE_CONFIG: JSON.stringify(config) };
    expect(loadNodeConfig(env)).toEqual(config);
  });

  test("should throw error when NODE_CONFIG is not a string", () => {
    const env = { NODE_CONFIG: 12345 as unknown as string };
    expect(() => loadNodeConfig(env)).toThrow();
  });

  test("should throw error when NODE_CONFIG is not a valid JSON string", () => {
    const env = { NODE_CONFIG: "invalid json" };
    expect(() => loadNodeConfig(env)).toThrow();
  });
});
