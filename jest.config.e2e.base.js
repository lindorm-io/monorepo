/* eslint-disable */
module.exports = {
  cacheDirectory: "../../.jest-cache",
  collectCoverageFrom: [
    "**/*.e2e.{ts,tsx}",
    // Non-library folders/files
    "!**/node_modules/**",
    "!**/coverage/**",
    "!**/dist/**",
    "!**/tmp/**",
    "!jest.config.e2e.js",
    "!jest.config.integration.js",
    "!jest.config.js",
  ],
  coverageDirectory: "../../.jest-coverage",
  coverageReporters: ["lcov"],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  globalSetup: "../../jest.global.setup.js",
  projects: ["<rootDir>"],
  roots: ["<rootDir>/src"],
  setupFilesAfterEnv: ["jest-extended"],
  testEnvironment: "node",
  testMatch: ["**/*.e2e.ts"],
  testPathIgnorePatterns: ["<rootDir>/packages/(?:.+?)/dist/"],
  transform: { "^.+\\.tsx?$": "ts-jest" },
};
