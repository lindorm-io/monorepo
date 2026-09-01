import { createVitestConfig } from "../../vitest.config.base.mjs";

// decorators: the gherkin step classes use stage-3 decorators; kryptos source does not.
export default await createVitestConfig({
  decorators: true,
  gherkin: { features: ["src/**/*.feature"], steps: ["src/__fixtures__/**/*.steps.ts"] },
});
