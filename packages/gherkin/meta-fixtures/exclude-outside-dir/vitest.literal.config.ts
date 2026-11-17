import { createChildConfig } from "../child-config.js";
import { SETTINGS } from "./settings.js";

// A literal path to the draft outside test.dir: it names a feature file, so
// no exclude_unmatched.
const config = createChildConfig({
  ...SETTINGS,
  exclude: ["drafts/draft.feature"],
});

config.test = {
  ...config.test,
  dir: "features",
  include: ["*.feature", "../drafts/*.feature"],
};

export default config;
