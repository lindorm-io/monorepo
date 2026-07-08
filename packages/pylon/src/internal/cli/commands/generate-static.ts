import {
  LINDORM_CONFIG_DEFAULTS,
  loadLindormConfig,
  resolveTarget,
} from "@lindorm/scaffold";
import { Logger } from "@lindorm/logger";
import { mkdir, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import { resolveRouteFile } from "./resolve-route-file.js";

type GenerateStaticOptions = {
  directory?: string;
  dryRun?: boolean;
};

const staticTemplate = (): string => {
  return [
    `import { useStatic } from "@lindorm/pylon";`,
    `import { join } from "path";`,
    ``,
    `const root = join(__dirname, "..", "static-assets");`,
    ``,
    `export const STATIC = useStatic({ root, maxAge: "7d" });`,
    ``,
  ].join("\n");
};

export const generateStatic = async (
  path: string | undefined,
  options: GenerateStaticOptions,
): Promise<void> => {
  if (!path) {
    const { input } = await import("@inquirer/prompts");

    path = await input({
      message: "URL path (e.g. /assets):",
      validate: (v) => (v.startsWith("/") ? true : "Must start with /"),
    });
  }

  const config = await loadLindormConfig();
  const directory = resolve(
    process.cwd(),
    resolveTarget({
      arg: options.directory,
      config: config?.pylon?.routesDir,
      default: LINDORM_CONFIG_DEFAULTS.pylon.routesDir,
    }),
  );
  const { filepath } = resolveRouteFile(path, directory);
  const content = staticTemplate();

  if (options.dryRun) {
    Logger.std.log(`\nDry run — would create:\n`);
    Logger.std.log(`  ${filepath}\n`);
    Logger.std.log(content);
    return;
  }

  await mkdir(dirname(filepath), { recursive: true });
  await writeFile(filepath, content, "utf-8");

  Logger.std.info(`Created static route: ${filepath}`);
  Logger.std.log(`  URL: ${path}`);
};
