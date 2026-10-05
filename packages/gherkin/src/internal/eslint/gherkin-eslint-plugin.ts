import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ESLint, Linter, Rule } from "eslint";
import { noUnreachedStep } from "./no-unreached-step.js";

export type GherkinEslintPlugin = {
  configs: { recommended: Linter.Config };
  meta: { name: string; version: string };
  rules: { "no-unreached-step": Rule.RuleModule };
};

const { version }: { version: string } = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "..", "..", "..", "package.json"), "utf8"),
);

const recommended: Linter.Config = {
  rules: { "gherkin/no-unreached-step": "error" },
};

export const gherkinEslintPlugin: GherkinEslintPlugin = {
  configs: { recommended },
  meta: { name: "@lindorm/gherkin", version },
  rules: { "no-unreached-step": noUnreachedStep },
} satisfies ESLint.Plugin;

// The plugin object itself, never a copy: ESLint refuses one namespace bound to two
// objects, so a consumer's `plugins: { gherkin }` beside this config must be this object.
// pinned: eslint.test.ts
recommended.plugins = { gherkin: gherkinEslintPlugin };
