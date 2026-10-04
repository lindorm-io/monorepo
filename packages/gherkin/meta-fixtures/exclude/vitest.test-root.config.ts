import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createChildConfig } from "../child-config.js";
import { SETTINGS } from "./settings.js";

const config = createChildConfig(SETTINGS);

// Run from meta-fixtures/, this directory's parent, with no `root`:
// test.root alone names this directory as the root vitest runs from.
config.test = {
  ...config.test,
  include: ["features/**/*.feature", "**/*.test.ts"],
  root: dirname(fileURLToPath(import.meta.url)),
};

export default config;
