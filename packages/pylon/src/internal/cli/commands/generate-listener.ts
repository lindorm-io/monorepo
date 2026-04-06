import { mkdir, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import { Logger } from "@lindorm/logger";

type GenerateListenerOptions = {
  directory?: string;
  dryRun?: boolean;
};

const VALID_BINDINGS = ["ON", "ONCE"];

const eventToFilePath = (event: string): string =>
  event.replace(/\[([a-zA-Z]+)\]/g, "[$1]").replace(/:/g, "/");

const relativePrefix = (depth: number): string => "../".repeat(depth);

const listenerTemplate = (bindings: Array<string>, depth: number): string => {
  const prefix = relativePrefix(depth);
  const lines = [
    `import type { ServerSocketMiddleware } from "${prefix}types/context";`,
    ``,
  ];

  for (const binding of bindings) {
    lines.push(
      `export const ${binding}: Array<ServerSocketMiddleware> = [`,
      `  // TODO: implement`,
      `];`,
      ``,
    );
  }

  return lines.join("\n");
};

export const generateListener = async (
  bindings: string | undefined,
  event: string | undefined,
  options: GenerateListenerOptions,
): Promise<void> => {
  if (!bindings || !event) {
    const { input } = await import("@inquirer/prompts");

    if (!bindings) {
      bindings = await input({
        message: "Bindings (comma-separated, e.g. ON or ON,ONCE):",
        validate: (v) => (v.trim().length > 0 ? true : "At least one binding required"),
      });
    }

    if (!event) {
      event = await input({
        message: "Event name (colon-separated, e.g. chat:message):",
        validate: (v) => (v.trim().length > 0 ? true : "Event name required"),
      });
    }
  }

  const bindingList = bindings
    .split(",")
    .map((b) => b.trim().toUpperCase())
    .filter(Boolean);

  if (bindingList.length === 0) {
    throw new Error("At least one binding is required");
  }

  for (const b of bindingList) {
    if (!VALID_BINDINGS.includes(b)) {
      throw new Error(
        `Invalid binding: ${b}. Valid bindings: ${VALID_BINDINGS.join(", ")}`,
      );
    }
  }

  const directory = resolve(process.cwd(), options.directory ?? "./src/listeners");
  const filePath = eventToFilePath(event);
  const segments = filePath.split("/");
  const depth = segments.length; // listeners/ is 1 level from src/
  const filepath = join(directory, `${filePath}.ts`);
  const content = listenerTemplate(bindingList, depth);

  if (options.dryRun) {
    Logger.std.log(`\nDry run — would create:\n`);
    Logger.std.log(`  ${filepath}\n`);
    Logger.std.log(content);
    return;
  }

  await mkdir(dirname(filepath), { recursive: true });
  await writeFile(filepath, content, "utf-8");

  Logger.std.info(`Created listener: ${filepath}`);
  Logger.std.log(`  Event: ${event}`);
  Logger.std.log(`  Bindings: ${bindingList.join(", ")}`);
};
