import { createVitestConfig } from "../../vitest.config.base.mjs";

// Unit bucket — everything that is neither integration nor TCK. The shared
// base already drops *.integration.test.ts; the three-tier taxonomy adds the
// dedicated *.tck.test.ts suffix, so exclude that here as well.
const config = createVitestConfig({
  mode: "unit",
  decorators: true,
  setupFiles: ["./vitest.setup.ts"],
});

config.test.exclude = [...config.test.exclude, "**/*.tck.test.ts"];

export default config;
