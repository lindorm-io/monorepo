import type { FeatureModel } from "../model/types.js";

export type EmitFeatureModuleOptions = {
  model: FeatureModel;
  stepPatterns: Array<string>;
};

/**
 * The generated test-module source, spike-proven shape: import the runtime,
 * glob the step modules, top-level await the run so a rejection fails the
 * file loudly instead of surfacing as an unhandled-rejection side note.
 *
 * ⛔ Every embedded value goes through JSON.stringify, NEVER template
 * interpolation — model content is authored feature text, so a name holding
 * a backtick, `${` or `";` would otherwise be code injection into the test
 * module. JSON.stringify escapes `"`, `\` and control characters, and its
 * output is a valid JS literal (ES2019 "JSON superset": U+2028/U+2029 are
 * legal in string literals). Pinned: emit-feature-module.test.ts hostile
 * fixtures, parsed with vite's real parseAst.
 */
export const emitFeatureModule = ({
  model,
  stepPatterns,
}: EmitFeatureModuleOptions): string =>
  [
    `import { runFeature } from "@lindorm/gherkin/runtime";`,
    ``,
    `const stepModules = import.meta.glob(${JSON.stringify(stepPatterns)});`,
    `const model = ${JSON.stringify(model)};`,
    ``,
    `await runFeature({ model, stepModules });`,
    ``,
  ].join("\n");
