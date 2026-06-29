import type { Answers } from "./types.js";

/**
 * Build the project's `vitest.config.mjs`.
 *
 * When a proteus driver is selected, entities use stage-3 decorators
 * (`@Entity`/`@Field`). Vitest's default oxc transformer does not lower those
 * to the `__esDecorate` helpers, so any test importing an entity fails to run.
 * Wire `unplugin-swc` (with `oxc: false`) so decorators are transformed — the
 * same shape the lindorm-monorepo's own vitest base uses.
 */
export const buildVitestConfig = (answers: Answers): string => {
  const needsDecorators = answers.proteusDrivers.length > 0;

  if (!needsDecorators) {
    return [
      `import { defineConfig } from "vitest/config";`,
      ``,
      `export default defineConfig({`,
      `  test: {`,
      `    globals: false,`,
      `    environment: "node",`,
      `    include: ["src/**/*.test.ts"],`,
      `  },`,
      `});`,
      ``,
    ].join("\n");
  }

  return [
    `import swc from "unplugin-swc";`,
    `import { defineConfig } from "vitest/config";`,
    ``,
    `// proteus entities use stage-3 decorators (@Entity/@Field). Vitest's`,
    `// default oxc transformer does not lower them to __esDecorate helpers, so`,
    `// unplugin-swc handles the transform instead (oxc disabled to avoid a`,
    `// double transform).`,
    `export default defineConfig({`,
    `  plugins: [`,
    `    swc.vite({`,
    `      jsc: {`,
    `        parser: { syntax: "typescript", decorators: true },`,
    `        target: "es2022",`,
    `        transform: { decoratorVersion: "2022-03" },`,
    `        keepClassNames: true,`,
    `      },`,
    `    }),`,
    `  ],`,
    `  oxc: false,`,
    `  test: {`,
    `    globals: false,`,
    `    environment: "node",`,
    `    include: ["src/**/*.test.ts"],`,
    `  },`,
    `});`,
    ``,
  ].join("\n");
};
