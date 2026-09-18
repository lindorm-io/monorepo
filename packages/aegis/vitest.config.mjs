import { createVitestConfig } from "../../vitest.config.base.mjs";

// decorators: the gherkin step classes use stage-3 decorators; aegis source does not.
export default await createVitestConfig({
  decorators: true,
  gherkin: {},
});
