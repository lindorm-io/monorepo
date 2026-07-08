import type { LindormConfig } from "../types/lindorm-config.js";

export const createMockLindormConfig = (
  overrides: Partial<LindormConfig> = {},
): LindormConfig => ({
  proteus: { sourceDir: "./src/proteus", entitiesDir: "./src/proteus/entities" },
  iris: { sourceDir: "./src/iris", messagesDir: "./src/iris/messages" },
  pylon: {
    routesDir: "./src/routes",
    handlersDir: "./src/handlers",
    listenersDir: "./src/listeners",
    workersDir: "./src/workers",
    featureDir: "./src/features",
  },
  ...overrides,
});
