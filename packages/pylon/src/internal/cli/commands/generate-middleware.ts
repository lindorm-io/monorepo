import { mkdir, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import { Logger } from "@lindorm/logger";

type GenerateMiddlewareOptions = {
  directory?: string;
  socket?: boolean;
  dryRun?: boolean;
};

const relativePrefix = (depth: number): string => "../".repeat(depth);

const middlewareTemplate = (socket: boolean, depth: number): string => {
  const type = socket ? "ServerSocketMiddleware" : "ServerHttpMiddleware";
  const prefix = relativePrefix(depth);

  return [
    `import type { ${type} } from "${prefix}types/context";`,
    ``,
    `const middleware: ${type} = async (ctx, next) => {`,
    `  // TODO: implement`,
    `  await next();`,
    `};`,
    ``,
    `export const MIDDLEWARE = [middleware];`,
    ``,
  ].join("\n");
};

export const generateMiddleware = async (
  path: string | undefined,
  options: GenerateMiddlewareOptions,
): Promise<void> => {
  if (!path) {
    const { input } = await import("@inquirer/prompts");

    path = await input({
      message: "Path (e.g. /v1/admin or chat):",
      validate: (v) => (v.trim().length > 0 ? true : "Path required"),
    });
  }

  const isSocket = !!options.socket;
  const defaultDir = isSocket ? "./src/listeners" : "./src/routes";
  const directory = resolve(process.cwd(), options.directory ?? defaultDir);
  const cleanPath = path.replace(/^\//, "");
  const segments = cleanPath.split("/").filter(Boolean);
  const depth = segments.length + 1; // +1 for the routes/ or listeners/ dir
  const filepath = join(directory, cleanPath, "_middleware.ts");
  const content = middlewareTemplate(isSocket, depth);

  if (options.dryRun) {
    Logger.std.log(`\nDry run — would create:\n`);
    Logger.std.log(`  ${filepath}\n`);
    Logger.std.log(content);
    return;
  }

  await mkdir(dirname(filepath), { recursive: true });
  await writeFile(filepath, content, "utf-8");

  Logger.std.info(`Created middleware: ${filepath}`);
  Logger.std.log(`  Type: ${isSocket ? "socket" : "http"}`);
};
