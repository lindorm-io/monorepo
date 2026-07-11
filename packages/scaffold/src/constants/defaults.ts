// Sections use pylon's ROLE names (db / kv / bus), not library names —
// matching pylon's ctx/options convention. db + kv are both proteus sources;
// bus is the iris source.
export const LINDORM_CONFIG_DEFAULTS = {
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
} as const;
