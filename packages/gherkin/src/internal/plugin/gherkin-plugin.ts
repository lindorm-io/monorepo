import { relative, resolve } from "node:path";
import type { Plugin } from "vite";
import { createFilter, normalizePath } from "vite";
import { GherkinError } from "../../errors/GherkinError.js";
import type { GherkinSettings } from "../../types/gherkin-settings.js";
import { buildFeatureModel } from "../model/build-feature-model.js";
import { assertFeaturesCollected } from "./assert-features-collected.js";
import { assertFeaturesCovered } from "./assert-features-covered.js";
import { assertStepModuleLowered } from "./assert-step-module-lowered.js";
import { cleanId } from "./clean-id.js";
import { emitFeatureModule } from "./emit-feature-module.js";
import { escapeGlob } from "./glob-syntax.js";
import { normalizeStepPatterns } from "./normalize-step-patterns.js";
import type { ExcludedFeatures } from "./resolve-excluded-features.js";
import { resolveExcludedFeatures } from "./resolve-excluded-features.js";
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
  test?: {
    root?: string;
    tags?: Array<GherkinTagDeclaration>;
  };
};

/**
 * What the config hook returns — vite merges it into the user config: an
 * array is appended to the one the user config sets, and stands alone where
 * it sets none.
 */
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
  configResolved: (config: {
    root: string;
    test?: { dir?: string; include?: Array<string> };
  }) => void;
  configureVitest: (context: {
    project: { config: { dir?: string; exclude: Array<string> } };
  }) => void;
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
  const { exclude, features, steps, tagFilter } = resolveSettings(settings);

  // Vite calls configResolved before buildStart/transform; process.cwd() is
  // vite's own default root, kept only so the hooks are callable standalone.
  let root = process.cwd();
  // vitest's resolved config carries test.include only when the consumer set
  // one; absent means vitest applies its own default test globs
  // (assert-features-collected.ts substitutes configDefaults).
  let include: Array<string> | undefined;
  let vitestDir: string | undefined;
  // vitest globs test.include under, and matches test.exclude relative to,
  // `dir || root` — a relative dir resolved against the working directory,
  // never the root (pinned: the relative test.dir child in
  // src/e2e/meta-exclude.test.ts).
  const resolveMatchDirectory = (): string => resolve(vitestDir || root);
  // Rebuilt from the resolved root below — createFilter anchors a relative
  // pattern at the root it was handed, so the cwd default would mis-anchor
  // every step pattern under a configured root.
  let isStepModule = createFilter(steps, [], { resolve: root });
  // Resolved ONCE, by the config hook, which vite runs before every other
  // hook: the tag scan, the test.exclude write and buildStart's guards all
  // read this one set, so what vitest never collects and what no guard
  // reports cannot disagree.
  let excluded: ExcludedFeatures = { files: [], unmatchedLiterals: [] };
  const isIncluded = (file: string): boolean => excluded.files.includes(file) === false;

  return [
    {
      name: "lindorm-gherkin",
      // MUST precede unplugin-swc (spike-verified): swc would otherwise see
      // the raw .feature text and fail to parse it as TypeScript.
      enforce: "pre",

      // Runs at config resolution, before any collection: the emitted tests
      // carry vitest tags, and vitest's strictTags (default true, kept) fails
      // collection on any UNDECLARED tag — so the union of every feature
      // file's tags is injected into `test.tags` here, or a file carrying one
      // missed tag fails collection and none of its scenarios run. The
      // `exclude` setting is resolved to feature files here too.
      // ⚠ Computed ONCE at config time: a tag newly added to a .feature
      // mid-watch is undeclared until vitest restarts — strictTags then fails
      // collection LOUDLY (that is strictTags working, never a silent skip) —
      // and a feature file created mid-watch is never excluded.
      // Documented in README.md#tags and README.md#excluding-feature-files.
      config: async (config: GherkinUserConfig): Promise<GherkinConfigPatch> => {
        // The hook runs before configResolved, so the root is derived the way
        // vitest derives it: test.root, else vite's root, else the cwd.
        const configRoot = resolve(config.test?.root || config.root || ".");
        const files = await walkFeatureFiles(configRoot);

        excluded = resolveExcludedFeatures({ exclude, files, root: configRoot });

        const tags = await scanTagDeclarations({
          declared: (config.test?.tags ?? []).map((tag) => tag.name),
          features,
          files: files.filter(isIncluded),
          root: configRoot,
        });

        return { test: { tags } };
      },

      configResolved: (config: {
        root: string;
        test?: { dir?: string; include?: Array<string> };
      }): void => {
        root = config.root;
        include = config.test?.include;
        // vitest 5 runs buildStart before configureVitest, so the guard's dir
        // is read here, where vitest 5 has already merged a CLI --dir into
        // `test` (pinned: the test.dir and --dir children in
        // src/e2e/meta-exclude.test.ts).
        vitestDir = config.test?.dir;
        isStepModule = createFilter(steps, [], { resolve: root });
      },

      // Reads the project config vitest resolved, a CLI `--dir` included, and
      // vitest runs it before it globs test files, so the excluded feature
      // files join test.exclude here.
      configureVitest: ({
        project,
      }: {
        project: { config: { dir?: string; exclude: Array<string> } };
      }): void => {
        vitestDir = project.config.dir;

        const matchDirectory = resolveMatchDirectory();
        const isUnderMatchDirectory = (path: string): boolean =>
          path.startsWith("../") === false;
        const entries = excluded.files
          .map((file) => normalizePath(relative(matchDirectory, file)))
          .filter(isUnderMatchDirectory)
          .map(escapeGlob);

        // A new array, never a push: with no consumer test.exclude, the
        // resolved one IS vitest's module-level default list.
        project.config.exclude = [...project.config.exclude, ...entries];
      },

      // ONE walk feeds both guards — the same file set, minus the excluded
      // files, and `features` anchored at the same root, so "covered" and
      // "collected" cannot disagree on what a feature file is. buildStart
      // follows configResolved (root, include and dir) and fires at server
      // init, under vitest 5 before configureVitest, and before test file
      // globbing — pinned by the overwrite child in
      // src/e2e/base-config-wiring.test.ts, which dies here although its
      // include collects no feature at all. The dir reading is pinned for a
      // config without test.projects (#248).
      buildStart: async (): Promise<void> => {
        if (excluded.unmatchedLiterals.length > 0) {
          throw new GherkinError(
            [
              "Literal `exclude` path(s) matching no feature file — a mistyped path excludes nothing:",
              ...excluded.unmatchedLiterals.map((path) => `  ${path}`),
            ].join("\n"),
            {
              code: "exclude_unmatched",
              details:
                "An `exclude` entry without a glob character is a literal path to one feature file. One that names no feature file is a typo or a stale entry, and whatever it was meant to keep out of the suite still runs. Fix or remove the path; a glob that matches nothing is not an error.",
              data: { unmatched: excluded.unmatchedLiterals },
            },
          );
        }

        const files = (await walkFeatureFiles(root)).filter(isIncluded);
        assertFeaturesCovered({ features, files, root });
        assertFeaturesCollected({
          features,
          files,
          include,
          matchDirectory: resolveMatchDirectory(),
          root,
        });
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
