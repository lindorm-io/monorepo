import { createChildConfig } from "../child-config.js";
import { SETTINGS } from "./settings.js";

const config = createChildConfig(SETTINGS);

// vitest globs, and matches test.exclude, relative to test.dir: the excluded
// feature files must be written relative to features/, and
// drafts/draft.feature, outside it, needs no entry.
config.test = {
  ...config.test,
  dir: "features",
  include: ["**/*.feature"],
};

export default config;
