import { lstatSync } from "node:fs";
import { join, resolve } from "node:path";
import { globSync } from "tinyglobby";
import { SKIPPED_DIRECTORIES } from "../plugin/walk-feature-files.js";

export type ListFeatureFilesOptions = {
  cwd: string;
  exclude: Array<string>;
  features: Array<string>;
};

// The directories walk-feature-files.ts skips: every dot-named one, then those its set names.
const UNWALKED_DIRECTORIES = [
  "**/.*/**",
  ...Array.from(SKIPPED_DIRECTORIES, (name) => `**/${name}/**`),
];

// walk-feature-files.ts enters no symlinked directory. One that cannot be lstat'ed counts as
// unwalked, so its files stay read. pinned: no-unreached-step.cache.test.ts
const isWalkedDirectory = (directory: string): boolean => {
  try {
    return lstatSync(directory).isSymbolicLink() === false;
  } catch {
    return false;
  }
};

const isWalked = (cwd: string, path: string): boolean => {
  const directories = path.split("/").slice(0, -1);

  return (
    path.startsWith("../") === false &&
    directories.every((_, index) =>
      isWalkedDirectory(join(cwd, ...directories.slice(0, index + 1))),
    )
  );
};

// A pattern resolve-excluded-features.ts's createFilter reads as tinyglobby does here: it
// matches one ending in `/` against no file, where tinyglobby strips the `/`; matches one
// opening with `**` unanchored against the absolute path, which agrees with tinyglobby's
// relative match for `**` and `**/…` but not for a `**` glued to more characters
// (`**wip.feature`); rewrites every `\` to `/`, where tinyglobby reads an escape (`\.`); and
// builds its picomatch without `posix`, under which `[!a]` is a class holding `!` and `a`,
// where tinyglobby's `posix: true` makes it the negated class. A dropped pattern subtracts
// nothing, so the rule reads more, never fewer. pinned: no-unreached-step.test.ts
const isReadAlike = (pattern: string): boolean =>
  pattern.endsWith("/") === false &&
  (pattern.startsWith("**") === false || pattern === "**" || pattern.startsWith("**/")) &&
  pattern.includes("\\") === false &&
  pattern.includes("[!") === false;

// The files resolve-excluded-features.ts removes: those the runner's walk reaches that a pattern
// matches. pinned: no-unreached-step.test.ts
const listExcludedFiles = (cwd: string, exclude: Array<string>): Set<string> =>
  new Set(
    globSync(exclude.filter(isReadAlike), {
      cwd,
      dot: true,
      expandDirectories: false,
      followSymbolicLinks: true,
      ignore: UNWALKED_DIRECTORIES,
    })
      .filter((path) => isWalked(cwd, path))
      .map((path) => resolve(cwd, path)),
  );

// Each half mirrors the runner: `features` is listed with vitest's `globProjectFiles` options
// less its `ignore`, which prunes whole directories, and the files gherkin's `exclude` removes
// are subtracted. pinned: no-unreached-step.test.ts
export const listFeatureFiles = ({
  cwd,
  exclude,
  features,
}: ListFeatureFilesOptions): Array<string> => {
  const excluded = listExcludedFiles(cwd, exclude);

  return globSync(features, {
    cwd,
    dot: true,
    expandDirectories: false,
    followSymbolicLinks: true,
  })
    .map((path) => resolve(cwd, path))
    .filter((file) => excluded.has(file) === false);
};
