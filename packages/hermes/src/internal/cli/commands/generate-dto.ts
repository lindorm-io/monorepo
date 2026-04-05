import { mkdir, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import { Logger } from "@lindorm/logger";

type DtoKind = "command" | "query" | "event" | "timeout" | "aggregate" | "saga" | "view";

type GenerateDtoOptions = {
  directory?: string;
  dryRun?: boolean;
};

const DEFAULTS: Record<DtoKind, string> = {
  command: "./src/hermes/commands",
  query: "./src/hermes/queries",
  event: "./src/hermes/events",
  timeout: "./src/hermes/timeouts",
  aggregate: "./src/hermes/aggregates",
  saga: "./src/hermes/sagas",
  view: "./src/hermes/views",
};

const DECORATORS: Record<DtoKind, string> = {
  command: "Command",
  query: "Query",
  event: "Event",
  timeout: "Timeout",
  aggregate: "Aggregate",
  saga: "Saga",
  view: "View",
};

const dtoTemplate = (name: string, kind: DtoKind): string => {
  const decorator = DECORATORS[kind];

  return [
    `import { ${decorator} } from "@lindorm/hermes";`,
    ``,
    `@${decorator}()`,
    `export class ${name} {}`,
    ``,
  ].join("\n");
};

export const generateDto =
  (kind: DtoKind) =>
  async (name: string | undefined, options: GenerateDtoOptions): Promise<void> => {
    if (!name) {
      const { input } = await import("@inquirer/prompts");

      name = await input({
        message: `${DECORATORS[kind]} name (PascalCase):`,
        validate: (v) => (/^[A-Z][a-zA-Z0-9]*$/.test(v) ? true : "Must be PascalCase"),
      });
    }

    if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
      throw new Error(`Invalid ${kind} name: "${name}" — must be PascalCase`);
    }

    const directory = resolve(process.cwd(), options.directory ?? DEFAULTS[kind]);
    const filename = `${name}.ts`;
    const filepath = join(directory, filename);
    const content = dtoTemplate(name, kind);

    if (options.dryRun) {
      Logger.std.log(`\nDry run — would create:\n`);
      Logger.std.log(`  ${filepath}\n`);
      Logger.std.log(content);
      return;
    }

    await mkdir(dirname(filepath), { recursive: true });
    await writeFile(filepath, content, "utf-8");

    Logger.std.info(`Created ${kind}: ${filename}`);
    Logger.std.log(`  Location: ${filepath}`);
  };
