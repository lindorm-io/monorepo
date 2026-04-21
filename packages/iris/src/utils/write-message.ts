import { mkdir, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import { Logger } from "@lindorm/logger";
import { generateMessageSource, IRIS_MESSAGE_NAME_PATTERN } from "./generate-message.js";

export type WriteMessageOptions = {
  name: string;
  directory: string;
  dryRun?: boolean;
};

export const writeMessage = async (options: WriteMessageOptions): Promise<void> => {
  const { name, directory, dryRun } = options;

  if (!IRIS_MESSAGE_NAME_PATTERN.test(name)) {
    throw new Error(`Invalid message name: "${name}" — must be PascalCase`);
  }

  const resolvedDirectory = resolve(process.cwd(), directory);
  const filename = `${name}.ts`;
  const filepath = join(resolvedDirectory, filename);
  const content = generateMessageSource({ name });

  if (dryRun) {
    Logger.std.log(`\nDry run — would create:\n`);
    Logger.std.log(`  ${filepath}\n`);
    Logger.std.log(content);
    return;
  }

  await mkdir(dirname(filepath), { recursive: true });
  await writeFile(filepath, content, "utf-8");

  Logger.std.info(`Created message: ${filename}`);
  Logger.std.log(`  Location: ${filepath}`);
};
