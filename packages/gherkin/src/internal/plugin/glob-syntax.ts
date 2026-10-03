// An extglob (`@(`, `+(`) opens through its `(`.
const GLOB_CHARACTER = /[*?[\]{}()!|"]/;
const GLOB_OR_ESCAPE_CHARACTER = /[\\*?[\]{}()!|"]/g;

export const isLiteralPattern = (pattern: string): boolean =>
  GLOB_CHARACTER.test(pattern) === false;

/**
 * A path written as a glob that matches that path alone, for vitest's
 * test.exclude — never for createFilter, which reads every `\` as a path
 * separator. A `\` in a file name breaks that: picomatch collapses a run of
 * escaped backslashes, and also matches a name equal to the entry verbatim.
 */
export const escapeGlob = (path: string): string =>
  path.replace(GLOB_OR_ESCAPE_CHARACTER, "\\$&");
