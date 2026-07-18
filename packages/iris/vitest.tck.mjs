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

// Conformance hooks stand up real brokers (durable consumers, streams, DLQ
// topology) — on a cold container that legitimately exceeds vitest's 10s hook
// default (e.g. nats JetStream setup when `test:tck:nats` starts against a
// freshly-booted broker). Give the whole TCK bucket generous docker headroom.
config.test.hookTimeout = 30_000;
config.test.testTimeout = 30_000;

export default config;
