/* eslint-disable */
module.exports = {
  cacheDirectory: "../../.jest/cache",
  globalSetup: "../../jest.global.setup.js",
  projects: ["<rootDir>"],
  roots: ["<rootDir>/src"],
  setupFilesAfterEnv: ["jest-extended"],
  testEnvironment: "node",
  testMatch: ["**/*.integration.ts"],
  testPathIgnorePatterns: ["<rootDir>/packages/(?:.+?)/dist/"],
  transform: { "^.+\\.tsx?$": "ts-jest" },
};
