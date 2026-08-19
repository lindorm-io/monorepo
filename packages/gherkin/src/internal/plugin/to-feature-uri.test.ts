import { describe, expect, test } from "vitest";
import { toFeatureUri } from "./to-feature-uri.js";

describe("toFeatureUri", () => {
  test("should return the root-relative path", () => {
    expect(toFeatureUri("/repo/pkg", "/repo/pkg/src/features/a.feature")).toBe(
      "src/features/a.feature",
    );
  });

  test("should be deterministic for identical input", () => {
    const first = toFeatureUri("/repo/pkg", "/repo/pkg/src/a.feature");
    const second = toFeatureUri("/repo/pkg", "/repo/pkg/src/a.feature");

    expect(first).toBe(second);
  });

  test("should step outside the root rather than invent a path", () => {
    expect(toFeatureUri("/repo/pkg", "/repo/other/a.feature")).toBe("../other/a.feature");
  });
});
