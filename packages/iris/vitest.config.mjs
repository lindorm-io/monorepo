import { createVitestConfig } from "../../vitest.config.base.mjs";

// Default config — unit + integration + the fast TCK suites (memory / redis /
// rabbit / nats), matching `npm test` with every service up. Kafka's TCK is
// deliberately excluded here (too slow for the everyday run); it runs on its
// own via `test:tck:kafka`, scheduled weekly in CI.
//
// `serial: true` — integration/TCK files share single docker containers across
// the suite, so parallel file runs would saturate connections and race on
// shared broker state. Unit-only runs use vitest.unit.mjs (parallel).
const config = createVitestConfig({
  decorators: true,
  setupFiles: ["./vitest.setup.ts"],
  serial: true,
});

config.test.exclude = [...config.test.exclude, "**/kafka-*.tck.test.ts"];

export default config;
