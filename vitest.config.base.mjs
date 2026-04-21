import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

const here = fileURLToPath(new URL(".", import.meta.url));
const packagesRoot = resolve(here, "packages");
const packageSourceAliases = readdirSync(packagesRoot).flatMap((pkg) => {
  const pkgRoot = `${packagesRoot}/${pkg}`;
  return [
    {
      find: new RegExp(`^@lindorm/${pkg}$`),
      replacement: `${pkgRoot}/src/index.ts`,
    },
    {
      find: new RegExp(`^@lindorm/${pkg}/(.*)$`),
      replacement: `${pkgRoot}/src/$1`,
    },
  ];
});

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

export const createVitestConfig = ({ decorators = false, setupFiles = [] } = {}) =>
  defineConfig({
    plugins: decorators ? [swcDecoratorPlugin()] : [],
    oxc: decorators ? false : undefined,
    // Resolve @lindorm/* packages to their TypeScript source instead of the
    // compiled CJS dist. Required for the Scanner-using packages (worker,
    // proteus, hermes, pylon, iris): Scanner.import() loads .ts fixtures
    // via dynamic import(), which only works through vitest's module
    // runner — i.e., when the containing file is vitest-transformed.
    resolve: {
      alias: packageSourceAliases,
    },
    test: {
      globals: false,
      environment: "node",
      include: ["src/**/*.test.ts"],
      exclude: ["**/dist/**", "**/node_modules/**"],
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
