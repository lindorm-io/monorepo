import { mkdir, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import { Logger } from "@lindorm/logger";

type GenerateEntityOptions = {
  directory?: string;
  dryRun?: boolean;
};

const entityTemplate = (name: string): string =>
  [
    `import { Entity, Field, PrimaryKey } from "@lindorm/proteus";`,
    ``,
    `@Entity()`,
    `export class ${name} {`,
    `  @PrimaryKey()`,
    `  @Field("uuid")`,
    `  id!: string;`,
    ``,
    `  @Field("date")`,
    `  createdAt!: Date;`,
    ``,
    `  @Field("date")`,
    `  updatedAt!: Date;`,
    `}`,
    ``,
  ].join("\n");

export const generateEntity = async (
  name: string | undefined,
  options: GenerateEntityOptions,
): Promise<void> => {
  if (!name) {
    const { input } = await import("@inquirer/prompts");

    name = await input({
      message: "Entity name (PascalCase):",
      validate: (v) => (/^[A-Z][a-zA-Z0-9]*$/.test(v) ? true : "Must be PascalCase"),
    });
  }

  if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
    throw new Error(`Invalid entity name: "${name}" — must be PascalCase`);
  }

  const directory = resolve(process.cwd(), options.directory ?? "./src/proteus/entities");
  const filename = `${name}.ts`;
  const filepath = join(directory, filename);
  const content = entityTemplate(name);

  if (options.dryRun) {
    Logger.std.log(`\nDry run — would create:\n`);
    Logger.std.log(`  ${filepath}\n`);
    Logger.std.log(content);
    return;
  }

  await mkdir(dirname(filepath), { recursive: true });
  await writeFile(filepath, content, "utf-8");

  Logger.std.info(`Created entity: ${filename}`);
  Logger.std.log(`  Location: ${filepath}`);
};
