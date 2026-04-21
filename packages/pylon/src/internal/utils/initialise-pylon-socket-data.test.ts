import { initialisePylonSocketData } from "./initialise-pylon-socket-data.js";
import { describe, expect, test } from "vitest";

describe("initialisePylonSocketData", () => {
  test("should initialize with all options provided", () => {
    const result = initialisePylonSocketData({
      domain: "test.lindorm.io",
      environment: "development",
      name: "test-service",
      version: "1.2.3",
    });

    expect(result).toMatchSnapshot();
  });

  test("should use defaults for missing options", () => {
    const result = initialisePylonSocketData({});

    expect(result).toMatchSnapshot();
  });

  test("should use defaults for undefined values", () => {
    const result = initialisePylonSocketData({
      domain: undefined,
      environment: undefined,
      name: undefined,
      version: undefined,
    });

    expect(result).toMatchSnapshot();
  });

  test("should use 'unknown' for empty string environment", () => {
    const result = initialisePylonSocketData({ environment: "" as any });

    expect(result.app.environment).toBe("unknown");
  });
});
