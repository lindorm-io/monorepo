import { describe, expect, test } from "vitest";
import { toRootUri } from "./to-root-uri.js";

describe("toRootUri", () => {
  test("should return the root-relative path", () => {
    expect(toRootUri("/repo/pkg", "/repo/pkg/src/features/a.feature")).toBe(
      "src/features/a.feature",
    );
  });

  test("should be deterministic for identical input", () => {
    const first = toRootUri("/repo/pkg", "/repo/pkg/src/a.feature");
    const second = toRootUri("/repo/pkg", "/repo/pkg/src/a.feature");

    expect(first).toBe(second);
  });

  test("should step outside the root rather than invent a path", () => {
    expect(toRootUri("/repo/pkg", "/repo/other/a.feature")).toBe("../other/a.feature");
  });
});
