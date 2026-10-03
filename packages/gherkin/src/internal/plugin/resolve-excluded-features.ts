import { createFilter } from "vite";
import { isLiteralPattern } from "./glob-syntax.js";

export type ResolveExcludedFeaturesOptions = {
  exclude: Array<string>;
  /** The config hook's walk (walk-feature-files.ts), absolute. */
  files: Array<string>;
  root: string;
};

export type ExcludedFeatures = {
  /** The walked files some `exclude` pattern matches, absolute, in walk order. */
  files: Array<string>;
  unmatchedLiterals: Array<string>;
};

/**
 * `resolve: root` anchors each pattern the way assert-features-covered.ts
 * anchors `features`.
 */
export const resolveExcludedFeatures = ({
  exclude,
  files,
  root,
}: ResolveExcludedFeaturesOptions): ExcludedFeatures => {
  // One filter per pattern, never createFilter(exclude): handed an empty
  // list, createFilter matches every id, and `exclude: []` would exclude the
  // whole suite.
  const matchers = exclude.map((pattern) => ({
    pattern,
    matches: createFilter([pattern], [], { resolve: root }),
  }));

  return {
    files: files.filter((file) => matchers.some(({ matches }) => matches(file))),
    unmatchedLiterals: matchers
      .filter(
        ({ pattern, matches }) =>
          isLiteralPattern(pattern) && files.some((file) => matches(file)) === false,
      )
      .map(({ pattern }) => pattern),
  };
};
