import { parse } from "@cucumber/tag-expressions";
import { isUndefined } from "@lindorm/is";
import { GherkinError } from "../../errors/GherkinError.js";
import type { GherkinSettings } from "../../types/gherkin-settings.js";
import type { TagMatcher } from "../registry/compile-tag-expression.js";

export type ResolvedGherkinSettings = {
  features: Array<string>;
  steps: Array<string>;
  /** Always callable — without a `tags` setting it retains every pickle. */
  tagFilter: TagMatcher;
};

const KNOWN_KEYS: Array<string> = ["features", "steps", "tags"];

/**
 * Unknown keys FAIL, never no-op: the type only guards TypeScript consumers,
 * and a JS consumer passing a misspelled key would otherwise get the silently
 * ignored modifier the settings type exists to forbid (gherkin-settings.ts).
 */
const assertKnownKeys = (settings: GherkinSettings): void => {
  for (const key of Object.keys(settings)) {
    if (KNOWN_KEYS.includes(key)) {
      continue;
    }

    throw new GherkinError(`Unknown gherkin setting "${key}"`, {
      code: "unknown_setting",
      details:
        "GherkinSettings carries `features`, `steps` and `tags` only. An accepted-but-unimplemented key would be a silent no-op, so an unknown one fails at config time instead. Remove the key, or fix its spelling.",
      data: { key, known: [...KNOWN_KEYS] },
    });
  }
};

/**
 * Compiled ONCE at plugin construction, so a malformed expression fails at
 * config time — the same Cucumber language hook expressions use
 * (compile-tag-expression.ts): `and` / `or` / `not` with parentheses over
 * @-prefixed tags. NOT vitest's `--tagsFilter` syntax (`&&`/`||`/`!`, no
 * `@`) — the two-filter wart README.md#tags names.
 */
const toTagFilter = (tags?: string): TagMatcher => {
  if (isUndefined(tags)) {
    return () => true;
  }

  try {
    const node = parse(tags);
    return (names) => node.evaluate(names);
  } catch (error) {
    throw new GherkinError(
      `Invalid tag expression ${JSON.stringify(tags)} in gherkin setting "tags"`,
      {
        code: "invalid_tag_expression",
        details:
          "The `tags` setting selects scenarios at transform time with Cucumber's tag-expression language — `and` / `or` / `not` with parentheses over @-prefixed tags (NOT vitest's --tagsFilter syntax). Fix the expression.",
        data: { tags },
        cause: error,
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
    tagFilter: toTagFilter(settings.tags),
  };
};
