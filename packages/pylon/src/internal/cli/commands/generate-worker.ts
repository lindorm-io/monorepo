import { kebabCase } from "@lindorm/case";
import { isCron } from "@lindorm/date";
import { isUndefined } from "@lindorm/is";
import { Logger } from "@lindorm/logger";
import {
  LINDORM_CONFIG_DEFAULTS,
  loadLindormConfig,
  resolveTarget,
} from "@lindorm/scaffold";
import { mkdir, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";

type GenerateWorkerOptions = {
  cron?: string;
  directory?: string;
  dryRun?: boolean;
};

// The scanner throws unless EXACTLY one of INTERVAL / CRON is exported
const workerTemplate = (cron: string | undefined): string =>
  [
    `import type { LindormWorkerCallback } from "@lindorm/worker";`,
    ``,
    `export const CALLBACK: LindormWorkerCallback = async (ctx) => {`,
    `  ctx.logger.verbose("Worker executed");`,
    `};`,
    ``,
    isUndefined(cron)
      ? `export const INTERVAL = "5m";`
      : `export const CRON = "${cron}";`,
    ``,
  ].join("\n");

export const generateWorker = async (
  name: string | undefined,
  options: GenerateWorkerOptions,
): Promise<void> => {
  if (!isUndefined(options.cron) && !isCron(options.cron)) {
    // isCron narrows the failing branch to never — the raw value is still wanted
    throw new Error(`Invalid cron expression: ${options.cron as string}`);
  }

  if (!name) {
    const { input } = await import("@inquirer/prompts");

    name = await input({
      message: "Worker name (e.g. HeartbeatWorker):",
      validate: (v) => (v.trim().length > 0 ? true : "Worker name required"),
    });
  }

  const config = await loadLindormConfig();
  const directory = resolve(
    process.cwd(),
    resolveTarget({
      arg: options.directory,
      config: config?.pylon?.workersDir,
      default: LINDORM_CONFIG_DEFAULTS.pylon.workersDir,
    }),
  );
  const filename = `${kebabCase(name)}.ts`;
  const filepath = join(directory, filename);
  const content = workerTemplate(options.cron);

  if (options.dryRun) {
    Logger.std.log(`\nDry run — would create:\n`);
    Logger.std.log(`  ${filepath}\n`);
    Logger.std.log(content);
    return;
  }

  await mkdir(dirname(filepath), { recursive: true });
  await writeFile(filepath, content, "utf-8");

  Logger.std.info(`Created worker: ${filename}`);
  Logger.std.log(`  Location: ${filepath}`);
};
