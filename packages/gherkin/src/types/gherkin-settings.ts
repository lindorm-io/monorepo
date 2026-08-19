/**
 * Settings for `gherkinPlugin` — a config-shaped type for a single-arg
 * factory that constructs something, hence *Settings. Patterns are relative
 * to the Vite project root. M1 carries these two keys ONLY: an accepted but
 * unimplemented key (tags) would be a silently ignored modifier, so it does
 * not exist until the milestone that implements it.
 */
export type GherkinSettings = {
  /** Which `.feature` files run — default `["src/**\/*.feature"]`. */
  features?: Array<string>;
  /** Which step modules every feature loads — default `["src/**\/*.steps.ts"]`. */
  steps?: Array<string>;
};
