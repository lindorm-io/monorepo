import { createChildConfig } from "../child-config.js";

const config = createChildConfig({
  features: ["features/**/*.feature"],
  steps: ["steps/**/*.steps.ts"],
});

config.test = {
  ...config.test,
  include: ["features/**/*.feature", "checks/**/*.test.ts"],
  // User-declared tags the plugin's scan must MERGE with, never clobber or
  // re-declare: "operator" also appears in a feature file (the dedupe pin —
  // vitest rejects a duplicate test.tags name at startup), "operator-only"
  // is used by checks/operator.test.ts alone (the merge pin — clobbered,
  // that file's collection fails under strictTags).
  tags: [{ name: "operator" }, { name: "operator-only" }],
};

export default config;
