import { describe, expect, test } from "vitest";
import type { AppConfig } from "../../types/index.js";
import { initialisePylonSocketData } from "./initialise-pylon-socket-data.js";

const CONFIG: AppConfig = Object.freeze({
  audit: false,
  responseCache: false,
  rateLimit: false,
  auth: null,
});

describe("initialisePylonSocketData", () => {
  test("should initialize with all options provided", () => {
    const result = initialisePylonSocketData({
      config: CONFIG,
      domain: "test.lindorm.io",
      environment: "development",
      name: "test-service",
      version: "1.2.3",
    });

    expect(result).toMatchSnapshot();
  });

  test("should use defaults for missing options", () => {
    const result = initialisePylonSocketData({ config: CONFIG });

    expect(result).toMatchSnapshot();
  });

  test("should use defaults for undefined values", () => {
    const result = initialisePylonSocketData({
      config: CONFIG,
      domain: undefined,
      environment: undefined,
      name: undefined,
      version: undefined,
    });

    expect(result).toMatchSnapshot();
  });

  test("should use 'unknown' for empty string environment", () => {
    const result = initialisePylonSocketData({
      config: CONFIG,
      environment: "" as any,
    });

    expect(result.app.environment).toBe("unknown");
  });

  // ⚠ The policy is handed in, never rebuilt: two connections must see the SAME
  // frozen object, or a deployment could have its policy change under it
  // mid-process.
  test("should stamp the same config reference onto every socket", () => {
    const first = initialisePylonSocketData({ config: CONFIG });
    const second = initialisePylonSocketData({ config: CONFIG });

    expect(first.app.config).toBe(CONFIG);
    expect(second.app.config).toBe(CONFIG);
  });
});
