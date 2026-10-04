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
        matchDirectory: ROOT,
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
        matchDirectory: ROOT,
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
          matchDirectory: ROOT,
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
        matchDirectory: ROOT,
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
        matchDirectory: ROOT,
        root: ROOT,
      }),
    );

    // The message lists only ROOT-RELATIVE paths and patterns, so it is
    // deterministic across machines and snapshot-safe; `data.root` is not.
    expect(error.message).toMatchSnapshot();
    expect(error.code).toBe("feature_not_collected");
    expect(error.data).toEqual({
      features: ["src/**/*.feature"],
      include: ["src/**/*.test.ts"],
      matchDirectory: ".",
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
        matchDirectory: ROOT,
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
        matchDirectory: ROOT,
        root: ROOT,
      }),
    );

    expect(error.code).toBe("feature_not_collected");
    expect(error.data.include).toEqual([]);
    expect(error.data.uncollected).toEqual([
      { pattern: "src/**/*.feature", uri: "src/a.feature" },
    ]);
  });

  test("should read test.include relative to vitest's match directory, never the root", () => {
    expect(() =>
      assertFeaturesCollected({
        features: ["features/**/*.feature"],
        files: [`${ROOT}/features/a.feature`],
        include: ["*.feature"],
        matchDirectory: `${ROOT}/features`,
        root: ROOT,
      }),
    ).not.toThrow();
  });

  test("should throw feature_not_collected for a covered feature outside the match directory — vitest never globs it", () => {
    const error = capture(() =>
      assertFeaturesCollected({
        features: ["**/*.feature"],
        files: [`${ROOT}/features/a.feature`, `${ROOT}/src/b.feature`],
        include: ["**/*.feature"],
        matchDirectory: `${ROOT}/features`,
        root: ROOT,
      }),
    );

    expect(error.code).toBe("feature_not_collected");
    expect(error.data.uncollected).toEqual([
      { pattern: "**/*.feature", uri: "src/b.feature" },
    ]);
  });

  test("should name vitest's match directory, root-relative, and the outside-the-directory cause", () => {
    const error = capture(() =>
      assertFeaturesCollected({
        features: ["**/*.feature"],
        files: [`${ROOT}/src/b.feature`],
        include: ["**/*.feature"],
        matchDirectory: `${ROOT}/features`,
        root: ROOT,
      }),
    );

    expect(error.data).toEqual({
      features: ["**/*.feature"],
      include: ["**/*.feature"],
      matchDirectory: "features",
      root: ROOT,
      uncollected: [{ pattern: "**/*.feature", uri: "src/b.feature" }],
    });
    expect(error.message).toMatchSnapshot();
    expect(error.details).toMatchSnapshot();
  });

  test("should anchor `features` patterns at the root — only test.include is read from the match directory", () => {
    const error = capture(() =>
      assertFeaturesCollected({
        features: ["src/**/*.feature"],
        files: [`${ROOT}/src/b.feature`],
        include: ["*.feature"],
        matchDirectory: `${ROOT}/features`,
        root: ROOT,
      }),
    );

    expect(error.code).toBe("feature_not_collected");
    expect(error.data.uncollected).toEqual([
      { pattern: "src/**/*.feature", uri: "src/b.feature" },
    ]);
  });

  test("should substitute vitest's default include when none was configured", () => {
    // Absent include = vitest's own default test globs, which can never match
    // a `.feature` path — and the error must name the list vitest uses.
    const error = capture(() =>
      assertFeaturesCollected({
        features: ["src/**/*.feature"],
        files: [`${ROOT}/src/a.feature`],
        matchDirectory: ROOT,
        root: ROOT,
      }),
    );

    expect(error.code).toBe("feature_not_collected");
    expect(error.data.include).toEqual(configDefaults.include);
  });
});
