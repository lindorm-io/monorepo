import base from "../../jest.config.base.mjs";
import packageJson from "./package.json" with { type: "json" };

export default {
  ...base,
  displayName: `${packageJson.name} (integration)`,
  roots: ["<rootDir>/integration"],
  testMatch: ["**/*.integration.test.ts"],
  testTimeout: 300000,
  collectCoverage: false,
  coverageThreshold: undefined,
};
