import type { GherkinSettings } from "../../src/types/gherkin-settings.js";

/**
 * features/parked.wip.feature carries a tag name vitest rejects: excluded,
 * the tag scan never reads it. drafts/draft.feature matches no `features`
 * pattern: excluded, it is no orphan. `features/*]*.feature` matches
 * look-alike[1].feature alone; written unescaped into test.exclude, its path
 * would also prune look-alike1.feature.
 */
export const SETTINGS = {
  exclude: ["features/**/*.wip.feature", "drafts/**", "features/*]*.feature"],
  features: ["features/**/*.feature"],
  steps: ["steps/**/*.steps.ts"],
} satisfies GherkinSettings;
