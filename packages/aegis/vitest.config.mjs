import { createVitestConfig } from "../../vitest.config.base.mjs";

const config = createVitestConfig();
config.test.include = ["src/**/*.test.ts"];

export default config;
