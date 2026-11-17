import { createChildConfig } from "../child-config.js";
import { SETTINGS } from "./settings.js";

const config = createChildConfig(SETTINGS);

// No test.dir: vitest globs test.include, and matches test.exclude, relative
// to the root, which holds both features/ and drafts/.
config.test = {
  ...config.test,
  include: ["features/*.feature", "drafts/*.feature"],
};

export default config;
