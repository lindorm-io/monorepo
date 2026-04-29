import { createVitestConfig } from "../../vitest.config.base.mjs";

export default createVitestConfig({
  mode: "unit",
  decorators: true,
  setupFiles: ["./vitest.setup.ts"],
});
