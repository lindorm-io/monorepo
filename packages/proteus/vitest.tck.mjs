import { createVitestConfig } from "../../vitest.config.base.mjs";

// TCK-only config. The three-tier taxonomy falls out of the filename suffix:
// *.tck.test.ts are the per-driver conformance harnesses (unit = *.test.ts,
// integration = *.integration.test.ts, tck = *.tck.test.ts). This config
// includes ONLY the tck files, so a bare driver-name filter — e.g.
// `vitest run --config vitest.tck.mjs postgres` — selects exactly that driver's
// TCK files and nothing else (no relation-count / cache-adapter / driver
// integration noise).
const config = createVitestConfig({
  decorators: true,
  setupFiles: ["./vitest.setup.ts"],
});

config.test.include = ["**/*.tck.test.ts"];

export default config;
