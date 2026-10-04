import { createChildConfig } from "../child-config.js";
import { SETTINGS } from "./settings.js";

const config = createChildConfig(SETTINGS);

config.test = {
  ...config.test,
  include: ["features/**/*.feature", "**/*.test.ts"],
};

export default config;
