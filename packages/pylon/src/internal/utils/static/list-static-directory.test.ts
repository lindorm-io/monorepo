import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { listStaticDirectory } from "./list-static-directory.js";
import { afterAll, describe, expect, test } from "vitest";

const assets = join(__dirname, "..", "..", "..", "__fixtures__", "static-assets");

describe("listStaticDirectory", () => {
  test("lists entries sorted by name with type and size, excluding dotfiles", async () => {
    const entries = await listStaticDirectory(assets);

    // Strip the volatile mtime; assert the stable shape.
    const stable = entries.map(({ name, type, size }) => ({ name, type, size }));

    expect(stable).toMatchSnapshot();
    expect(entries.map((e) => e.name)).not.toContain(".hidden.txt");
    // Already sorted ascending by name.
    expect(entries.map((e) => e.name)).toEqual([...entries.map((e) => e.name)].sort());
  });

  test("carries a Date lastModified per entry", async () => {
    const entries = await listStaticDirectory(assets);

    expect(entries.every((e) => e.lastModified instanceof Date)).toBe(true);
  });

  test("lists a nested subdirectory", async () => {
    const entries = await listStaticDirectory(join(assets, "nested"));

    expect(entries.map(({ name, type }) => ({ name, type }))).toEqual([
      { name: "deep.txt", type: "file" },
    ]);
  });

  describe("empty directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "static-list-"));
    afterAll(() => rmSync(dir, { recursive: true, force: true }));

    test("returns an empty array", async () => {
      expect(await listStaticDirectory(dir)).toEqual([]);
    });
  });
});
