import { LINDORM_CONFIG_DEFAULTS } from "../constants/defaults.js";
import type { LindormConfig } from "../types/lindorm-config.js";

export const LINDORM_CONFIG_FILENAME = "lindorm.config.ts";

export const buildConfigFile = (overrides: LindormConfig = {}): string => {
  const db = {
    sourceDir: overrides.db?.sourceDir ?? LINDORM_CONFIG_DEFAULTS.db.sourceDir,
    entitiesDir: overrides.db?.entitiesDir ?? LINDORM_CONFIG_DEFAULTS.db.entitiesDir,
  };
  const kv = {
    sourceDir: overrides.kv?.sourceDir ?? LINDORM_CONFIG_DEFAULTS.kv.sourceDir,
    entitiesDir: overrides.kv?.entitiesDir ?? LINDORM_CONFIG_DEFAULTS.kv.entitiesDir,
  };
  const bus = {
    sourceDir: overrides.bus?.sourceDir ?? LINDORM_CONFIG_DEFAULTS.bus.sourceDir,
    messagesDir: overrides.bus?.messagesDir ?? LINDORM_CONFIG_DEFAULTS.bus.messagesDir,
  };
  const pylon = {
    routesDir: overrides.pylon?.routesDir ?? LINDORM_CONFIG_DEFAULTS.pylon.routesDir,
    handlersDir:
      overrides.pylon?.handlersDir ?? LINDORM_CONFIG_DEFAULTS.pylon.handlersDir,
    listenersDir:
      overrides.pylon?.listenersDir ?? LINDORM_CONFIG_DEFAULTS.pylon.listenersDir,
    workersDir: overrides.pylon?.workersDir ?? LINDORM_CONFIG_DEFAULTS.pylon.workersDir,
    featureDir: overrides.pylon?.featureDir ?? LINDORM_CONFIG_DEFAULTS.pylon.featureDir,
  };

  return `import { defineConfig } from "@lindorm/scaffold";

export default defineConfig({
  db: {
    sourceDir: "${db.sourceDir}",
    entitiesDir: "${db.entitiesDir}",
  },
  kv: {
    sourceDir: "${kv.sourceDir}",
    entitiesDir: "${kv.entitiesDir}",
  },
  bus: {
    sourceDir: "${bus.sourceDir}",
    messagesDir: "${bus.messagesDir}",
  },
  pylon: {
    routesDir: "${pylon.routesDir}",
    handlersDir: "${pylon.handlersDir}",
    listenersDir: "${pylon.listenersDir}",
    workersDir: "${pylon.workersDir}",
    featureDir: "${pylon.featureDir}",
  },
});
`;
};
