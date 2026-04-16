/**
 * Standalone jest config for repo scripts (codemods, audits).
 *
 * Deliberately does NOT extend jest.config.base.mjs: scripts run under plain
 * CJS ts-jest (no --experimental-vm-modules), without coverage thresholds,
 * and with a narrow roots list so nothing under packages/ is picked up.
 */
module.exports = {
  rootDir: __dirname,
  roots: ["<rootDir>"],
  testMatch: ["**/*.test.ts"],
  testEnvironment: "node",
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
          moduleResolution: "node",
          target: "ES2022",
          esModuleInterop: true,
          verbatimModuleSyntax: false,
          strict: true,
          skipLibCheck: true,
          types: ["node", "jest"],
        },
      },
    ],
  },
};
