import { describe, expect, test } from "vitest";
import { capture } from "../../__fixtures__/test-helpers.js";
import { assertFeaturesCovered } from "./assert-features-covered.js";

const ROOT = "/repo/pkg";

describe("assertFeaturesCovered", () => {
  test("should stay silent when every feature file matches a pattern", () => {
    expect(() =>
      assertFeaturesCovered({
        features: ["src/**/*.feature"],
        files: [
          `${ROOT}/src/features/a.feature`,
          `${ROOT}/src/features/b.integration.feature`,
        ],
        root: ROOT,
      }),
    ).not.toThrow();
  });

  test("should stay silent when a file matches only the second of several patterns", () => {
    expect(() =>
      assertFeaturesCovered({
        features: ["never/*.feature", "src/features/*.feature"],
        files: [`${ROOT}/src/features/a.feature`],
        root: ROOT,
      }),
    ).not.toThrow();
  });

  test("should throw feature_not_included for an uncovered feature file", () => {
    const error = capture(() =>
      assertFeaturesCovered({
        features: ["src/**/*.feature"],
        files: [`${ROOT}/src/features/a.feature`, `${ROOT}/stray/orphan.feature`],
        root: ROOT,
      }),
    );

    // The message lists only ROOT-RELATIVE paths, so it is deterministic
    // across machines and snapshot-safe; `data.root` is not.
    expect(error.message).toMatchSnapshot();
    expect(error.code).toBe("feature_not_included");
    expect(error.data.orphans).toEqual(["stray/orphan.feature"]);
    expect(error.data.features).toEqual(["src/**/*.feature"]);
    expect(error.data.root).toBe(ROOT);
  });

  test("should name every uncovered file, sorted", () => {
    // `files` arrives sorted from the buildStart walk (walk-feature-files.ts);
    // the orphans list preserves that order.
    const error = capture(() =>
      assertFeaturesCovered({
        features: ["src/**/*.feature"],
        files: [`${ROOT}/second.feature`, `${ROOT}/stray/orphan.feature`],
        root: ROOT,
      }),
    );

    expect(error.data.orphans).toEqual(["second.feature", "stray/orphan.feature"]);
  });
});
