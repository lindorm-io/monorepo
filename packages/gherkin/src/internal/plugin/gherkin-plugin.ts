import { resolve } from "node:path";
import type { Plugin } from "vite";
import { createFilter } from "vite";
import type { GherkinSettings } from "../../types/gherkin-settings.js";
import { buildFeatureModel } from "../model/build-feature-model.js";
import { assertFeaturesCollected } from "./assert-features-collected.js";
import { assertFeaturesCovered } from "./assert-features-covered.js";
import { assertStepModuleLowered } from "./assert-step-module-lowered.js";
import { cleanId } from "./clean-id.js";
import { emitFeatureModule } from "./emit-feature-module.js";
import { normalizeStepPatterns } from "./normalize-step-patterns.js";
import { resolveSettings } from "./resolve-settings.js";
import type { GherkinTagDeclaration } from "./scan-tag-declarations.js";
import { scanTagDeclarations } from "./scan-tag-declarations.js";
import { toRootUri } from "./to-root-uri.js";
import { walkFeatureFiles } from "./walk-feature-files.js";

export type GherkinTransformResult = {
  code: string;
  /**
   * Never a source map — feature-file line numbers travel explicitly inside
   * the model (StepModel.line/column), so failures anchor to the `.feature`
   * file without one, and a real map would point at generated code.
   */
  map: null;
};

/** The slice of vite's UserConfig the config hook reads — kept structural so the narrowed hook type below stays assignable to vite's. */
export type GherkinUserConfig = {
  root?: string;
  test?: { tags?: Array<GherkinTagDeclaration> };
};

/** What the config hook returns — vite merges it into the user config (arrays concatenate). */
export type GherkinConfigPatch = {
  test: { tags: Array<GherkinTagDeclaration> };
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
  config: (config: GherkinUserConfig) => Promise<GherkinConfigPatch>;
  configResolved: (config: { root: string; test?: { include?: Array<string> } }) => void;
  transform: (code: string, id: string) => GherkinTransformResult | null;
};

/**
 * The lowering guard, a plugin of its own because `order: "post"` is a
 * per-HOOK property and the feature transform must stay first: one plugin
 * cannot hold both ends of the chain.
 */
export type GherkinLoweringVitePlugin = Plugin & {
  transform: {
    order: "post";
    handler: (code: string, id: string) => null;
  };
};

/** Wired as one entry — vite flattens a nested `plugins` array. */
export type GherkinVitePlugins = [GherkinVitePlugin, GherkinLoweringVitePlugin];

export const gherkinPlugin = (settings?: GherkinSettings): GherkinVitePlugins => {
  const { features, steps, tagFilter } = resolveSettings(settings);

  // Vite calls configResolved before buildStart/transform; process.cwd() is
  // vite's own default root, kept only so the hooks are callable standalone.
  let root = process.cwd();
  // vitest's resolved config carries test.include only when the consumer set
  // one; absent means vitest applies its own default test globs
  // (assert-features-collected.ts substitutes configDefaults).
  let include: Array<string> | undefined;
  // Rebuilt from the resolved root below — createFilter anchors a relative
  // pattern at the root it was handed, so the cwd default would mis-anchor
  // every step pattern under a configured root.
  let isStepModule = createFilter(steps, [], { resolve: root });

  return [
    {
      name: "lindorm-gherkin",
      // MUST precede unplugin-swc (spike-verified): swc would otherwise see
      // the raw .feature text and fail to parse it as TypeScript.
      enforce: "pre",

      // Runs at config resolution, before any collection: the emitted tests
      // carry vitest tags, and vitest's strictTags (default true, kept) fails
      // collection on any UNDECLARED tag — so the union of every feature
      // file's tags is injected into `test.tags` here, or one missed tag
      // collapses the suite to the invisible "no tests".
      // ⚠ Computed ONCE at config time: a tag newly added to a .feature
      // mid-watch is undeclared until vitest restarts — strictTags then fails
      // collection LOUDLY (that is strictTags working, never a silent skip).
      // Documented in README.md#tags.
      config: async (config: GherkinUserConfig): Promise<GherkinConfigPatch> => ({
        test: {
          tags: await scanTagDeclarations({
            declared: (config.test?.tags ?? []).map((tag) => tag.name),
            features,
            // The hook runs before configResolved, so the root is derived the
            // way vite derives it: the configured root or the cwd.
            root: resolve(config.root ?? "."),
          }),
        },
      }),

      configResolved: (config: {
        root: string;
        test?: { include?: Array<string> };
      }): void => {
        root = config.root;
        include = config.test?.include;
        isStepModule = createFilter(steps, [], { resolve: root });
      },

      // ONE walk feeds both guards — the same file set and the same
      // createFilter resolve-root semantics, so "covered" and "collected"
      // cannot disagree on what a feature file is. buildStart follows
      // configResolved (root + include) and fires at server init, before test
      // file globbing — pinned by the overwrite child in
      // src/e2e/base-config-wiring.test.ts, which dies here although its
      // include collects no feature at all.
      buildStart: async (): Promise<void> => {
        const files = await walkFeatureFiles(root);
        assertFeaturesCovered({ features, files, root });
        assertFeaturesCollected({ features, files, include, root });
      },

      transform: (code: string, id: string): GherkinTransformResult | null => {
        const file = cleanId(id);

        if (file.endsWith(".feature")) {
          return {
            code: emitFeatureModule({
              model: buildFeatureModel(code, toRootUri(root, file), tagFilter),
              stepPatterns: normalizeStepPatterns(steps),
            }),
            map: null,
          };
        }

        return null;
      },
    },
    {
      name: "lindorm-gherkin-lowering",
      // The LAST transform of the chain (`order: "post"`), so the code it
      // reads is what the engine would have executed — `root` and
      // `isStepModule` come from the sibling plugin's configResolved, one
      // factory call, one closure.
      transform: {
        order: "post",
        handler: (code: string, id: string): null => {
          const file = cleanId(id);

          if (isStepModule(file)) {
            assertStepModuleLowered({ code, uri: toRootUri(root, file) });
          }

          return null;
        },
      },
    },
  ];
};
