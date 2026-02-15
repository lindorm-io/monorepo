export default {
  cacheDirectory: "../../.jest/cache",
  collectCoverageFrom: [
    "**/*.test.{ts,tsx}",
    "!**/coverage/**/*",
    "!**/dist/**/*",
    "!**/node_modules/**/*",
  ],
  coverageDirectory: "../../.jest/coverage",
  coverageReporters: ["lcov"],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  globalSetup: "../../jest.global.setup.mjs",
  projects: ["<rootDir>"],
  roots: ["<rootDir>/src"],
  setupFilesAfterEnv: ["jest-extended"],
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  testPathIgnorePatterns: ["<rootDir>/packages/(?:.+?)/dist/"],
  transform: { "^.+\\.tsx?$": "ts-jest" },
};
