import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { captureAsync } from "../../__fixtures__/test-helpers.js";
import { assertFeaturesCovered } from "./assert-features-covered.js";

describe("assertFeaturesCovered", () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "gherkin-covered-"));

    await mkdir(join(root, "src", "features"), { recursive: true });
    await mkdir(join(root, "stray"), { recursive: true });
    await writeFile(join(root, "src", "features", "a.feature"), "Feature: a\n");
    await writeFile(
      join(root, "src", "features", "b.integration.feature"),
      "Feature: b\n",
    );
  });

  afterAll(async () => {
    await rm(root, { force: true, recursive: true });
  });

  test("should stay silent when every feature file matches a pattern", async () => {
    await expect(
      assertFeaturesCovered({ features: ["src/**/*.feature"], root }),
    ).resolves.toBeUndefined();
  });

  test("should stay silent when a file matches only the second of several patterns", async () => {
    await expect(
      assertFeaturesCovered({
        features: ["never/*.feature", "src/features/*.feature"],
        root,
      }),
    ).resolves.toBeUndefined();
  });

  test("should throw feature_not_included for an uncovered feature file", async () => {
    await writeFile(join(root, "stray", "orphan.feature"), "Feature: orphan\n");

    try {
      const error = await captureAsync(() =>
        assertFeaturesCovered({ features: ["src/**/*.feature"], root }),
      );

      // The message lists only ROOT-RELATIVE paths, so it is deterministic
      // across machines and snapshot-safe; `data.root` is not.
      expect(error.message).toMatchSnapshot();
      expect(error.code).toBe("feature_not_included");
      expect(error.title).toBe("Feature File Not Included");
      expect(error.data.orphans).toEqual(["stray/orphan.feature"]);
      expect(error.data.features).toEqual(["src/**/*.feature"]);
      expect(error.data.root).toBe(root);
    } finally {
      await rm(join(root, "stray", "orphan.feature"), { force: true });
    }
  });

  test("should name every uncovered file, sorted", async () => {
    await writeFile(join(root, "second.feature"), "Feature: second\n");
    await writeFile(join(root, "stray", "orphan.feature"), "Feature: orphan\n");

    try {
      const error = await captureAsync(() =>
        assertFeaturesCovered({ features: ["src/**/*.feature"], root }),
      );

      expect(error.data.orphans).toEqual(["second.feature", "stray/orphan.feature"]);
    } finally {
      await rm(join(root, "second.feature"), { force: true });
      await rm(join(root, "stray", "orphan.feature"), { force: true });
    }
  });
});
