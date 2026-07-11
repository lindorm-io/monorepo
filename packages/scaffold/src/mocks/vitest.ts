import type { LindormConfig } from "../types/lindorm-config.js";

export const createMockLindormConfig = (
  overrides: Partial<LindormConfig> = {},
): LindormConfig => ({
  db: { sourceDir: "./src/proteus/db", entitiesDir: "./src/proteus/db/entities" },
  kv: { sourceDir: "./src/proteus/kv", entitiesDir: "./src/proteus/kv/entities" },
  bus: { sourceDir: "./src/iris", messagesDir: "./src/iris/messages" },
  pylon: {
    routesDir: "./src/routes",
    handlersDir: "./src/handlers",
    listenersDir: "./src/listeners",
    workersDir: "./src/workers",
    featureDir: "./src/features",
  },
  ...overrides,
});
