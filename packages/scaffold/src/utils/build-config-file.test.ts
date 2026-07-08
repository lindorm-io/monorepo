import { describe, expect, test } from "vitest";
import { LINDORM_CONFIG_DEFAULTS } from "../constants/defaults.js";
import { buildConfigFile, LINDORM_CONFIG_FILENAME } from "./build-config-file.js";

describe("buildConfigFile", () => {
  test("exposes the config filename", () => {
    expect(LINDORM_CONFIG_FILENAME).toBe("lindorm.config.ts");
  });

  test("imports defineConfig from @lindorm/scaffold", () => {
    const output = buildConfigFile();

    expect(output).toContain('import { defineConfig } from "@lindorm/scaffold";');
    expect(output).toContain("export default defineConfig(");
  });

  test("lists every default directory", () => {
    const output = buildConfigFile();

    expect(output).toContain(LINDORM_CONFIG_DEFAULTS.proteus.sourceDir);
    expect(output).toContain(LINDORM_CONFIG_DEFAULTS.proteus.entitiesDir);
    expect(output).toContain(LINDORM_CONFIG_DEFAULTS.iris.sourceDir);
    expect(output).toContain(LINDORM_CONFIG_DEFAULTS.iris.messagesDir);
    expect(output).toContain(LINDORM_CONFIG_DEFAULTS.pylon.routesDir);
    expect(output).toContain(LINDORM_CONFIG_DEFAULTS.pylon.handlersDir);
    expect(output).toContain(LINDORM_CONFIG_DEFAULTS.pylon.listenersDir);
    expect(output).toContain(LINDORM_CONFIG_DEFAULTS.pylon.workersDir);
    expect(output).toContain(LINDORM_CONFIG_DEFAULTS.pylon.featureDir);
  });

  test("matches snapshot", () => {
    expect(buildConfigFile()).toMatchSnapshot();
  });
});
