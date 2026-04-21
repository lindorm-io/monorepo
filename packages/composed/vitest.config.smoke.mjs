import { createVitestConfig } from "../../vitest.config.base.mjs";

const config = createVitestConfig();
config.test.include = ["__smoke__/**/*.test.ts"];

export default config;
