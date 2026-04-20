import { createVitestConfig } from "../../vitest.config.base.mjs";

export default createVitestConfig({
  decorators: true,
  setupFiles: ["./vitest.setup.ts"],
});
