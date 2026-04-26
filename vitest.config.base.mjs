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

export const createVitestConfig = ({
  mode = "default",
  decorators = false,
  setupFiles = [],
  serial = false,
} = {}) => {
  if (!(mode in INCLUDES_BY_MODE)) {
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
      setupFiles,
      globalSetup: ["../../vitest.global-setup.mjs"],
      coverage: {
        provider: "v8",
        reporter: ["lcov"],
        reportsDirectory: "../../.vitest/coverage",
        include: ["src/**/*.ts"],
        exclude: ["**/*.test.ts", "**/dist/**", "**/node_modules/**"],
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

  return config;
};
