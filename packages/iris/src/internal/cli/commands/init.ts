import { mkdir, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { Logger } from "@lindorm/logger";

const ALL_DRIVERS = ["rabbit", "kafka", "nats", "redis"];

type InitOptions = {
  driver?: string;
  directory?: string;
  dryRun?: boolean;
};

const sourceTemplate = (driver: string): string => {
  const lines = [
    `import { Logger } from "@lindorm/logger";`,
    `import { IrisSource } from "@lindorm/iris";`,
    ``,
    `export const source = new IrisSource({`,
    `  driver: "${driver}",`,
    `  logger: Logger.for("iris"),`,
  ];

  switch (driver) {
    case "rabbit":
      lines.push(`  url: "amqp://localhost:5672",`);
      break;
    case "kafka":
      lines.push(`  brokers: ["localhost:9092"],`);
      break;
    case "nats":
      lines.push(`  servers: "localhost:4222",`);
      break;
    case "redis":
      lines.push(`  url: "redis://localhost:6379",`);
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
      message: "Select messaging driver:",
      choices: ALL_DRIVERS.map((d) => ({ name: d, value: d })),
    });
  }

  if (!ALL_DRIVERS.includes(driver)) {
    throw new Error(
      `Unknown driver: ${driver}. Valid drivers: ${ALL_DRIVERS.join(", ")}`,
    );
  }

  const directory = resolve(process.cwd(), options.directory ?? "./src/iris");

  const files: Array<{ path: string; content: string }> = [
    { path: join(directory, "source.ts"), content: sourceTemplate(driver) },
    { path: join(directory, "messages", ".gitkeep"), content: "" },
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

  Logger.std.info(`Initialized Iris project (${driver}):`);
  Logger.std.log(`  ${join(directory, "source.ts")}`);
  Logger.std.log(`  ${join(directory, "messages/")}`);
};
