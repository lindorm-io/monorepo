import { createChildConfig } from "../child-config.js";
import { SETTINGS } from "./settings.js";

const config = createChildConfig(SETTINGS);

// vitest globs test.include, and matches test.exclude, relative to test.dir:
// `../drafts/*.feature` reaches drafts/draft.feature outside features/, so
// its exclusion must be written relative to features/ as well.
config.test = {
  ...config.test,
  dir: "features",
  include: ["*.feature", "../drafts/*.feature"],
};

export default config;
