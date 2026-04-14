import base from "../../jest.config.base.mjs";
import packageJson from "./package.json" with { type: "json" };

export default {
  ...base,
  displayName: packageJson.name,
  // Force serial test execution. Running kafka TCK suites in parallel
  // causes KafkaJS consumer group rebalance races against worker shutdown.
  // Other iris drivers (memory, rabbit, redis, nats) funnel through Docker
  // containers anyway, so parallelism gains are marginal.
  maxWorkers: 1,
  setupFilesAfterEnv: ["jest-extended", "<rootDir>/jest.setup.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          target: "ES2022",
          lib: ["ESNext"],
          isolatedModules: true,
        },
      },
    ],
  },
};
