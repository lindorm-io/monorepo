import { kebabCase } from "@lindorm/case";
import { Logger } from "@lindorm/logger";
import { mkdir, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";

type GenerateWorkerOptions = {
  directory?: string;
  dryRun?: boolean;
};

const workerTemplate = (): string => {
  return [
    `import type { LindormWorkerCallback } from "@lindorm/worker";`,
    ``,
    `export const CALLBACK: LindormWorkerCallback = async (ctx) => {`,
    `  ctx.logger.info("Worker executed");`,
    `};`,
    ``,
    `export const INTERVAL = "5m";`,
    ``,
  ].join("\n");
};

export const generateWorker = async (
  name: string | undefined,
  options: GenerateWorkerOptions,
): Promise<void> => {
  if (!name) {
    const { input } = await import("@inquirer/prompts");

    name = await input({
      message: "Worker name (e.g. HeartbeatWorker):",
      validate: (v) => (v.trim().length > 0 ? true : "Worker name required"),
    });
  }

  const directory = resolve(process.cwd(), options.directory ?? "./src/workers");
  const filename = `${kebabCase(name)}.ts`;
  const filepath = join(directory, filename);
  const content = workerTemplate();

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
