import { readFile } from "node:fs/promises";
import { createFilter } from "vite";
import { assertTagNames } from "../model/assert-tag-names.js";
import { toVitestTags } from "../model/to-vitest-tags.js";
import { collectFeatureTags } from "./collect-feature-tags.js";
import { toRootUri } from "./to-root-uri.js";
import { walkFeatureFiles } from "./walk-feature-files.js";

/** The minimal vitest TestTagDefinition shape the scan produces. */
export type GherkinTagDeclaration = { name: string };

export type ScanTagDeclarationsOptions = {
  /**
   * Tag names the user config already declares — skipped, because vitest
   * rejects a duplicate `test.tags` name at startup (measured on 4.1.4:
   * "Tag names must be unique"). Merging is vite's job; NOT re-declaring is
   * this scan's.
   */
  declared: Array<string>;
  features: Array<string>;
  root: string;
};

/**
 * The union of every tag in every configured `.feature` file, as vitest tag
 * declarations for `test.tags`. Mandatory, not an optimization: vitest's
 * strictTags (default true, kept) fails collection on any UNDECLARED tag a
 * registered test carries — one missed tag in one file and the whole suite
 * reports the invisible "no tests" (pinned: meta-tags.test.ts). Walks and
 * filters like assert-features-covered.ts, on the cadence-INDEPENDENT
 * `features` list, so a lane-excluded file's tags are still declared.
 */
export const scanTagDeclarations = async ({
  declared,
  features,
  root,
}: ScanTagDeclarationsOptions): Promise<Array<GherkinTagDeclaration>> => {
  const filter = createFilter(features, [], { resolve: root });
  const names = new Set<string>();

  for (const file of await walkFeatureFiles(root)) {
    if (filter(file) === false) {
      continue;
    }

    const tags = collectFeatureTags(await readFile(file, "utf8"));

    // Anchored HERE or nowhere: an illegal vitest tag name kills the run at
    // config resolution, before any transform, and vitest's own message
    // names no file (assert-tag-names.ts).
    assertTagNames(tags, toRootUri(root, file));

    for (const tag of tags) {
      names.add(tag.name);
    }
  }

  const skip = new Set(declared);

  return toVitestTags([...names])
    .filter((name) => skip.has(name) === false)
    .map((name) => ({ name }));
};
