import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { ScaffoldError } from "../errors/ScaffoldError.js";
import { loadLindormConfig } from "./load-lindorm-config.js";

const TS_CONFIG = `export default { proteus: { sourceDir: "./from-ts" } };\n`;
const MJS_CONFIG = `export default { proteus: { sourceDir: "./from-mjs" } };\n`;
const NAMED_CONFIG = `export const config = { iris: { sourceDir: "./from-named" } };\n`;
const NON_OBJECT_CONFIG = `export default 42;\n`;

describe("loadLindormConfig", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "lindorm-scaffold-"));
  });

  afterEach(() => {
    rmSync(cwd, { force: true, recursive: true });
  });

  test("prefers lindorm.config.ts when both .ts and .mjs exist", async () => {
    writeFileSync(join(cwd, "lindorm.config.ts"), TS_CONFIG);
    writeFileSync(join(cwd, "lindorm.config.mjs"), MJS_CONFIG);

    const config = await loadLindormConfig({ cwd });

    expect(config).toEqual({ proteus: { sourceDir: "./from-ts" } });
  });

  test("uses lindorm.config.mjs when only it exists", async () => {
    writeFileSync(join(cwd, "lindorm.config.mjs"), MJS_CONFIG);

    const config = await loadLindormConfig({ cwd });

    expect(config).toEqual({ proteus: { sourceDir: "./from-mjs" } });
  });

  test("loads an explicit relative path", async () => {
    writeFileSync(join(cwd, "custom.config.mjs"), MJS_CONFIG);

    const config = await loadLindormConfig({ cwd, path: "custom.config.mjs" });

    expect(config).toEqual({ proteus: { sourceDir: "./from-mjs" } });
  });

  test("loads an explicit absolute path", async () => {
    const path = join(cwd, "custom.config.mjs");
    writeFileSync(path, MJS_CONFIG);

    const config = await loadLindormConfig({ cwd, path });

    expect(config).toEqual({ proteus: { sourceDir: "./from-mjs" } });
  });

  test("accepts a named `config` export when no default is present", async () => {
    writeFileSync(join(cwd, "lindorm.config.mjs"), NAMED_CONFIG);

    const config = await loadLindormConfig({ cwd });

    expect(config).toEqual({ iris: { sourceDir: "./from-named" } });
  });

  test("throws config_file_not_found for a missing explicit path", async () => {
    await expect(
      loadLindormConfig({ cwd, path: "does-not-exist.mjs" }),
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ScaffoldError && error.code === "config_file_not_found",
    );
  });

  test("returns null when neither config file exists", async () => {
    expect(await loadLindormConfig({ cwd })).toBeNull();
  });

  test("throws invalid_config_export when the export is not an object", async () => {
    writeFileSync(join(cwd, "lindorm.config.mjs"), NON_OBJECT_CONFIG);

    await expect(loadLindormConfig({ cwd })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ScaffoldError && error.code === "invalid_config_export",
    );
  });
});
