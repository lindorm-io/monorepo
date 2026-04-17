import { camelCase } from "@lindorm/case";
import { Logger } from "@lindorm/logger";
import { mkdir, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";

type GenerateHandlerOptions = {
  directory?: string;
  dryRun?: boolean;
};

const handlerTemplate = (name: string): string => {
  const camel = camelCase(name);

  return [
    `import { z } from "zod/v4";`,
    `import type { ServerHandler } from "../types/context";`,
    ``,
    `export const ${camel}Schema = z.object({`,
    `  // TODO: define schema`,
    `});`,
    ``,
    `export const ${camel}: ServerHandler<typeof ${camel}Schema> = async (ctx) => {`,
    `  return { body: {} };`,
    `};`,
    ``,
  ].join("\n");
};

export const generateHandler = async (
  name: string | undefined,
  options: GenerateHandlerOptions,
): Promise<void> => {
  if (!name) {
    const { input } = await import("@inquirer/prompts");

    name = await input({
      message: "Handler name (camelCase, e.g. getUser):",
      validate: (v) => (v.trim().length > 0 ? true : "Handler name required"),
    });
  }

  const directory = resolve(process.cwd(), options.directory ?? "./src/handlers");
  const camel = name.charAt(0).toLowerCase() + name.slice(1);
  const filename = `${camel}.ts`;
  const filepath = join(directory, filename);
  const content = handlerTemplate(name);

  if (options.dryRun) {
    Logger.std.log(`\nDry run — would create:\n`);
    Logger.std.log(`  ${filepath}\n`);
    Logger.std.log(content);
    return;
  }

  await mkdir(dirname(filepath), { recursive: true });
  await writeFile(filepath, content, "utf-8");

  Logger.std.info(`Created handler: ${filename}`);
  Logger.std.log(`  Location: ${filepath}`);
};
