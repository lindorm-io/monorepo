import { createChildConfig } from "../child-config.js";
import { SETTINGS } from "./settings.js";

// features/missing.feature is a literal path naming no feature file; a glob
// matching nothing, like features/**/*.none.feature, is no error.
const config = createChildConfig({
  ...SETTINGS,
  exclude: [
    ...SETTINGS.exclude,
    "features/missing.feature",
    "features/**/*.none.feature",
  ],
});

config.test = {
  ...config.test,
  include: ["features/**/*.feature", "**/*.test.ts"],
};

export default config;
