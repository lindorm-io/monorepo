import { createChildConfig } from "../child-config.js";
import { SETTINGS } from "./settings.js";

const config = createChildConfig(SETTINGS);

// vitest globs test.include, and matches test.exclude, relative to test.dir:
// `*.feature` names the feature files directly under features/, and the
// excluded ones are written relative to features/ — drafts/draft.feature,
// outside it, as ../drafts/draft.feature.
config.test = {
  ...config.test,
  dir: "features",
  include: ["*.feature"],
};

export default config;
