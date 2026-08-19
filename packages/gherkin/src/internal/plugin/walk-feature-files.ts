import { readdir } from "node:fs/promises";
import { join } from "node:path";

/** Never feature sources: dependency trees, build output, git internals. */
const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist", ".git"]);

/**
 * Code-unit comparison, never localeCompare — locale collation varies with
 * the ICU build, and this order reaches the coverage error message. Names
 * within one directory are unique, so equality has no branch.
 */
export const byEntryName = (a: { name: string }, b: { name: string }): number =>
  a.name < b.name ? -1 : 1;

/**
 * Every `.feature` file under `dir`, absolute paths in sorted order (readdir
 * order is filesystem-dependent; the coverage error message must be
 * deterministic). A directory named `*.feature` is walked into, not listed.
 */
export const walkFeatureFiles = async (dir: string): Promise<Array<string>> => {
  const found: Array<string> = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries.sort(byEntryName)) {
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) {
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
