import { beforeAll, describe, expect, test } from "vitest";
import type { MetaRunResult } from "./__fixtures__/spawn-vitest.js";
import { runMetaFixture } from "./__fixtures__/spawn-vitest.js";

/**
 * §0 meta-suite for the tag system: three child `vitest run`s over ONE
 * fixture tree — unfiltered, runtime-filtered (--tagsFilter), and
 * transform-selected (GherkinSettings.tags) — asserting the PRINTED counts.
 * The two filters must stay distinguishable end to end: a --tagsFilter'd
 * scenario EXISTS and skips (visible ↓ line), a transform-excluded one never
 * exists at all. Coverage is NOT discharged here; every branch stays
 * unit-covered in-process.
 */
describe("meta-suite: tags", () => {
  let unfiltered: MetaRunResult;
  let filtered: MetaRunResult;
  let selected: MetaRunResult;

  beforeAll(() => {
    unfiltered = runMetaFixture("tags");
    filtered = runMetaFixture("tags", ["--tagsFilter", "smoke && !slow"]);
    selected = runMetaFixture("tags", ["--config", "vitest.selection.config.ts"]);
  }, 300_000);

  describe("unfiltered run — declarations and reserved tags", () => {
    test("should print exact totals — every tagged scenario collects and runs", () => {
      // 1 failed = selection.feature's zero-row Examples; 9 passed =
      // filtering 3 + undeclared 2 + selection rows 2 + all-excluded 1 +
      // operator check 1. The 3 failed files are the zero-row red plus the
      // two reserved-tag collection failures.
      expect(unfiltered.summary.tests).toBe("1 failed | 9 passed (10)");
      expect(unfiltered.summary.testFiles).toBe("3 failed | 4 passed (7)");
    });

    test("should collect a feature whose tag is declared NOWHERE by the user — the config-time scan declares it", () => {
      // Without the scan, strictTags turns @nowhere-declared into the
      // invisible "no tests" collapse (probed on 4.1.4) — this green line IS
      // the scan working.
      expect(unfiltered.output).toContain(
        "✓ features/undeclared.feature > scan declaration > still collects",
      );
      expect(unfiltered.output).not.toContain("is not defined in the configuration");
    });

    test("should merge with user-declared tags — never clobber, never re-declare", () => {
      // Clobbered, the operator-only check fails collection; re-declared
      // ("operator" is both user-declared and in a feature), vitest dies at
      // startup with "Tag names must be unique" and NOTHING below runs.
      expect(unfiltered.output).toContain(
        "✓ checks/operator.test.ts > user-declared tags survive the plugin's merge",
      );
      expect(unfiltered.output).not.toContain("Tag names must be unique");
    });

    test("should fail collection LOUDLY on a reserved skip-family tag, anchored to the tag's line", () => {
      expect(unfiltered.output).toContain(
        [
          "Unsupported tag",
          "",
          "  @skip",
          "  at features/unsupported.feature:3:3",
          "",
          "this runner has no skip tag — exclude via `tags` in config",
        ].join("\n"),
      );
      // A collection failure contributes no test — the reserved scenario's
      // step must never have run.
      expect(unfiltered.output).not.toContain("META_SENTINEL_NOTE_skip");
    });

    test("should fail collection LOUDLY on a reserved concurrency tag at feature level", () => {
      expect(unfiltered.output).toContain(
        [
          "Unsupported tag",
          "",
          "  @concurrent",
          "  at features/concurrent.feature:1:1",
          "",
          "concurrency is not supported",
        ].join("\n"),
      );
      expect(unfiltered.output).not.toContain("META_SENTINEL_NOTE_concurrent");
    });
  });

  describe("--tagsFilter run — the runtime filter: tests EXIST and skip", () => {
    test("should print exact totals — one match, one tagged authoring error, everything else visibly skipped", () => {
      expect(filtered.summary.tests).toBe("1 failed | 1 passed | 8 skipped (10)");
      expect(filtered.summary.testFiles).toBe("3 failed | 1 passed | 3 skipped (7)");
    });

    test("should keep a TAGGED authoring error RED under a filter that selects its lane", () => {
      // The end-to-end half of the failing-node ruling: the zero-row
      // Examples block carries @smoke, so `smoke && !slow` selects it and
      // the red lands in the counts. Registered tagless it would print ↓ —
      // vitest skips an untagged test under any positive filter — hiding an
      // authoring error from the very lane that owns it.
      expect(filtered.output).toContain(
        "× features/selection.feature > outline separation > zero rows",
      );
      expect(filtered.output).not.toContain(
        "↓ features/selection.feature > outline separation > zero rows",
      );
      expect(filtered.output).toContain("Empty Examples table");
    });

    test("should run only the matching scenario and keep the non-matching one VISIBLE as skipped", () => {
      expect(filtered.output).toContain(
        "✓ features/filtering.feature > runtime tag filtering > smoke only",
      );
      // The filtered-out scenario still EXISTS — the transform-selected run
      // below proves the opposite behaviour on the same name.
      expect(filtered.output).toContain(
        "↓ features/filtering.feature > runtime tag filtering > smoke and slow",
      );
      expect(filtered.output).not.toContain("META_SENTINEL_NOTE_smoke-slow");
    });

    test("should still fail the reserved-tag files — a runtime filter cannot silence an unsupported tag", () => {
      expect(filtered.output).toContain("this runner has no skip tag");
      expect(filtered.output).toContain("concurrency is not supported");
    });
  });

  describe("transform-selected run — the config filter: scenarios never exist", () => {
    test("should print exact totals — excluded scenarios are absent from the counts entirely", () => {
      // 6 tests, not 10: filtering loses "smoke and slow", selection loses
      // both @slow rows, all-excluded loses its only scenario (whole file →
      // skipped suite). 1 failed = the zero-row Examples, still red.
      expect(selected.summary.tests).toBe("1 failed | 5 passed (6)");
      expect(selected.summary.testFiles).toBe("3 failed | 3 passed | 1 skipped (7)");
    });

    test("should leave NO trace of an excluded scenario — not a test line, not a sentinel", () => {
      expect(selected.output).not.toContain("smoke and slow");
      expect(selected.output).not.toContain("META_SENTINEL_NOTE_smoke-slow");
    });

    test("should report a fully excluded feature file as a SKIPPED suite, never a failure", () => {
      expect(selected.output).not.toContain("all-excluded.feature >");
      expect(selected.output).not.toContain("META_SENTINEL_NOTE_excluded");
    });

    test("should keep the outline separation in ONE run — all-rows-excluded QUIET, zero rows RED", () => {
      // Both outlines yield zero retained pickles; only the AST tells them
      // apart. The quiet one leaves no trace; the authoring error stays in
      // the counts.
      expect(selected.output).not.toContain("rows excluded wholesale");
      expect(selected.output).toContain(
        "× features/selection.feature > outline separation > zero rows",
      );
      expect(selected.output).toContain("Empty Examples table");
    });

    test("should run every retained scenario — the exclusion is surgical", () => {
      expect(selected.output).toContain("META_SENTINEL_NOTE_smoke");
      expect(selected.output).toContain("META_SENTINEL_NOTE_plain");
      expect(selected.output).toContain("META_SENTINEL_NOTE_undeclared");
      expect(selected.output).toContain("META_SENTINEL_NOTE_operator");
    });
  });
});
