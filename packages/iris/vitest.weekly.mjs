import { createVitestConfig } from "../../vitest.config.base.mjs";

export default createVitestConfig({
  mode: "weekly",
  decorators: true,
  setupFiles: ["./vitest.setup.ts"],
  serial: true,
});
