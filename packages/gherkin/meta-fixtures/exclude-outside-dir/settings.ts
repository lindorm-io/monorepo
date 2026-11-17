import type { GherkinSettings } from "../../src/types/gherkin-settings.js";

/**
 * drafts/draft.feature matches no `features` pattern and carries `@wip`:
 * excluded, it is no orphan and the tag scan never declares its tag, so
 * vitest collecting it anyway fails under strictTags.
 */
export const SETTINGS = {
  exclude: ["drafts/**"],
  features: ["features/**/*.feature"],
  steps: ["steps/**/*.steps.ts"],
} satisfies GherkinSettings;
