import { beforeAll, describe, expect, test } from "vitest";
import type { MetaRunResult } from "./__fixtures__/spawn-vitest.js";
import { runMetaFixture, runMetaFixtureOutput } from "./__fixtures__/spawn-vitest.js";

/**
 * The REPO-WIRING proof: the base-config fixture is a consumer-shaped package
 * whose vitest config comes from the REAL createVitestConfig({ decorators,
 * gherkin }) — so these children prove the async gherkin branch, the
 * dist-plugin import, and the cadence-lane derivation end-to-end, in printed
 * counts. The weekly lane's include derivation is mechanically identical to
 * integration's and is pinned in-process (base-config.test.ts); its EXCLUSION
 * from default and unit is what these children prove.
 */
describe("meta-suite: base-config wiring", () => {
  describe("default mode", () => {
    let result: MetaRunResult;

    beforeAll(() => {
      result = runMetaFixture("base-config");
    }, 180_000);

    test("should run plain + integration features — 2 files, 3 scenarios", () => {
      expect(result.summary.tests).toBe("3 passed (3)");
      expect(result.summary.testFiles).toBe("2 passed (2)");
    });

    test("should collect the integration lane but never the weekly lane", () => {
      expect(result.output).toContain(
        "✓ features/docker.integration.feature > Docker-backed notebook > an integration-lane note round-trips",
      );
      expect(result.output).not.toContain("nightly.weekly.feature");
    });
  });

  describe("unit mode", () => {
    let result: MetaRunResult;

    beforeAll(() => {
      result = runMetaFixture("base-config", ["--config", "vitest.unit.config.ts"]);
    }, 180_000);

    test("should run ONLY the plain feature — the lane-marker proof", () => {
      expect(result.summary.tests).toBe("2 passed (2)");
      expect(result.summary.testFiles).toBe("1 passed (1)");
    });

    test("should not collect the integration or weekly lanes at all", () => {
      expect(result.output).toContain("✓ features/notebook.feature");
      expect(result.output).not.toContain("docker.integration.feature");
      expect(result.output).not.toContain("nightly.weekly.feature");
    });
  });

  describe("integration mode", () => {
    let result: MetaRunResult;

    beforeAll(() => {
      result = runMetaFixture("base-config", [
        "--config",
        "vitest.integration.config.ts",
      ]);
    }, 180_000);

    test("should run ONLY the *.integration.feature file", () => {
      expect(result.summary.tests).toBe("1 passed (1)");
      expect(result.summary.testFiles).toBe("1 passed (1)");
      expect(result.output).toContain(
        "✓ features/docker.integration.feature > Docker-backed notebook > an integration-lane note round-trips",
      );
      expect(result.output).not.toContain("notebook.feature > Notebook");
    });

    test("should keep buildStart silent about lane-excluded features — the plugin got the cadence-independent list", () => {
      // Wired with the mode's resolved includes instead, the plugin's
      // buildStart would reject notebook.feature and nightly.weekly.feature
      // as orphans and the whole run would fail collection. The lane-SUFFIXED
      // include must likewise pass the collection guard
      // (assert-features-collected.ts reads it as the feature family).
      expect(result.output).not.toContain("feature_not_included");
      expect(result.output).not.toContain("not covered by the configured");
      expect(result.output).not.toContain("feature_not_collected");
    });
  });

  describe("include-overwrite accident", () => {
    let output = "";

    beforeAll(() => {
      // Raw output, no summary requirement: this child must die at STARTUP —
      // buildStart fires at server init, before test-file globbing, so the
      // guard trips although the overwritten include collects no feature.
      output = runMetaFixtureOutput("base-config", [
        "--config",
        "vitest.overwrite.config.ts",
      ]);
    }, 180_000);

    test("should die loudly with feature_not_collected, naming every dropped feature", () => {
      expect(output).toContain("code: 'feature_not_collected'");
      expect(output).toContain("features/notebook.feature");
      expect(output).toContain("features/docker.integration.feature");
      expect(output).toContain("features/nightly.weekly.feature");
    });

    test("should never reach the reporter — no green counts from the sanity test the overwrite still collects", () => {
      // Without the guard this child prints "1 passed (1)" (the sanity test)
      // with every feature silently absent — the invisible lie at package
      // granularity.
      expect(output).not.toContain("Test Files");
      expect(output).not.toContain("passed");
    });
  });
});
