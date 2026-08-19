import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ViteUserConfig } from "vitest/config";
// @ts-expect-error untyped .mjs base config — bundled by vite's config loader.
import { createVitestConfig } from "../../../../vitest.config.base.mjs";
import type { GherkinSettings } from "../../src/types/gherkin-settings.js";

const DIRECTORY = dirname(fileURLToPath(import.meta.url));

const SETTINGS: GherkinSettings = {
  features: ["features/**/*.feature"],
  steps: ["steps/**/*.steps.ts"],
};

/**
 * The REPO-WIRING proof: this child builds its config through the real
 * `createVitestConfig({ decorators, gherkin })` — async branch, dist-plugin
 * import, mode-derived feature includes/excludes — exactly as a consuming
 * package would, and KEEPS the dist plugin instance the wiring created: a
 * wiring bug (e.g. handing the plugin a mode-derived features list) fails
 * this child's collection, not just the in-process pins. Two overlays:
 *
 * 1. runtime subpath → src. The fixture's steps import the src index (house
 *    convention — a public-name self-import would need dist at typecheck
 *    time), and registrations are module state, so runtime and steps must
 *    resolve ONE module or every step reports undefined. Child V8 coverage
 *    never reaches the parent; dist↔src decorator parity is pinned by
 *    src/e2e/tsc-lowering.test.ts.
 * 2. globalSetup → the repo-root file by absolute path (the base names it
 *    relative to a `packages/<name>/` root; this fixture sits deeper).
 */
export const createBaseConfigChildConfig = async (
  mode?: string,
): Promise<ViteUserConfig> => {
  const config = await createVitestConfig({ mode, decorators: true, gherkin: SETTINGS });

  config.resolve = {
    alias: {
      "@lindorm/gherkin/runtime": resolve(DIRECTORY, "../../src/runtime.ts"),
    },
  };
  config.test.globalSetup = [resolve(DIRECTORY, "../../../../vitest.global-setup.mjs")];

  return config as ViteUserConfig;
};
