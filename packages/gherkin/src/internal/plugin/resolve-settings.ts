import { isUndefined } from "@lindorm/is";
import type { GherkinSettings } from "../../types/gherkin-settings.js";

export type ResolvedGherkinSettings = {
  features: Array<string>;
  steps: Array<string>;
};

export const resolveSettings = (
  settings: GherkinSettings = {},
): ResolvedGherkinSettings => ({
  features: isUndefined(settings.features) ? ["src/**/*.feature"] : settings.features,
  steps: isUndefined(settings.steps) ? ["src/**/*.steps.ts"] : settings.steps,
});
