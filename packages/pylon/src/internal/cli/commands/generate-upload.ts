import { Logger } from "@lindorm/logger";
import { mkdir, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import { resolveRouteFile } from "./resolve-route-file.js";

type GenerateUploadOptions = {
  directory?: string;
  dryRun?: boolean;
};

const uploadTemplate = (): string => {
  return [
    `import { useUpload } from "@lindorm/pylon";`,
    `import { join } from "path";`,
    ``,
    `const root = join(__dirname, "..", "uploads");`,
    ``,
    `export const UPLOAD = useUpload({ root });`,
    ``,
  ].join("\n");
};

export const generateUpload = async (
  path: string | undefined,
  options: GenerateUploadOptions,
): Promise<void> => {
  if (!path) {
    const { input } = await import("@inquirer/prompts");

    path = await input({
      message: "URL path (e.g. /assets):",
      validate: (v) => (v.startsWith("/") ? true : "Must start with /"),
    });
  }

  const directory = resolve(process.cwd(), options.directory ?? "./src/routes");
  const { filepath } = resolveRouteFile(path, directory);
  const content = uploadTemplate();

  if (options.dryRun) {
    Logger.std.log(`\nDry run — would create:\n`);
    Logger.std.log(`  ${filepath}\n`);
    Logger.std.log(content);
    return;
  }

  await mkdir(dirname(filepath), { recursive: true });
  await writeFile(filepath, content, "utf-8");

  Logger.std.info(`Created upload route: ${filepath}`);
  Logger.std.log(`  URL: ${path}`);
};
