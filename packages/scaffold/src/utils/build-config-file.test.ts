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

    expect(output).toContain(LINDORM_CONFIG_DEFAULTS.db.sourceDir);
    expect(output).toContain(LINDORM_CONFIG_DEFAULTS.db.entitiesDir);
    expect(output).toContain(LINDORM_CONFIG_DEFAULTS.kv.sourceDir);
    expect(output).toContain(LINDORM_CONFIG_DEFAULTS.kv.entitiesDir);
    expect(output).toContain(LINDORM_CONFIG_DEFAULTS.bus.sourceDir);
    expect(output).toContain(LINDORM_CONFIG_DEFAULTS.bus.messagesDir);
    expect(output).toContain(LINDORM_CONFIG_DEFAULTS.pylon.routesDir);
    expect(output).toContain(LINDORM_CONFIG_DEFAULTS.pylon.handlersDir);
    expect(output).toContain(LINDORM_CONFIG_DEFAULTS.pylon.listenersDir);
    expect(output).toContain(LINDORM_CONFIG_DEFAULTS.pylon.workersDir);
    expect(output).toContain(LINDORM_CONFIG_DEFAULTS.pylon.featureDir);
  });

  test("applies overrides over the defaults, section by section", () => {
    const output = buildConfigFile({
      db: {
        sourceDir: "./custom/db",
        entitiesDir: "./custom/db/entities",
      },
    });

    expect(output).toContain(`sourceDir: "./custom/db"`);
    expect(output).toContain(`entitiesDir: "./custom/db/entities"`);
    expect(output).not.toContain(LINDORM_CONFIG_DEFAULTS.db.sourceDir + `"`);
    expect(output).toContain(LINDORM_CONFIG_DEFAULTS.kv.sourceDir);
    expect(output).toContain(LINDORM_CONFIG_DEFAULTS.bus.sourceDir);
    expect(output).toContain(LINDORM_CONFIG_DEFAULTS.pylon.routesDir);
  });

  test("a partial override keeps the sibling default within the same section", () => {
    const output = buildConfigFile({
      bus: { messagesDir: "./custom/messages" },
    });

    expect(output).toContain(`sourceDir: "${LINDORM_CONFIG_DEFAULTS.bus.sourceDir}"`);
    expect(output).toContain(`messagesDir: "./custom/messages"`);
  });

  test("matches snapshot", () => {
    expect(buildConfigFile()).toMatchSnapshot();
  });

  test("matches snapshot with overrides", () => {
    expect(
      buildConfigFile({
        db: {
          sourceDir: "./custom/db",
          entitiesDir: "./custom/db/entities",
        },
      }),
    ).toMatchSnapshot();
  });
});
