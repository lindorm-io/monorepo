import { mkdir, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { Logger } from "@lindorm/logger";

const SQL_DRIVERS = ["postgres", "mysql", "sqlite"];
const ALL_DRIVERS = ["postgres", "mysql", "sqlite", "redis", "mongo", "memory"];

type InitOptions = {
  driver?: string;
  directory?: string;
  dryRun?: boolean;
};

const sourceTemplate = (driver: string, isSql: boolean): string => {
  const lines = [
    `import { join } from "path";`,
    `import { ProteusSource } from "@lindorm/proteus";`,
    ``,
    `export const source = new ProteusSource({`,
    `  driver: "${driver}",`,
    `  logger: logger.child(["proteus"]), // TODO: import or create a Logger instance`,
    `  entities: [join(__dirname, "entities")],`,
  ];

  if (isSql) {
    lines.push(`  migrations: [join(__dirname, "migrations")],`);
  }

  switch (driver) {
    case "postgres":
      lines.push(`  host: "localhost",`);
      lines.push(`  port: 5432,`);
      lines.push(`  database: "app",`);
      break;
    case "mysql":
      lines.push(`  host: "localhost",`);
      lines.push(`  port: 3306,`);
      lines.push(`  database: "app",`);
      break;
    case "sqlite":
      lines.push(`  filename: "./data/app.db",`);
      break;
    case "redis":
      lines.push(`  host: "localhost",`);
      lines.push(`  port: 6379,`);
      break;
    case "mongo":
      lines.push(`  host: "localhost",`);
      lines.push(`  port: 27017,`);
      lines.push(`  database: "app",`);
      break;
    case "memory":
      break;
  }

  lines.push(`});`);
  lines.push(``);

  return lines.join("\n");
};

export const init = async (options: InitOptions): Promise<void> => {
  let driver = options.driver;

  if (!driver) {
    const { select } = await import("@inquirer/prompts");

    driver = await select({
      message: "Select database driver:",
      choices: ALL_DRIVERS.map((d) => ({ name: d, value: d })),
    });
  }

  if (!ALL_DRIVERS.includes(driver)) {
    throw new Error(
      `Unknown driver: ${driver}. Valid drivers: ${ALL_DRIVERS.join(", ")}`,
    );
  }

  const directory = resolve(process.cwd(), options.directory ?? "./src/proteus");
  const isSql = SQL_DRIVERS.includes(driver);

  const files: Array<{ path: string; content: string }> = [
    { path: join(directory, "source.ts"), content: sourceTemplate(driver, isSql) },
    { path: join(directory, "entities", ".gitkeep"), content: "" },
  ];

  if (isSql) {
    files.push({ path: join(directory, "migrations", ".gitkeep"), content: "" });
  }

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

  Logger.std.info(`Initialized Proteus project (${driver}):`);
  Logger.std.log(`  ${join(directory, "source.ts")}`);
  Logger.std.log(`  ${join(directory, "entities/")}`);

  if (isSql) {
    Logger.std.log(`  ${join(directory, "migrations/")}`);
  }
};
