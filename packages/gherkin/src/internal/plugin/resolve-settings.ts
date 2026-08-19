import { isUndefined } from "@lindorm/is";
import { GherkinError } from "../../errors/GherkinError.js";
import type { GherkinSettings } from "../../types/gherkin-settings.js";

export type ResolvedGherkinSettings = {
  features: Array<string>;
  steps: Array<string>;
};

const KNOWN_KEYS: Array<string> = ["features", "steps"];

/**
 * Unknown keys FAIL, never no-op: the type only guards TypeScript consumers,
 * and a JS consumer passing e.g. `tags` would otherwise get the silently
 * ignored modifier the settings type exists to forbid (gherkin-settings.ts).
 */
const assertKnownKeys = (settings: GherkinSettings): void => {
  for (const key of Object.keys(settings)) {
    if (KNOWN_KEYS.includes(key)) {
      continue;
    }

    throw new GherkinError(
      key === "tags"
        ? 'Unknown gherkin setting "tags" — tag-based scenario selection is not yet shipped'
        : `Unknown gherkin setting "${key}"`,
      {
        code: "unknown_setting",
        title: "Unknown Gherkin Setting",
        details:
          "GherkinSettings carries `features` and `steps` only. An accepted-but-unimplemented key would be a silent no-op, so an unknown one fails at config time instead. Remove the key, or fix its spelling.",
        data: { key, known: [...KNOWN_KEYS] },
      },
    );
  }
};

export const resolveSettings = (
  settings: GherkinSettings = {},
): ResolvedGherkinSettings => {
  assertKnownKeys(settings);

  return {
    features: isUndefined(settings.features) ? ["src/**/*.feature"] : settings.features,
    steps: isUndefined(settings.steps) ? ["src/**/*.steps.ts"] : settings.steps,
  };
};
