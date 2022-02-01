/* eslint-disable */
module.exports = {
  cacheDirectory: "../../.jest-cache",
  collectCoverageFrom: [
    "**/*.test.{ts,tsx}",
    // Non-library folders/files
    "!**/node_modules/**",
    "!**/coverage/**",
    "!**/dist/**",
    "!jest.config.base.js",
    "!jest.config.integration.base.js",
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
  testMatch: ["**/*.test.ts"],
  testPathIgnorePatterns: ["<rootDir>/packages/(?:.+?)/dist/"],
  transform: { "^.+\\.tsx?$": "ts-jest" },
};
