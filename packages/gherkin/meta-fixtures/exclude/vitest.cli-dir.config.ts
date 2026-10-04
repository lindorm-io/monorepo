import { createChildConfig } from "../child-config.js";
import { SETTINGS } from "./settings.js";

const config = createChildConfig(SETTINGS);

// Run with `--dir features`: the directory reaches vitest from the command
// line alone, and `*.feature` names the feature files directly under it.
config.test = {
  ...config.test,
  include: ["*.feature"],
};

export default config;
