import { createChildConfig } from "../child-config.js";
import { SETTINGS } from "./settings.js";

const config = createChildConfig(SETTINGS);

// Run with `--dir features`: the directory reaches vitest from the command
// line alone, and `../drafts/*.feature` reaches the draft outside it.
config.test = {
  ...config.test,
  include: ["*.feature", "../drafts/*.feature"],
};

export default config;
