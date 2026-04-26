import { createVitestConfig } from "../../vitest.config.base.mjs";

export default createVitestConfig({
  mode: "integration",
  decorators: true,
  setupFiles: ["./vitest.setup.ts"],
  serial: true,
});
