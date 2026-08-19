import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";
// In a consuming package: import { gherkinPlugin } from "@lindorm/gherkin/plugin";
import { gherkinPlugin } from "../src/plugin.js";

export default defineConfig({
  plugins: [
    // Before swc: .feature files are not TypeScript.
    gherkinPlugin({
      features: ["features/**/*.feature"],
      steps: ["steps/**/*.steps.ts"],
    }),
    // Stage-3 decorator lowering for @Binding/@Given/… classes.
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
    // In-repo only — the example's steps import ../src, so the emitted
    // module's "@lindorm/gherkin/runtime" import must resolve to the same
    // source tree (registrations are module state). A consuming package
    // deletes this block.
    alias: {
      "@lindorm/gherkin/runtime": resolve(
        dirname(fileURLToPath(import.meta.url)),
        "../src/runtime.ts",
      ),
    },
  },
  test: {
    dangerouslyIgnoreUnhandledErrors: false,
    environment: "node",
    include: ["features/**/*.feature"],
  },
});
