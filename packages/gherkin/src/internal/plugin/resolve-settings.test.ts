import { describe, expect, test } from "vitest";
import { capture, errorShape } from "../../__fixtures__/test-helpers.js";
import { GherkinError } from "../../errors/GherkinError.js";
import type { GherkinSettings } from "../../types/gherkin-settings.js";
import { resolveSettings } from "./resolve-settings.js";

describe("resolveSettings", () => {
  test("should default both patterns when called with nothing", () => {
    expect(resolveSettings()).toMatchObject({
      features: ["src/**/*.feature"],
      steps: ["src/**/*.steps.ts"],
    });
  });

  test("should default each key independently", () => {
    expect(resolveSettings({ features: ["features/**/*.feature"] })).toMatchObject({
      features: ["features/**/*.feature"],
      steps: ["src/**/*.steps.ts"],
    });

    expect(resolveSettings({ steps: ["steps/**/*.steps.ts"] })).toMatchObject({
      features: ["src/**/*.feature"],
      steps: ["steps/**/*.steps.ts"],
    });
  });

  test("should keep explicit values", () => {
    expect(
      resolveSettings({ features: ["a/*.feature"], steps: ["b/*.steps.ts"] }),
    ).toMatchObject({ features: ["a/*.feature"], steps: ["b/*.steps.ts"] });
  });

  test("should reject an unknown key, naming it", () => {
    const error = capture(() =>
      resolveSettings({ featurs: ["a/*.feature"] } as GherkinSettings),
    );

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("unknown_setting");
    expect(error.data).toEqual({ key: "featurs", known: ["features", "steps", "tags"] });
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should reject an unknown key even when the known keys are present", () => {
    expect(
      capture(() =>
        resolveSettings({
          features: ["a/*.feature"],
          steps: ["b/*.steps.ts"],
          tags: "@wip",
          extra: true,
        } as GherkinSettings),
      ).code,
    ).toEqual("unknown_setting");
  });

  describe("tagFilter", () => {
    test("should retain every pickle without a tags setting", () => {
      const { tagFilter } = resolveSettings();

      expect(tagFilter([])).toBe(true);
      expect(tagFilter(["@anything"])).toBe(true);
    });

    test("should compile a Cucumber tag expression evaluating @-prefixed tag sets", () => {
      const { tagFilter } = resolveSettings({ tags: "@smoke and not @slow" });

      expect(tagFilter(["@smoke"])).toBe(true);
      expect(tagFilter(["@smoke", "@slow"])).toBe(false);
      expect(tagFilter([])).toBe(false);
    });

    test("should evaluate against the @-prefixed spelling — a stripped tag never matches", () => {
      const { tagFilter } = resolveSettings({ tags: "@smoke" });

      // The model's one spelling keeps the @; stripping happens only at the
      // vitest boundary (to-vitest-tags.ts).
      expect(tagFilter(["smoke"])).toBe(false);
    });

    test("should throw invalid_tag_expression at construction for a malformed expression", () => {
      const error = capture(() => resolveSettings({ tags: "@smoke and" }));

      expect(error).toEqual(expect.any(GherkinError));
      expect(error.code).toEqual("invalid_tag_expression");
      expect(error.message).toContain('"@smoke and"');
      expect(error.data).toEqual({ tags: "@smoke and" });
      expect(errorShape(error)).toMatchSnapshot();
    });
  });
});
