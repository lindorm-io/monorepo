import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { byEntryName, walkFeatureFiles } from "./walk-feature-files.js";

const writeFeatures = async (root: string, files: Array<string>): Promise<void> => {
  for (const file of files) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), "Feature: f\n");
  }
};

describe("walkFeatureFiles", () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "gherkin-walk-"));

    await mkdir(join(root, "src", "nested", "deep"), { recursive: true });
    await mkdir(join(root, "node_modules", "pkg"), { recursive: true });
    await mkdir(join(root, "dist"), { recursive: true });
    await mkdir(join(root, "empty"), { recursive: true });
    await mkdir(join(root, ".git"), { recursive: true });
    // A DIRECTORY whose name ends in .feature is walked into, never listed.
    await mkdir(join(root, "dir.feature"), { recursive: true });

    await writeFile(join(root, "top.feature"), "Feature: top\n");
    await writeFile(join(root, "src", "a.feature"), "Feature: a\n");
    await writeFile(join(root, "src", "nested", "deep", "b.feature"), "Feature: b\n");
    await writeFile(join(root, "src", "notes.txt"), "not a feature\n");
    await writeFile(join(root, "node_modules", "pkg", "x.feature"), "Feature: x\n");
    await writeFile(join(root, "dist", "x.feature"), "Feature: x\n");
    await writeFile(join(root, ".git", "x.feature"), "Feature: x\n");
    await writeFile(join(root, "dir.feature", "c.feature"), "Feature: c\n");
  });

  afterAll(async () => {
    await rm(root, { force: true, recursive: true });
  });

  test("should find nested feature files, skip node_modules/dist/.git, and sort deterministically", async () => {
    const found = await walkFeatureFiles(root);

    expect(found).toEqual([
      join(root, "dir.feature", "c.feature"),
      join(root, "src", "a.feature"),
      join(root, "src", "nested", "deep", "b.feature"),
      join(root, "top.feature"),
    ]);
  });

  test("should return nothing for a directory with no feature files", async () => {
    expect(await walkFeatureFiles(join(root, "empty"))).toEqual([]);
  });

  test("should walk a skipped-name directory when it is the walk ROOT — the skip list applies to children only", async () => {
    expect(await walkFeatureFiles(join(root, "dist"))).toEqual([
      join(root, "dist", "x.feature"),
    ]);
  });

  test("should order entries by code unit in both directions", () => {
    // Directly, because readdir often arrives pre-sorted and would leave one
    // comparator branch unexercised.
    expect(byEntryName({ name: "a" }, { name: "b" })).toBe(-1);
    expect(byEntryName({ name: "b" }, { name: "a" })).toBe(1);
    expect([{ name: "Z" }, { name: "a" }, { name: ".g" }].sort(byEntryName)).toEqual([
      { name: ".g" },
      { name: "Z" },
      { name: "a" },
    ]);
  });

  describe("in a fresh tree", () => {
    let tree: string;

    beforeEach(async () => {
      tree = await mkdtemp(join(tmpdir(), "gherkin-walk-tree-"));
    });

    afterEach(async () => {
      await rm(tree, { force: true, recursive: true });
    });

    test.each([
      ".git",
      ".nx",
      ".tmp",
      ".turbo",
      ".vitest",
      ".cache",
      "node_modules",
      "dist",
      "coverage",
    ])(
      "should return no feature file under a %s directory, at the top or nested",
      async (name) => {
        await writeFeatures(tree, [
          `${name}/a.feature`,
          `src/${name}/b.feature`,
          "src/kept.feature",
        ]);

        expect(await walkFeatureFiles(tree)).toEqual([join(tree, "src", "kept.feature")]);
      },
    );

    test("should return a dot-named feature file — the dot rule skips directories only", async () => {
      await writeFeatures(tree, [".draft.feature", "src/.draft.feature"]);

      expect(await walkFeatureFiles(tree)).toEqual([
        join(tree, ".draft.feature"),
        join(tree, "src", ".draft.feature"),
      ]);
    });

    test("should list a directory's files before a sibling file extending its name, which a flat path sort reverses", async () => {
      await writeFeatures(tree, ["token.feature", "token/a.feature"]);

      expect(await walkFeatureFiles(tree)).toEqual([
        join(tree, "token", "a.feature"),
        join(tree, "token.feature"),
      ]);
    });

    test("should order U+1F600 before U+FF21 by UTF-16 code unit, which readdir's UTF-8 byte order reverses", async () => {
      await writeFeatures(tree, ["\uFF21.feature", "\u{1F600}.feature"]);

      expect(await walkFeatureFiles(tree)).toEqual([
        join(tree, "\u{1F600}.feature"),
        join(tree, "\uFF21.feature"),
      ]);
    });
  });
});
