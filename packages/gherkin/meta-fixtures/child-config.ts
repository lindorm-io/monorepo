import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import swc from "unplugin-swc";
import type { ViteUserConfig } from "vitest/config";
import { defineConfig } from "vitest/config";
import { gherkinPlugin } from "../src/plugin.js";
import type { GherkinSettings } from "../src/types/gherkin-settings.js";

const RUNTIME_SOURCE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/runtime.ts",
);

/**
 * The vitest config every meta-fixture child run shares. Each fixture
 * directory is its own vitest ROOT (the config sits in the fixture dir), so
 * the plugin's buildStart walk sees only that fixture's tree. Mirrors the
 * package's own wiring (vitest.config.ts): plugin from SRC, runtime subpath
 * aliased to src, swc decorator lowering — no coverage (child V8 coverage
 * never reaches the parent; every branch is unit-covered in-process).
 */
export const createChildConfig = (settings: GherkinSettings): ViteUserConfig =>
  defineConfig({
    plugins: [
      // MUST precede swc — swc would fail to parse raw .feature text.
      ...gherkinPlugin(settings),
      swc.vite({
        jsc: {
          parser: { syntax: "typescript", decorators: true },
          target: "es2022",
          transform: { decoratorVersion: "2022-03" },
          keepClassNames: true,
        },
      }),
    ],
    oxc: false,
    resolve: {
      alias: { "@lindorm/gherkin/runtime": RUNTIME_SOURCE },
    },
    test: {
      // Explicit, never defaulted: an unhandled rejection is a backstop the
      // meta-suite asserts AGAINST — the failure must live in the counts.
      dangerouslyIgnoreUnhandledErrors: false,
      environment: "node",
      globals: false,
      include: ["features/**/*.feature"],
    },
  });
