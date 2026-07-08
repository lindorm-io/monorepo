import { Logger } from "@lindorm/logger";
import { buildConfigFile, LINDORM_CONFIG_FILENAME } from "@lindorm/scaffold";
import { access, writeFile } from "fs/promises";
import { resolve } from "path";

type ConfigInitOptions = {
  dryRun?: boolean;
  force?: boolean;
};

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

export const configInit = async (options: ConfigInitOptions): Promise<void> => {
  const target = resolve(process.cwd(), LINDORM_CONFIG_FILENAME);
  const content = buildConfigFile();

  if (!options.force && (await exists(target))) {
    Logger.std.warn(
      `${LINDORM_CONFIG_FILENAME} already exists (use --force to overwrite)`,
    );
    Logger.std.log(`  Location: ${target}`);
    return;
  }

  if (options.dryRun) {
    Logger.std.log(`\nDry run — would create:\n`);
    Logger.std.log(`  ${target}\n`);
    Logger.std.log(content);
    return;
  }

  await writeFile(target, content, "utf-8");

  Logger.std.info(`Created ${LINDORM_CONFIG_FILENAME}`);
  Logger.std.log(`  Location: ${target}`);
};
