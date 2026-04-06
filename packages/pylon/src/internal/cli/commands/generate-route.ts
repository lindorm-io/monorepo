import { mkdir, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import { Logger } from "@lindorm/logger";

type GenerateRouteOptions = {
  directory?: string;
  dryRun?: boolean;
};

const urlToFilePath = (urlPath: string): string =>
  urlPath
    .replace(/^\//, "")
    .replace(/:([a-zA-Z]+)/g, "[$1]")
    .replace(/\*([a-zA-Z]+)/g, "[...$1]");

const relativePrefix = (depth: number): string => "../".repeat(depth);

const routeTemplate = (methods: Array<string>, depth: number): string => {
  const prefix = relativePrefix(depth);
  const lines = [
    `import { useHandler } from "@lindorm/pylon";`,
    `import type { ServerHttpMiddleware } from "${prefix}types/context";`,
    `// import { myHandler } from "${prefix}handlers/myHandler";`,
    ``,
  ];

  for (const method of methods) {
    lines.push(
      `export const ${method}: Array<ServerHttpMiddleware> = [`,
      `  // useHandler(myHandler),`,
      `];`,
      ``,
    );
  }

  return lines.join("\n");
};

export const generateRoute = async (
  methods: string | undefined,
  path: string | undefined,
  options: GenerateRouteOptions,
): Promise<void> => {
  if (!methods || !path) {
    const { input } = await import("@inquirer/prompts");

    if (!methods) {
      methods = await input({
        message: "HTTP methods (comma-separated, e.g. GET,POST):",
        validate: (v) => (v.trim().length > 0 ? true : "At least one method required"),
      });
    }

    if (!path) {
      path = await input({
        message: "URL path (e.g. /v1/users/:id):",
        validate: (v) => (v.startsWith("/") ? true : "Must start with /"),
      });
    }
  }

  const methodList = methods
    .split(",")
    .map((m) => m.trim().toUpperCase())
    .filter(Boolean);

  if (methodList.length === 0) {
    throw new Error("At least one HTTP method is required");
  }

  const directory = resolve(process.cwd(), options.directory ?? "./src/routes");
  const filePath = urlToFilePath(path);
  const segments = filePath.split("/");
  const lastSegment = segments.pop()!;

  const filename = lastSegment === "" ? "index.ts" : `${lastSegment}.ts`;
  const filepath = join(directory, ...segments, filename);
  const depth = segments.length + 1; // +1 for the routes/ dir itself
  const content = routeTemplate(methodList, depth);

  if (options.dryRun) {
    Logger.std.log(`\nDry run — would create:\n`);
    Logger.std.log(`  ${filepath}\n`);
    Logger.std.log(content);
    return;
  }

  await mkdir(dirname(filepath), { recursive: true });
  await writeFile(filepath, content, "utf-8");

  Logger.std.info(`Created route: ${filepath}`);
  Logger.std.log(`  Methods: ${methodList.join(", ")}`);
  Logger.std.log(`  URL: ${path}`);
};
