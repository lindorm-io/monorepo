import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error untyped .mjs base config — bundled by vite's config loader.
import { createVitestConfig } from "../../vitest.config.base.mjs";
import { gherkinPlugin } from "./src/plugin.js";

// .ts config on purpose: vite's config loader bundles TypeScript, so the
// package's OWN feature run wires the plugin from SRC — an inline copy of the
// plugin here would fork the implementation.
const config = createVitestConfig({
  decorators: true,
  setupFiles: ["./vitest.setup.ts"],
});

config.plugins.unshift(
  gherkinPlugin({
    // meta-fixtures features are covered (buildStart walks the package root
    // and dies on any orphan .feature) but NOT collected — only the child
    // processes spawned by src/e2e run them.
    features: [
      "src/__fixtures__/features/**/*.feature",
      "meta-fixtures/**/*.feature",
      "example/**/*.feature",
    ],
    steps: ["src/__fixtures__/*.steps.ts"],
  }),
);

// Copy, never push: test.include IS the base's shared INCLUDES_BY_MODE array
// (pinned by src/base-config.test.ts, which imports this module).
config.test.include = [...config.test.include, "src/__fixtures__/features/**/*.feature"];

// The emitted module imports the published runtime subpath; aliasing it to
// src makes the in-package run execute (and coverage-instrument) source
// rather than dist.
config.resolve = {
  alias: {
    "@lindorm/gherkin/runtime": resolve(
      dirname(fileURLToPath(import.meta.url)),
      "src/runtime.ts",
    ),
  },
};

export default config;
