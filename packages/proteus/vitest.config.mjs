import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: {
          syntax: "typescript",
          decorators: true,
        },
        target: "es2022",
        transform: {
          decoratorVersion: "2022-03",
        },
        keepClassNames: true,
      },
    }),
  ],
  oxc: false,
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["**/dist/**", "**/node_modules/**"],
    setupFiles: ["./vitest.setup.ts"],
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
