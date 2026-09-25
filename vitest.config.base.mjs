import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// unplugin-swc lowers TypeScript stage-3 decorators to __esDecorate helpers,
// which vitest's default oxc transformer does not yet do. Opt in via
// { decorators: true } for packages that rely on decorator syntax.
const swcDecoratorPlugin = () =>
  swc.vite({
    jsc: {
      parser: { syntax: "typescript", decorators: true },
      target: "es2022",
      transform: { decoratorVersion: "2022-03" },
      keepClassNames: true,
    },
  });

// Cadence-driven test selection. File suffix determines which bucket a test
// belongs to: *.test.ts (unit), *.integration.test.ts (integration),
// *.weekly.test.ts (weekly). Each cadence has its own vitest config that
// imports the base with the matching mode.
//
// "default" mode runs everything that ships in the regular CI (unit +
// integration). Weekly is opt-in via its own mode/script — it runs in a
// separate scheduled CI workflow, not on every push.
const INCLUDES_BY_MODE = {
  default: ["src/**/*.test.ts"],
  unit: ["src/**/*.test.ts"],
  integration: ["src/**/*.integration.test.ts"],
  weekly: ["src/**/*.weekly.test.ts"],
};

const EXCLUDES_BY_MODE = {
  default: ["**/*.weekly.test.ts"],
  unit: ["**/*.integration.test.ts", "**/*.weekly.test.ts"],
  integration: [],
  weekly: [],
};

// Gherkin `.feature` files follow the same suffix cadence as *.test.ts
// (*.integration.feature, *.weekly.feature). One source of truth: every mode's
// include is DERIVED from the single `gherkin.features` list — default/unit
// run the list as-is (suffixed files match it and are pruned via excludes,
// mirroring EXCLUDES_BY_MODE), integration/weekly rewrite the trailing
// ".feature" to the suffixed form (mirroring INCLUDES_BY_MODE).
const FEATURE_EXCLUDES_BY_MODE = {
  default: ["**/*.weekly.feature"],
  unit: ["**/*.integration.feature", "**/*.weekly.feature"],
  integration: [],
  weekly: [],
};

const toFeatureIncludes = (features, mode) => {
  switch (mode) {
    case "integration":
      return features.map((p) => p.replace(/\.feature$/, ".integration.feature"));
    case "weekly":
      return features.map((p) => p.replace(/\.feature$/, ".weekly.feature"));
    default:
      return features;
  }
};

export const createVitestConfig = ({
  mode = "default",
  decorators = false,
  setupFiles = [],
  serial = false,
  gherkin = undefined,
} = {}) => {
  if (!Object.hasOwn(INCLUDES_BY_MODE, mode)) {
    throw new Error(`createVitestConfig: unknown mode "${mode}"`);
  }

  const config = defineConfig({
    plugins: decorators ? [swcDecoratorPlugin()] : [],
    oxc: decorators ? false : undefined,
    test: {
      globals: false,
      environment: "node",
      include: INCLUDES_BY_MODE[mode],
      exclude: ["**/dist/**", "**/node_modules/**", ...EXCLUDES_BY_MODE[mode]],
      // Explicit, never defaulted: an unhandled rejection must stay a loud
      // backstop — a runner/test that forgot an await reports RED, not green
      // with a side-note.
      dangerouslyIgnoreUnhandledErrors: false,
      setupFiles,
      globalSetup: ["../../vitest.global-setup.mjs"],
      coverage: {
        provider: "v8",
        reporter: ["lcov"],
        reportsDirectory: "../../.vitest/coverage",
        include: ["src/**/*.ts"],
        // *.steps.ts are gherkin step definitions — test code, like
        // *.test.ts: written ahead of their feature in red-to-green TDD, so
        // they must not fail the coverage gate.
        exclude: ["**/*.test.ts", "**/*.steps.ts", "**/dist/**", "**/node_modules/**"],
        thresholds: {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
      },
    },
  });

  if (serial) {
    config.test.fileParallelism = false;
    config.test.pool = "forks";
    config.test.maxWorkers = 1;
  }

  if (gherkin === undefined) {
    return config;
  }

  // Default mirrors resolve-settings.ts in @lindorm/gherkin (bound by a test
  // in packages/gherkin); resolved here so the plugin and the include
  // derivation read ONE list.
  const features = gherkin.features ?? ["src/**/*.feature"];

  for (const pattern of features) {
    // toFeatureIncludes rewrites the trailing ".feature" per lane; any other
    // ending would silently no-op the rewrite and run the wrong lane in
    // integration/weekly modes.
    if (pattern.endsWith(".feature") === false) {
      throw new Error(
        `createVitestConfig: gherkin features pattern "${pattern}" must end with ".feature"`,
      );
    }
  }

  // The gherkin branch alone is ASYNC (vite awaits an async config export):
  // the lazy import keeps the other packages' configs from ever resolving
  // @lindorm/gherkin/plugin, and the non-gherkin return stays synchronous.
  return import("@lindorm/gherkin/plugin").then(({ gherkinPlugin }) => {
    // The plugin gets the cadence-INDEPENDENT list: its buildStart coverage
    // check must not fire on a lane a mode correctly excludes
    // (assert-features-covered.ts). Before swc — .feature is not TypeScript.
    config.plugins.unshift(...gherkinPlugin({ ...gherkin, features }));

    // Copy, never push: test.include IS the shared INCLUDES_BY_MODE array
    // (pinned by base-config.test.ts — pushing would grow it across calls).
    config.test.include = [...config.test.include, ...toFeatureIncludes(features, mode)];
    config.test.exclude = [...config.test.exclude, ...FEATURE_EXCLUDES_BY_MODE[mode]];

    return config;
  });
};
