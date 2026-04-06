import { mkdir, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { Logger } from "@lindorm/logger";

type InitOptions = {
  directory?: string;
  dryRun?: boolean;
};

const sourceTemplate = (): string =>
  [
    `import { join } from "path";`,
    `import { Hermes } from "@lindorm/hermes";`,
    ``,
    `// import { source as proteus } from "../proteus/source";`,
    `// import { source as iris } from "../iris/source";`,
    ``,
    `export const hermes = new Hermes({`,
    `  // proteus,`,
    `  // iris,`,
    `  modules: [__dirname],`,
    `  logger: logger, // TODO: import or create a Logger instance`,
    `});`,
    ``,
  ].join("\n");

export const init = async (options: InitOptions): Promise<void> => {
  const directory = resolve(process.cwd(), options.directory ?? "./src/hermes");

  const files: Array<{ path: string; content: string }> = [
    { path: join(directory, "source.ts"), content: sourceTemplate() },
    { path: join(directory, "commands", ".gitkeep"), content: "" },
    { path: join(directory, "queries", ".gitkeep"), content: "" },
    { path: join(directory, "events", ".gitkeep"), content: "" },
    { path: join(directory, "timeouts", ".gitkeep"), content: "" },
    { path: join(directory, "aggregates", ".gitkeep"), content: "" },
    { path: join(directory, "sagas", ".gitkeep"), content: "" },
    { path: join(directory, "views", ".gitkeep"), content: "" },
  ];

  if (options.dryRun) {
    Logger.std.log("\nDry run — files that would be created:\n");

    for (const file of files) {
      Logger.std.log(`  ${file.path}`);

      if (file.content) {
        Logger.std.log("");
        Logger.std.log(file.content);
      }
    }

    return;
  }

  for (const file of files) {
    const dir = file.path.endsWith(".gitkeep")
      ? file.path.replace("/.gitkeep", "")
      : undefined;

    if (dir) {
      await mkdir(dir, { recursive: true });
    }

    await mkdir(join(file.path, ".."), { recursive: true });
    await writeFile(file.path, file.content, "utf-8");
  }

  Logger.std.info("Initialized Hermes project:");
  Logger.std.log(`  ${join(directory, "source.ts")}`);
  Logger.std.log(`  ${join(directory, "commands/")}`);
  Logger.std.log(`  ${join(directory, "queries/")}`);
  Logger.std.log(`  ${join(directory, "events/")}`);
  Logger.std.log(`  ${join(directory, "timeouts/")}`);
  Logger.std.log(`  ${join(directory, "aggregates/")}`);
  Logger.std.log(`  ${join(directory, "sagas/")}`);
  Logger.std.log(`  ${join(directory, "views/")}`);
};
