import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { resolveExcludedFeatures } from "./resolve-excluded-features.js";
import { walkFeatureFiles } from "./walk-feature-files.js";

const ROOT = "/repo/pkg";

const FILES = [
  `${ROOT}/drafts/draft.feature`,
  `${ROOT}/src/a.feature`,
  `${ROOT}/src/a.wip.feature`,
  `${ROOT}/src/a.wip.integration.feature`,
];

describe("resolveExcludedFeatures", () => {
  test("should exclude nothing for an empty exclude list", () => {
    expect(resolveExcludedFeatures({ exclude: [], files: FILES, root: ROOT })).toEqual({
      files: [],
      unmatchedLiterals: [],
    });
  });

  test("should resolve every pattern to the walked files it matches, in walk order", () => {
    expect(
      resolveExcludedFeatures({
        exclude: ["src/**/*.wip.feature", "drafts/**"],
        files: FILES,
        root: ROOT,
      }).files,
    ).toEqual([`${ROOT}/drafts/draft.feature`, `${ROOT}/src/a.wip.feature`]);
  });

  test("should list a file matched by several patterns once", () => {
    expect(
      resolveExcludedFeatures({
        exclude: ["src/**/*.wip.feature", "src/a.wip.feature"],
        files: FILES,
        root: ROOT,
      }).files,
    ).toEqual([`${ROOT}/src/a.wip.feature`]);
  });

  test("should anchor a relative pattern at the root", () => {
    expect(
      resolveExcludedFeatures({
        exclude: ["src/a.feature"],
        files: [`/elsewhere/src/a.feature`, `${ROOT}/src/a.feature`],
        root: ROOT,
      }).files,
    ).toEqual([`${ROOT}/src/a.feature`]);
  });

  test("should report a literal entry matching no walked file as unmatched", () => {
    expect(
      resolveExcludedFeatures({
        exclude: ["src/a.feature", "src/missing.feature"],
        files: FILES,
        root: ROOT,
      }).unmatchedLiterals,
    ).toEqual(["src/missing.feature"]);
  });

  test("should never report a glob matching nothing", () => {
    expect(
      resolveExcludedFeatures({
        exclude: ["src/**/*.none.feature"],
        files: FILES,
        root: ROOT,
      }).unmatchedLiterals,
    ).toEqual([]);
  });

  describe("under a root carrying a regex character", () => {
    let root: string;
    let files: Array<string>;

    beforeAll(async () => {
      root = await mkdtemp(join(tmpdir(), "gherkin-resolve-exclude-"));

      for (const path of [
        'features/"draft".feature',
        "features/draft.feature",
        'lone/"draft".feature',
        "lone/draft|wip.feature",
      ]) {
        await mkdir(dirname(join(root, path)), { recursive: true });
        await writeFile(join(root, path), "Feature: f\n");
      }

      files = await walkFeatureFiles(root);
    });

    afterAll(async () => {
      await rm(root, { force: true, recursive: true });
    });

    test('should let features/"draft".feature exclude its unquoted namesake, never itself — the quotes are glob quoting', () => {
      expect(
        resolveExcludedFeatures({ exclude: ['features/"draft".feature'], files, root }),
      ).toEqual({ files: [join(root, "features/draft.feature")], unmatchedLiterals: [] });
    });

    test.each(['lone/"draft".feature', "lone/draft|wip.feature"])(
      "should read %s as a glob — matching nothing, not even its own file, is never reported unmatched",
      (entry) => {
        expect(resolveExcludedFeatures({ exclude: [entry], files, root })).toEqual({
          files: [],
          unmatchedLiterals: [],
        });
      },
    );
  });
});
