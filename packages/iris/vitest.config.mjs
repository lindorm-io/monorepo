import { createVitestConfig } from "../../vitest.config.base.mjs";

// Default config — unit + integration (matches `npm test` behavior at root).
// Weekly is opt-in via vitest.weekly.mjs / `npm run test:weekly`.
//
// `serial: true` — integration files share single docker containers across
// the suite, so parallel file runs would saturate connections and race on
// shared broker state. Unit-only runs use vitest.unit.mjs (parallel).
export default createVitestConfig({
  decorators: true,
  setupFiles: ["./vitest.setup.ts"],
  serial: true,
});
