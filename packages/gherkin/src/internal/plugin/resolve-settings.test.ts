import { describe, expect, test } from "vitest";
import { resolveSettings } from "./resolve-settings.js";

describe("resolveSettings", () => {
  test("should default both patterns when called with nothing", () => {
    expect(resolveSettings()).toEqual({
      features: ["src/**/*.feature"],
      steps: ["src/**/*.steps.ts"],
    });
  });

  test("should default each key independently", () => {
    expect(resolveSettings({ features: ["features/**/*.feature"] })).toEqual({
      features: ["features/**/*.feature"],
      steps: ["src/**/*.steps.ts"],
    });

    expect(resolveSettings({ steps: ["steps/**/*.steps.ts"] })).toEqual({
      features: ["src/**/*.feature"],
      steps: ["steps/**/*.steps.ts"],
    });
  });

  test("should keep explicit values", () => {
    expect(
      resolveSettings({ features: ["a/*.feature"], steps: ["b/*.steps.ts"] }),
    ).toEqual({ features: ["a/*.feature"], steps: ["b/*.steps.ts"] });
  });
});
