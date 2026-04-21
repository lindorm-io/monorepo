import { mkdir, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { Logger } from "@lindorm/logger";
import {
  generateSource,
  type GenerateSourceOptions,
  IRIS_ALL_DRIVERS,
} from "./generate-source.js";

export type WriteSourceOptions = GenerateSourceOptions & {
  directory: string;
  dryRun?: boolean;
};

export const writeSource = async (options: WriteSourceOptions): Promise<void> => {
  const { driver, directory, dryRun, loggerImport } = options;

  if (!IRIS_ALL_DRIVERS.includes(driver)) {
    throw new Error(
      `Unknown driver: ${driver}. Valid drivers: ${IRIS_ALL_DRIVERS.join(", ")}`,
    );
  }

  const resolvedDirectory = resolve(process.cwd(), directory);

  const files: Array<{ path: string; content: string }> = [
    {
      path: join(resolvedDirectory, "source.ts"),
      content: generateSource({ driver, loggerImport }),
    },
    { path: join(resolvedDirectory, "messages", ".gitkeep"), content: "" },
  ];

  if (dryRun) {
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
  Logger.std.log(`  ${join(resolvedDirectory, "source.ts")}`);
  Logger.std.log(`  ${join(resolvedDirectory, "messages/")}`);
};
