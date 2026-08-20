import { configDefaults } from "vitest/config";
import { describe, expect, test } from "vitest";
import { capture } from "../../__fixtures__/test-helpers.js";
import { assertFeaturesCollected } from "./assert-features-collected.js";

const ROOT = "/repo/pkg";

describe("assertFeaturesCollected", () => {
  test("should stay silent when every feature file matches an include pattern", () => {
    expect(() =>
      assertFeaturesCollected({
        features: ["src/**/*.feature"],
        files: [`${ROOT}/src/features/a.feature`, `${ROOT}/src/b.feature`],
        include: ["src/**/*.test.ts", "src/**/*.feature"],
        root: ROOT,
      }),
    ).not.toThrow();
  });

  test("should count a BROADER include glob as collected", () => {
    expect(() =>
      assertFeaturesCollected({
        features: ["src/**/*.feature"],
        files: [`${ROOT}/src/features/a.feature`],
        include: ["src/**/*"],
        root: ROOT,
      }),
    ).not.toThrow();
  });

  test("should read a lane-suffixed include as its cadence-independent family", () => {
    // The integration/weekly lanes narrow include by SUFFIXING the feature
    // globs (vitest.config.base.mjs); a plain feature the lane correctly
    // leaves out is still collectable in its family and must not throw.
    for (const lane of ["integration", "weekly"]) {
      expect(() =>
        assertFeaturesCollected({
          features: ["src/**/*.feature"],
          files: [
            `${ROOT}/src/plain.feature`,
            `${ROOT}/src/docker.integration.feature`,
            `${ROOT}/src/nightly.weekly.feature`,
          ],
          include: [`src/**/*.${lane}.test.ts`, `src/**/*.${lane}.feature`],
          root: ROOT,
        }),
      ).not.toThrow();
    }
  });

  test("should ignore a file outside every features pattern — the coverage guard's orphan", () => {
    expect(() =>
      assertFeaturesCollected({
        features: ["src/**/*.feature"],
        files: [`${ROOT}/stray/orphan.feature`],
        include: ["src/**/*.test.ts"],
        root: ROOT,
      }),
    ).not.toThrow();
  });

  test("should throw feature_not_collected for the include-overwrite accident", () => {
    const error = capture(() =>
      assertFeaturesCollected({
        features: ["src/**/*.feature"],
        files: [`${ROOT}/src/features/a.feature`, `${ROOT}/src/b.feature`],
        include: ["src/**/*.test.ts"],
        root: ROOT,
      }),
    );

    // The message lists only ROOT-RELATIVE paths and patterns, so it is
    // deterministic across machines and snapshot-safe; `data.root` is not.
    expect(error.message).toMatchSnapshot();
    expect(error.code).toBe("feature_not_collected");
    expect(error.title).toBe("Feature File Not Collected");
    expect(error.data).toEqual({
      features: ["src/**/*.feature"],
      include: ["src/**/*.test.ts"],
      root: ROOT,
      uncollected: [
        { pattern: "src/**/*.feature", uri: "src/features/a.feature" },
        { pattern: "src/**/*.feature", uri: "src/b.feature" },
      ],
    });
  });

  test("should name the features pattern the file actually matched", () => {
    const error = capture(() =>
      assertFeaturesCollected({
        features: ["never/*.feature", "src/**/*.feature"],
        files: [`${ROOT}/src/a.feature`],
        include: ["src/**/*.test.ts"],
        root: ROOT,
      }),
    );

    expect(error.data.uncollected).toEqual([
      { pattern: "src/**/*.feature", uri: "src/a.feature" },
    ]);
  });

  test("should throw for an EXPLICITLY empty include — vitest collects nothing, so nothing is collectable", () => {
    // createFilter reads an empty include list as "match everything"; handed
    // through, the guard would fail OPEN on exactly the emptiest config.
    const error = capture(() =>
      assertFeaturesCollected({
        features: ["src/**/*.feature"],
        files: [`${ROOT}/src/a.feature`],
        include: [],
        root: ROOT,
      }),
    );

    expect(error.code).toBe("feature_not_collected");
    expect(error.data.include).toEqual([]);
    expect(error.data.uncollected).toEqual([
      { pattern: "src/**/*.feature", uri: "src/a.feature" },
    ]);
  });

  test("should substitute vitest's default include when none was configured", () => {
    // Absent include = vitest's own default test globs, which can never match
    // a `.feature` path — and the error must name the list vitest uses.
    const error = capture(() =>
      assertFeaturesCollected({
        features: ["src/**/*.feature"],
        files: [`${ROOT}/src/a.feature`],
        root: ROOT,
      }),
    );

    expect(error.code).toBe("feature_not_collected");
    expect(error.data.include).toEqual(configDefaults.include);
  });
});
