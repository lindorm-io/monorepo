import { createVitestConfig } from "../../vitest.config.base.mjs";

// TCK bucket — the per-driver conformance suites, tagged with the dedicated
// *.tck.test.ts suffix. Each driver runs on its own docker-compose file via
// `test:tck:<driver>` (memory is in-process). The shared base has no "tck"
// mode, so borrow the serial integration wiring and override include/exclude
// to match only *.tck.test.ts.
const config = createVitestConfig({
  mode: "integration",
  decorators: true,
  setupFiles: ["./vitest.setup.ts"],
  serial: true,
});

config.test.include = ["src/**/*.tck.test.ts"];
config.test.exclude = ["**/dist/**", "**/node_modules/**"];

export default config;
