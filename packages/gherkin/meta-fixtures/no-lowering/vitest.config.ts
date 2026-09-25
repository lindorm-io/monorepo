import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { gherkinPlugin } from "../../src/plugin.js";

const RUNTIME_SOURCE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../src/runtime.ts",
);

/**
 * The README's Quick start with its decorator-lowering half removed: no
 * unplugin-swc, no `oxc: false`. Vite's built-in oxc transform strips the
 * TypeScript and leaves the stage-3 decorators standing, so nothing in this
 * pipeline lowers them — the child must die on the lowering guard, pinned by
 * src/e2e/meta-no-lowering.test.ts.
 */
export default defineConfig({
  plugins: [
    ...gherkinPlugin({
      features: ["features/**/*.feature"],
      steps: ["steps/**/*.steps.ts"],
    }),
  ],
  resolve: {
    alias: { "@lindorm/gherkin/runtime": RUNTIME_SOURCE },
  },
  test: {
    dangerouslyIgnoreUnhandledErrors: false,
    environment: "node",
    globals: false,
    include: ["features/**/*.feature"],
  },
});
