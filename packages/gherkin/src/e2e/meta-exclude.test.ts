import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import type { MetaRunResult } from "./__fixtures__/spawn-vitest.js";
import {
  META_FIXTURES_DIRECTORY,
  runMetaFixture,
  runMetaFixtureOutput,
  runVitestChild,
} from "./__fixtures__/spawn-vitest.js";

const SENTINEL_DIRECTORY = join(
  META_FIXTURES_DIRECTORY,
  "exclude",
  "node_modules",
  "exclude-sentinel",
);

/**
 * Child `vitest run`s over one fixture tree wired with the `exclude` setting,
 * asserting the PRINTED counts: an excluded feature file is absent from them,
 * raises no guard, and never reaches the tag scan, while vitest keeps its own
 * excludes and every file the patterns do not resolve to. Coverage is NOT
 * discharged here; every branch stays unit-covered in-process.
 */
describe("meta-suite: exclude", () => {
  describe("a consumer that sets no test.exclude", () => {
    let result: MetaRunResult;

    beforeAll(async () => {
      // Gitignored, so planted per run: the include's `**/*.test.ts` reaches
      // it, and only vitest's default `**/node_modules/**` keeps it out.
      await mkdir(SENTINEL_DIRECTORY, { recursive: true });
      await writeFile(
        join(SENTINEL_DIRECTORY, "sentinel.test.ts"),
        'import { test } from "vitest";\n\ntest("node_modules sentinel", () => {});\n',
      );

      try {
        result = runMetaFixture("exclude");
      } finally {
        await rm(SENTINEL_DIRECTORY, { force: true, recursive: true });
      }
    }, 180_000);

    test("should print exact totals — no excluded feature file in the counts", () => {
      expect(result.summary.tests).toBe("4 passed (4)");
      expect(result.summary.testFiles).toBe("4 passed (4)");
    });

    test("should never collect a feature file an exclude pattern matches", () => {
      expect(result.output).not.toContain("parked.wip.feature");
      expect(result.output).not.toContain("drafts/draft.feature");
      expect(result.output).not.toContain("look-alike[1].feature");
    });

    test("should prune an excluded path carrying glob syntax alone — its look-alike still runs", () => {
      expect(result.output).toContain(
        "✓ features/look-alike1.feature > look-alike > a feature an unescaped exclusion would over-match runs",
      );
    });

    test("should keep vitest's default excludes — a test file under node_modules stays uncollected", () => {
      expect(result.output).not.toContain("sentinel");
    });

    test("should leave a non-feature file under an excluded directory to vitest", () => {
      expect(result.output).toContain(
        "✓ drafts/draft.test.ts > a non-feature test under an excluded directory runs",
      );
    });

    test("should match a pattern as written — a lane-suffixed feature escapes a plain-suffix pattern", () => {
      expect(result.output).toContain(
        "✓ features/kept.wip.integration.feature > lane-suffixed > a lane-suffixed feature escapes the plain-suffix pattern",
      );
      expect(result.output).toContain(
        "✓ features/kept.feature > kept > a feature no exclude pattern matches runs",
      );
    });

    test("should raise no guard and no tag-scan refusal for an excluded file", () => {
      expect(result.output).not.toContain("feature_not_included");
      expect(result.output).not.toContain("feature_not_collected");
      expect(result.output).not.toContain("invalid_tag_name");
    });
  });

  describe("a consumer that sets test.exclude", () => {
    let result: MetaRunResult;

    beforeAll(() => {
      result = runMetaFixture("exclude", [
        "--config",
        "vitest.consumer-exclude.config.ts",
      ]);
    }, 180_000);

    test("should print exact totals — the consumer's entry and the excluded feature files both prune", () => {
      expect(result.summary.tests).toBe("3 passed (3)");
      expect(result.summary.testFiles).toBe("3 passed (3)");
    });

    test("should keep the consumer's own entries", () => {
      expect(result.output).not.toContain("drafts/draft.test.ts");
    });

    test("should add the excluded feature files to them", () => {
      expect(result.output).not.toContain("parked.wip.feature");
      expect(result.output).not.toContain("drafts/draft.feature");
      expect(result.output).not.toContain("look-alike[1].feature");
    });
  });

  describe("a consumer that sets test.dir", () => {
    let result: MetaRunResult;

    beforeAll(() => {
      result = runMetaFixture("exclude", ["--config", "vitest.dir.config.ts"]);
    }, 180_000);

    test("should print exact totals — test.dir globbed, minus the excluded feature files", () => {
      expect(result.summary.tests).toBe("3 passed (3)");
      expect(result.summary.testFiles).toBe("3 passed (3)");
    });

    test("should write each excluded feature file relative to test.dir, where vitest matches test.exclude", () => {
      expect(result.output).not.toContain("parked.wip.feature");
      expect(result.output).not.toContain("look-alike[1].feature");
    });

    test("should keep the escaping relative to test.dir — the look-alike still runs", () => {
      expect(result.output).toContain(
        "look-alike1.feature > look-alike > a feature an unescaped exclusion would over-match runs",
      );
    });

    test("should read test.include relative to test.dir, where vitest globs it — no collection guard", () => {
      expect(result.output).toContain(
        "kept.feature > kept > a feature no exclude pattern matches runs",
      );
      expect(result.output).not.toContain("feature_not_collected");
    });
  });

  describe("a consumer that passes --dir on the command line", () => {
    let result: MetaRunResult;

    beforeAll(() => {
      result = runMetaFixture("exclude", [
        "--config",
        "vitest.cli-dir.config.ts",
        "--dir",
        "features",
      ]);
    }, 180_000);

    test("should print exact totals — the --dir tree globbed, minus the excluded feature files", () => {
      expect(result.summary.tests).toBe("3 passed (3)");
      expect(result.summary.testFiles).toBe("3 passed (3)");
    });

    test("should write each excluded feature file relative to the --dir directory", () => {
      expect(result.output).not.toContain("parked.wip.feature");
      expect(result.output).not.toContain("look-alike[1].feature");
      expect(result.output).toContain(
        "look-alike1.feature > look-alike > a feature an unescaped exclusion would over-match runs",
      );
    });

    test("should read test.include relative to the --dir directory — no collection guard", () => {
      expect(result.output).toContain(
        "kept.feature > kept > a feature no exclude pattern matches runs",
      );
      expect(result.output).not.toContain("feature_not_collected");
    });
  });

  describe("a relative test.dir under a root other than the working directory", () => {
    let result: MetaRunResult;

    beforeAll(() => {
      result = runVitestChild(META_FIXTURES_DIRECTORY, [
        "--config",
        "exclude/vitest.dir-from-parent.config.ts",
      ]);
    }, 180_000);

    test("should resolve test.dir against the working directory, as vitest does — the excluded feature files stay out", () => {
      expect(result.summary.tests).toBe("3 passed (3)");
      expect(result.summary.testFiles).toBe("3 passed (3)");
      expect(result.output).not.toContain("parked.wip.feature");
      expect(result.output).not.toContain("look-alike[1].feature");
    });
  });

  describe("a test.root other than the working directory", () => {
    let result: MetaRunResult;

    beforeAll(() => {
      result = runVitestChild(META_FIXTURES_DIRECTORY, [
        "--config",
        "exclude/vitest.test-root.config.ts",
      ]);
    }, 180_000);

    test("should print exact totals — test.root walked and globbed, minus the excluded feature files", () => {
      expect(result.summary.tests).toBe("4 passed (4)");
      expect(result.summary.testFiles).toBe("4 passed (4)");
    });

    test("should resolve the exclude patterns under test.root, as vitest roots its run there", () => {
      expect(result.output).not.toContain("parked.wip.feature");
      expect(result.output).not.toContain("drafts/draft.feature");
      expect(result.output).not.toContain("look-alike[1].feature");
      expect(result.output).toContain(
        "✓ drafts/draft.test.ts > a non-feature test under an excluded directory runs",
      );
    });

    test("should raise no guard and no tag-scan refusal", () => {
      expect(result.output).not.toContain("feature_not_included");
      expect(result.output).not.toContain("feature_not_collected");
      expect(result.output).not.toContain("invalid_tag_name");
    });
  });

  describe("a literal exclude path naming no feature file", () => {
    let output = "";

    beforeAll(() => {
      output = runMetaFixtureOutput("exclude", [
        "--config",
        "vitest.unmatched.config.ts",
      ]);
    }, 180_000);

    test("should die loudly with exclude_unmatched, naming the literal path and no glob", () => {
      expect(output).toContain("code: 'exclude_unmatched'");
      expect(output).toContain("features/missing.feature");
      expect(output).not.toContain("*.none.feature");
    });

    test("should never reach the reporter", () => {
      expect(output).not.toContain("Test Files");
      expect(output).not.toContain("passed");
    });
  });
});
