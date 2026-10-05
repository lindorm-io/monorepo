import { readdir } from "node:fs/promises";
import { join } from "node:path";

export const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set([
  "node_modules",
  "dist",
  "coverage",
]);

// Skips every dot-named directory, dependency trees, build output and coverage reports.
const isSkippedDirectory = (name: string): boolean =>
  name.startsWith(".") || SKIPPED_DIRECTORIES.has(name);

/**
 * Code-unit comparison, never localeCompare — locale collation varies with
 * the ICU build, and this order reaches the coverage error message. Names
 * within one directory are unique, so equality has no branch.
 */
export const byEntryName = (a: { name: string }, b: { name: string }): number =>
  a.name < b.name ? -1 : 1;

/** pinned: walk-feature-files.test.ts */
export const walkFeatureFiles = async (dir: string): Promise<Array<string>> => {
  const found: Array<string> = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries.sort(byEntryName)) {
    if (entry.isDirectory()) {
      if (isSkippedDirectory(entry.name)) {
        continue;
      }
      found.push(...(await walkFeatureFiles(join(dir, entry.name))));
      continue;
    }

    if (entry.name.endsWith(".feature")) {
      found.push(join(dir, entry.name));
    }
  }

  return found;
};
