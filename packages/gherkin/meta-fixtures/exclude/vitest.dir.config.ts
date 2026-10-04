import { createChildConfig } from "../child-config.js";
import { SETTINGS } from "./settings.js";

const config = createChildConfig(SETTINGS);

// vitest globs test.include, and matches test.exclude, relative to test.dir:
// `*.feature` names the feature files directly under features/, the excluded
// ones must be written relative to features/, and drafts/draft.feature,
// outside it, needs no entry.
config.test = {
  ...config.test,
  dir: "features",
  include: ["*.feature"],
};

export default config;
