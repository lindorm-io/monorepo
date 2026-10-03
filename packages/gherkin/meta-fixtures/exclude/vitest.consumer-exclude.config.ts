import { createChildConfig } from "../child-config.js";
import { SETTINGS } from "./settings.js";

const config = createChildConfig(SETTINGS);

// The consumer's own test.exclude: vite appends the plugin's excluded
// feature files to it, so drafts/draft.test.ts stays out by this entry.
config.test = {
  ...config.test,
  exclude: ["**/node_modules/**", "drafts/**/*.test.ts"],
  include: ["features/**/*.feature", "**/*.test.ts"],
};

export default config;
