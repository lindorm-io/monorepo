export default {
  cacheDirectory: "../../.jest/cache",
  globalSetup: "../../jest.global.setup.mjs",
  projects: ["<rootDir>"],
  roots: ["<rootDir>/src"],
  setupFilesAfterEnv: ["jest-extended"],
  testEnvironment: "node",
  testMatch: ["**/*.integration.ts"],
  testPathIgnorePatterns: ["<rootDir>/packages/(?:.+?)/dist/"],
  transform: { "^.+\\.tsx?$": "ts-jest" },
};
