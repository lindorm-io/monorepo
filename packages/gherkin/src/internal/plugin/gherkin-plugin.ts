import type { Plugin } from "vite";
import type { GherkinSettings } from "../../types/gherkin-settings.js";
import { buildFeatureModel } from "../model/build-feature-model.js";
import { assertFeaturesCovered } from "./assert-features-covered.js";
import { cleanId } from "./clean-id.js";
import { emitFeatureModule } from "./emit-feature-module.js";
import { normalizeStepPatterns } from "./normalize-step-patterns.js";
import { resolveSettings } from "./resolve-settings.js";
import { toFeatureUri } from "./to-feature-uri.js";

export type GherkinTransformResult = {
  code: string;
  /**
   * Never a source map — feature-file line numbers travel explicitly inside
   * the model (StepModel.line/column), so failures anchor to the `.feature`
   * file without one, and a real map would point at generated code.
   */
  map: null;
};

/**
 * Vite's Plugin narrowed to the hooks this plugin implements, as directly
 * callable functions — hooks never touch `this`, so unit tests invoke them
 * in-process (plugin code runs in the config process, outside the coverage
 * worker; the in-package feature run proves the wiring, these types make the
 * logic testable).
 */
export type GherkinVitePlugin = Plugin & {
  buildStart: () => Promise<void>;
  configResolved: (config: { root: string }) => void;
  transform: (code: string, id: string) => GherkinTransformResult | null;
};

export const gherkinPlugin = (settings?: GherkinSettings): GherkinVitePlugin => {
  const { features, steps } = resolveSettings(settings);

  // Vite calls configResolved before buildStart/transform; process.cwd() is
  // vite's own default root, kept only so the hooks are callable standalone.
  let root = process.cwd();

  return {
    name: "lindorm-gherkin",
    // MUST precede unplugin-swc (spike-verified): swc would otherwise see the
    // raw .feature text and fail to parse it as TypeScript.
    enforce: "pre",

    configResolved: (config: { root: string }): void => {
      root = config.root;
    },

    buildStart: async (): Promise<void> => assertFeaturesCovered({ features, root }),

    transform: (code: string, id: string): GherkinTransformResult | null => {
      const file = cleanId(id);

      if (file.endsWith(".feature")) {
        return {
          code: emitFeatureModule({
            model: buildFeatureModel(code, toFeatureUri(root, file)),
            stepPatterns: normalizeStepPatterns(steps),
          }),
          map: null,
        };
      }

      return null;
    },
  };
};
