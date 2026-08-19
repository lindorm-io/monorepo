import { describe, expect, test } from "vitest";
import { capture, errorShape } from "../../__fixtures__/test-helpers.js";
import { GherkinError } from "../../errors/GherkinError.js";
import type { GherkinSettings } from "../../types/gherkin-settings.js";
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

  test("should reject an unknown key, naming it", () => {
    const error = capture(() =>
      resolveSettings({ featurs: ["a/*.feature"] } as GherkinSettings),
    );

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("unknown_setting");
    expect(error.data).toEqual({ key: "featurs", known: ["features", "steps"] });
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should reject tags with the not-yet-shipped message", () => {
    const error = capture(() =>
      resolveSettings({ tags: "@wip and not @slow" } as GherkinSettings),
    );

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("unknown_setting");
    expect(error.message).toContain("tag-based scenario selection is not yet shipped");
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should reject an unknown key even when the known keys are present", () => {
    const error = capture(() =>
      resolveSettings({
        features: ["a/*.feature"],
        steps: ["b/*.steps.ts"],
        tags: "@wip",
      } as GherkinSettings),
    );

    expect(error.code).toEqual("unknown_setting");
  });
});
