/**
 * Settings for `gherkinPlugin` — a config-shaped type for a single-arg
 * factory that constructs something, hence *Settings. Patterns are relative
 * to the Vite project root.
 */
export type GherkinSettings = {
  /**
   * Feature files that are not part of the suite — default `[]`. Any glob,
   * resolved at startup to the `.feature` files it matches: vitest never
   * collects them, no startup guard reports them, and their tags are neither
   * validated nor declared. A non-feature file is never excluded. An entry without a glob
   * character (`* ? [ ] { } ( ) ! | "`) is a literal path, and fails the run
   * (`exclude_unmatched`) when it names no feature file. Matched as written:
   * `src/**\/*.wip.feature` leaves `a.wip.integration.feature` in. A matching
   * file created in watch mode runs until vitest restarts.
   */
  exclude?: Array<string>;
  /** Which `.feature` files run — default `["src/**\/*.feature"]`. */
  features?: Array<string>;
  /** Which step modules every feature loads — default `["src/**\/*.steps.ts"]`. */
  steps?: Array<string>;
  /**
   * Cucumber tag expression (`and` / `or` / `not` over @-prefixed tags,
   * e.g. `"not @slow"`) applied at TRANSFORM time: an excluded scenario
   * never becomes a test — the lane decision, in config, reviewable.
   * Ad-hoc runtime narrowing is vitest's own `--tagsFilter`, with a
   * DIFFERENT syntax (`&&`/`||`/`!`, no `@`), which SKIPS instead of
   * omitting. No CLI or env path for this setting on purpose: a runtime
   * value would read a stale Vite transform cache.
   */
  tags?: string;
};
