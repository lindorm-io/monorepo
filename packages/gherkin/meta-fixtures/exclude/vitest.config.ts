import { createChildConfig } from "../child-config.js";
import { SETTINGS } from "./settings.js";

const config = createChildConfig(SETTINGS);

// No test.exclude: the plugin's patch must carry vitest's default excludes,
// or the node_modules sentinel src/e2e/meta-exclude.test.ts plants is
// collected.
config.test = {
  ...config.test,
  include: ["features/**/*.feature", "**/*.test.ts"],
};

export default config;
