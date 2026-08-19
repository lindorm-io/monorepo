import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  META_FIXTURES_DIRECTORY,
  readSummary,
  resolveVitestBin,
  runMetaFixture,
  stripAnsi,
  toVitestBinPath,
} from "./spawn-vitest.js";

describe("spawnVitest", () => {
  describe("META_FIXTURES_DIRECTORY", () => {
    test("should resolve to the package's meta-fixtures directory", () => {
      expect(basename(META_FIXTURES_DIRECTORY)).toBe("meta-fixtures");
    });
  });

  describe("stripAnsi", () => {
    test("should strip color codes and leave plain text alone", () => {
      expect(stripAnsi("\u001b[31mred\u001b[0m plain")).toBe("red plain");
    });
  });

  describe("toVitestBinPath", () => {
    let directory: string;

    beforeAll(async () => {
      directory = await mkdtemp(join(tmpdir(), "gherkin-spawn-vitest-"));
    });

    afterAll(async () => {
      await rm(directory, { recursive: true, force: true });
    });

    test("should resolve the workspace vitest bin script", () => {
      expect(resolveVitestBin()).toMatch(/node_modules\/vitest\/vitest\.mjs$/);
    });

    test("should throw when the manifest declares no bin at all", async () => {
      const manifest = join(directory, "no-bin.json");
      await writeFile(manifest, JSON.stringify({ name: "no-bin" }));

      expect(() => toVitestBinPath(manifest)).toThrow("declares no bin.vitest");
    });

    test("should throw when the bin map lacks a vitest entry", async () => {
      const manifest = join(directory, "other-bin.json");
      await writeFile(manifest, JSON.stringify({ bin: { other: "./other.mjs" } }));

      expect(() => toVitestBinPath(manifest)).toThrow("declares no bin.vitest");
    });
  });

  describe("readSummary", () => {
    test("should extract both summary lines", () => {
      const output = [
        " Test Files  9 failed | 1 passed | 2 skipped (12)",
        "      Tests  11 failed | 4 passed (15)",
      ].join("\n");

      expect(readSummary(output)).toEqual({
        testFiles: "9 failed | 1 passed | 2 skipped (12)",
        tests: "11 failed | 4 passed (15)",
      });
    });

    test("should throw when the Tests line is missing", () => {
      expect(() => readSummary(" Test Files  1 passed (1)")).toThrow(
        "child output carries no summary lines",
      );
    });

    test("should throw when both summary lines are missing", () => {
      expect(() => readSummary("no summary here")).toThrow(
        "child output carries no summary lines",
      );
    });
  });

  describe("runMetaFixture", () => {
    test("should throw when the fixture directory does not exist", () => {
      expect(() => runMetaFixture("does-not-exist")).toThrow();
    });
  });
});
