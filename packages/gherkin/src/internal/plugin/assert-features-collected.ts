import { isString } from "@lindorm/is";
import { createFilter } from "vite";
import { configDefaults } from "vitest/config";
import { GherkinError } from "../../errors/GherkinError.js";
import { toRootUri } from "./to-root-uri.js";

export type AssertFeaturesCollectedOptions = {
  features: Array<string>;
  files: Array<string>;
  /** vitest's resolved `test.include`; absent when the consumer set none. */
  include?: Array<string>;
  root: string;
};

type UncollectedFeature = {
  /** The `features` pattern the file matched. */
  pattern: string;
  /** Root-relative path, matching the coverage guard's message format. */
  uri: string;
};

/**
 * A lane include narrows `pattern.feature` to the suffixed form
 * (`toFeatureIncludes` in the repo's vitest.config.base.mjs): the suffixed
 * include proves the
 * cadence-independent FAMILY is wired for collection, so a plain feature the
 * integration/weekly lane correctly leaves out must not read as
 * uncollectable. Pinned by the integration-mode child in
 * src/e2e/base-config-wiring.test.ts.
 */
const toCadenceIndependent = (pattern: string): string =>
  pattern.replace(/\.(integration|weekly)\.feature$/, ".feature");

/**
 * The companion of assert-features-covered.ts, closing the other half of the
 * gap: `features` proves a `.feature` file is gherkin's to run, but only
 * vitest's `test.include` makes it a collected test — a consumer that
 * OVERWRITES `test.include` after wiring (instead of spreading) keeps the
 * coverage check green while every feature silently drops out of the counts.
 * So every file matching a `features` pattern must match an include pattern
 * in its cadence FAMILY (toCadenceIndependent) — which means an overwrite
 * that keeps only a lane-suffixed glob still passes: the guard proves the
 * family collectable, never the current mode's own derived includes
 * (limitation tracked in the workspace TODO-MONOREPO.md).
 * `test.exclude` is never consulted: a lane exclusion prunes files the
 * include still names, and a feature that must never be collected is listed
 * in BOTH include and exclude (this package's own vitest.config.ts does so
 * for its meta fixtures) — a visible decision, not this failure.
 */
export const assertFeaturesCollected = ({
  features,
  files,
  include,
  root,
}: AssertFeaturesCollectedOptions): void => {
  // Absent include means vitest applies its own default test globs — those
  // can never match `*.feature`, and substituting the real defaults keeps
  // the error naming the list vitest actually uses.
  const resolvedInclude = include ?? [...configDefaults.include];
  // An EXPLICITLY empty include collects nothing in vitest, but createFilter
  // reads an empty include list as "match everything" — handed through, the
  // guard would fail OPEN on the one config that collects the least. So
  // empty ⇒ no file is collectable.
  // resolve: root — the same anchoring as assert-features-covered.ts, so the
  // two guards cannot disagree on what "matches" means.
  const collected =
    resolvedInclude.length === 0
      ? () => false
      : createFilter(resolvedInclude.map(toCadenceIndependent), [], {
          resolve: root,
        });
  const matchers = features.map((pattern) => ({
    pattern,
    matches: createFilter([pattern], [], { resolve: root }),
  }));

  const uncollected: Array<UncollectedFeature> = files
    .map((file) => ({
      file,
      pattern: matchers.find(({ matches }) => matches(file))?.pattern,
    }))
    .filter(
      (entry): entry is { file: string; pattern: string } =>
        // A file outside every `features` pattern is not gherkin's to police
        // here — it is the coverage guard's orphan.
        isString(entry.pattern) && collected(entry.file) === false,
    )
    .map(({ file, pattern }) => ({ pattern, uri: toRootUri(root, file) }));

  if (uncollected.length === 0) {
    return;
  }

  // Every uncollected file, matching the coverage guard's list-all shape:
  // one failure names the whole fix.
  throw new GherkinError(
    [
      "Feature file(s) matched by `features` but never collected by vitest's `test.include` — the run would stay green without them:",
      ...uncollected.map(({ pattern, uri }) => `  ${uri} (matches: ${pattern})`),
      "Resolved test.include:",
      ...resolvedInclude.map((pattern) => `  ${pattern}`),
    ].join("\n"),
    {
      code: "feature_not_collected",
      details:
        "A .feature file matches the configured `features` patterns but no `test.include` pattern, so vitest never collects it — the coverage check passes, the counts stay green, and the feature silently never runs. Append the feature globs to `test.include` by spreading the existing array — never overwrite it. A feature that must never be collected belongs in BOTH `test.include` and `test.exclude`.",
      data: { features, include: resolvedInclude, root, uncollected },
    },
  );
};
