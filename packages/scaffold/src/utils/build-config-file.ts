import { LINDORM_CONFIG_DEFAULTS } from "../constants/defaults.js";

export const LINDORM_CONFIG_FILENAME = "lindorm.config.ts";

export const buildConfigFile =
  (): string => `import { defineConfig } from "@lindorm/scaffold";

export default defineConfig({
  proteus: {
    sourceDir: "${LINDORM_CONFIG_DEFAULTS.proteus.sourceDir}",
    entitiesDir: "${LINDORM_CONFIG_DEFAULTS.proteus.entitiesDir}",
  },
  iris: {
    sourceDir: "${LINDORM_CONFIG_DEFAULTS.iris.sourceDir}",
    messagesDir: "${LINDORM_CONFIG_DEFAULTS.iris.messagesDir}",
  },
  pylon: {
    routesDir: "${LINDORM_CONFIG_DEFAULTS.pylon.routesDir}",
    handlersDir: "${LINDORM_CONFIG_DEFAULTS.pylon.handlersDir}",
    listenersDir: "${LINDORM_CONFIG_DEFAULTS.pylon.listenersDir}",
    workersDir: "${LINDORM_CONFIG_DEFAULTS.pylon.workersDir}",
    featureDir: "${LINDORM_CONFIG_DEFAULTS.pylon.featureDir}",
  },
});
`;
