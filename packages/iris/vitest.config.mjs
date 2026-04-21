import { createVitestConfig } from "../../vitest.config.base.mjs";

const config = createVitestConfig({
  decorators: true,
  setupFiles: ["./vitest.setup.ts"],
});

// Force serial test execution. Running kafka TCK suites in parallel causes
// KafkaJS consumer group rebalance races against worker shutdown. Other iris
// drivers (memory, rabbit, redis, nats) funnel through Docker containers
// anyway, so parallelism gains are marginal.
config.test.fileParallelism = false;
config.test.pool = "forks";
config.test.poolOptions = { forks: { singleFork: true } };

export default config;
