import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createChildConfig } from "../child-config.js";
import { SETTINGS } from "./settings.js";

const config = createChildConfig(SETTINGS);

// Run from meta-fixtures/, this directory's parent, with this directory as
// the root: vitest resolves a relative test.dir against the working
// directory, never the root, so `exclude/features` names features/ here.
config.root = dirname(fileURLToPath(import.meta.url));
config.test = {
  ...config.test,
  dir: "exclude/features",
  include: ["**/*.feature"],
};

export default config;
