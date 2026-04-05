import { mkdir, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import { Logger } from "@lindorm/logger";

type GenerateMessageOptions = {
  directory?: string;
  dryRun?: boolean;
};

const messageTemplate = (name: string): string =>
  [
    `import { Field, Message } from "@lindorm/iris";`,
    ``,
    `@Message()`,
    `export class ${name} {`,
    `  @Field("string")`,
    `  body!: string;`,
    `}`,
    ``,
  ].join("\n");

export const generateMessage = async (
  name: string | undefined,
  options: GenerateMessageOptions,
): Promise<void> => {
  if (!name) {
    const { input } = await import("@inquirer/prompts");

    name = await input({
      message: "Message name (PascalCase):",
      validate: (v) => (/^[A-Z][a-zA-Z0-9]*$/.test(v) ? true : "Must be PascalCase"),
    });
  }

  if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
    throw new Error(`Invalid message name: "${name}" — must be PascalCase`);
  }

  const directory = resolve(process.cwd(), options.directory ?? "./src/iris/messages");
  const filename = `${name}.ts`;
  const filepath = join(directory, filename);
  const content = messageTemplate(name);

  if (options.dryRun) {
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
