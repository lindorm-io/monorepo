import { createVitestConfig } from "../../vitest.config.base.mjs";

// decorators: the gherkin step classes use stage-3 decorators; aes source does not.
const config = await createVitestConfig({
  decorators: true,
  gherkin: {},
});
config.test.include = [...config.test.include, "__tests__/**/*.test.ts"];

export default config;
