import { isObject } from "@lindorm/is";
import { Scanner } from "@lindorm/scanner";
import { existsSync } from "fs";
import { isAbsolute, resolve } from "path";
import { ScaffoldError } from "../errors/ScaffoldError.js";
import type { LindormConfig } from "../types/lindorm-config.js";

type LoadLindormConfigOptions = {
  cwd?: string;
  path?: string;
};

// Ordered by preference: a native TypeScript config wins over the .mjs escape
// hatch when both are present in the same directory.
const CONFIG_FILENAMES = ["lindorm.config.ts", "lindorm.config.mjs"];

const resolveConfigPath = (cwd: string, path?: string): string | null => {
  if (path !== undefined) {
    const resolved = isAbsolute(path) ? path : resolve(cwd, path);

    if (!existsSync(resolved)) {
      throw new ScaffoldError("Lindorm config file not found", {
        code: "config_file_not_found",
        title: "Config file not found",
        details: `No file exists at the explicit config path "${resolved}".`,
        debug: { cwd, path, resolved },
      });
    }

    return resolved;
  }

  for (const filename of CONFIG_FILENAMES) {
    const candidate = resolve(cwd, filename);

    if (existsSync(candidate)) return candidate;
  }

  return null;
};

export const loadLindormConfig = async (
  options: LoadLindormConfigOptions = {},
): Promise<LindormConfig | null> => {
  const cwd = options.cwd ?? process.cwd();

  const resolvedPath = resolveConfigPath(cwd, options.path);

  if (resolvedPath === null) return null;

  const mod = await new Scanner().import<Record<string, unknown>>(resolvedPath);

  const config = mod.default ?? mod.config;

  if (!isObject(config)) {
    throw new ScaffoldError("Lindorm config export is not an object", {
      code: "invalid_config_export",
      title: "Invalid config export",
      details: `Expected a default or "config" object export from "${resolvedPath}", found exports: [${Object.keys(mod).join(", ")}].`,
      debug: { path: resolvedPath, exports: Object.keys(mod) },
    });
  }

  return config as LindormConfig;
};
