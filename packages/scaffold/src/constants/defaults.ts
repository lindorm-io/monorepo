export const LINDORM_CONFIG_DEFAULTS = {
  proteus: { sourceDir: "./src/proteus", entitiesDir: "./src/proteus/entities" },
  iris: { sourceDir: "./src/iris", messagesDir: "./src/iris/messages" },
  pylon: {
    routesDir: "./src/routes",
    handlersDir: "./src/handlers",
    listenersDir: "./src/listeners",
    workersDir: "./src/workers",
    featureDir: "./src/features",
  },
} as const;
