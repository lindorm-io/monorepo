import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { byEntryName, walkFeatureFiles } from "./walk-feature-files.js";

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
});
