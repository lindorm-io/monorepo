import { createFilter } from "vite";
import { GherkinError } from "../../errors/GherkinError.js";
import { toFeatureUri } from "./to-feature-uri.js";

export type AssertFeaturesCoveredOptions = {
  features: Array<string>;
  /** The buildStart walk's `.feature` files, absolute (walk-feature-files.ts). */
  files: Array<string>;
  root: string;
};

/**
 * A `.feature` file matching no `features` glob runs zero tests and reports
 * nothing — the silent-pass lie at file granularity — so an uncovered file is
 * a loud config failure at buildStart. Compared against the settings'
 * cadence-INDEPENDENT `features` list, never a mode's resolved includes: a
 * unit lane deliberately excluding `*.integration.feature` must not trip this.
 * `files` comes from the ONE buildStart walk shared with
 * assert-features-collected.ts, so the two guards judge the same file set.
 */
export const assertFeaturesCovered = ({
  features,
  files,
  root,
}: AssertFeaturesCoveredOptions): void => {
  // resolve: root anchors the relative patterns to the project root, matching
  // absolute paths beneath it (verified against vite 8's createFilter).
  const filter = createFilter(features, [], { resolve: root });
  const orphans = files
    .filter((file) => filter(file) === false)
    .map((file) => toFeatureUri(root, file));

  if (orphans.length === 0) {
    return;
  }

  throw new GherkinError(
    [
      "Feature file(s) not covered by the configured `features` patterns — they would never run:",
      ...orphans.map((uri) => `  ${uri}`),
      "Configured patterns:",
      ...features.map((pattern) => `  ${pattern}`),
    ].join("\n"),
    {
      code: "feature_not_included",
      title: "Feature File Not Included",
      details:
        "A .feature file exists under the project root but matches none of the configured `features` patterns, so it would silently run zero tests. Widen the patterns, or move/delete the file.",
      data: { features, orphans, root },
    },
  );
};
