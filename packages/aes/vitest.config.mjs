import { createVitestConfig } from "../../vitest.config.base.mjs";

const config = createVitestConfig();
config.test.include = ["src/**/*.test.ts", "__tests__/**/*.test.ts"];

export default config;
