import { kebabCase, pascalCase } from "@lindorm/case";
import { Logger } from "@lindorm/logger";
import { mkdir, writeFile } from "fs/promises";
import { dirname, join, relative, resolve } from "path";
import { resolveRouteFile } from "./resolve-route-file.js";

type GenerateRouteFeatureOptions = {
  feature: string;
  methodList: Array<string>;
  path: string;
  routesDir: string;
  featureDir: string;
  dryRun?: boolean;
};

const VERB_BY_METHOD: Record<string, string> = {
  GET: "get",
  POST: "create",
  PUT: "update",
  PATCH: "patch",
  DELETE: "delete",
};

// Route exports are emitted in canonical HTTP order regardless of input order.
const METHOD_ORDER = ["GET", "POST", "PUT", "PATCH", "DELETE"];

type MethodEntry = {
  method: string;
  handlerName: string;
  schemaName: string;
  handlerFileAbs: string;
};

// Turn an absolute target file into a relative ESM import specifier from a directory.
const toImport = (fromDir: string, toFileAbs: string): string => {
  let rel = relative(fromDir, toFileAbs).replaceAll("\\", "/");
  rel = rel.replace(/\.ts$/, ".js");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
};

const handlerTemplate = (
  schemaName: string,
  handlerName: string,
  handlerCtxImport: string,
): string =>
  [
    `import { z } from "zod";`,
    `import type { ServerHandler } from "${handlerCtxImport}";`,
    ``,
    `export const ${schemaName} = z.object({`,
    `  // TODO: define the request schema`,
    `});`,
    ``,
    `export const ${handlerName}: ServerHandler<typeof ${schemaName}> = async (ctx) => {`,
    `  // TODO: implement`,
    `  return { body: {} };`,
    `};`,
    ``,
  ].join("\n");

const routeTemplate = (
  entries: Array<MethodEntry>,
  routeFileAbs: string,
  routeCtxImport: string,
): string => {
  const lines = [
    `import { useHandler, useSchema } from "@lindorm/pylon";`,
    `import type { ServerHttpMiddleware } from "${routeCtxImport}";`,
  ];

  for (const entry of entries) {
    const handlerImport = toImport(dirname(routeFileAbs), entry.handlerFileAbs);
    lines.push(
      `import { ${entry.handlerName}, ${entry.schemaName} } from "${handlerImport}";`,
    );
  }

  lines.push(``);

  for (const entry of entries) {
    lines.push(
      `export const ${entry.method}: Array<ServerHttpMiddleware> = [`,
      `  useSchema(${entry.schemaName}),`,
      `  useHandler(${entry.handlerName}),`,
      `];`,
      ``,
    );
  }

  return lines.join("\n");
};

export const generateRouteFeature = async (
  options: GenerateRouteFeatureOptions,
): Promise<void> => {
  const { feature, methodList, path, routesDir, featureDir, dryRun } = options;

  const featureKebab = kebabCase(feature);
  const featurePascal = pascalCase(feature);

  // Assumes types/context.ts sits at the src root = the PARENT of the feature/routes
  // dir (the standard src/features + src/routes + src/types layout, and the config
  // default). Resolved relative to each dir's parent so nesting stays correct.
  const handlerCtxTargetByDir = (fromDir: string): string =>
    toImport(fromDir, resolve(dirname(featureDir), "types", "context.ts"));

  const entries: Array<MethodEntry> = methodList
    .slice()
    .sort((a, b) => METHOD_ORDER.indexOf(a) - METHOD_ORDER.indexOf(b))
    .map((method) => {
      const verb = VERB_BY_METHOD[method];

      if (!verb) {
        throw new Error(
          `Unsupported HTTP method "${method}" — expected one of ${Object.keys(
            VERB_BY_METHOD,
          ).join(", ")}`,
        );
      }

      const handlerName = verb + featurePascal;
      const schemaName = handlerName + "Schema";
      const handlerFileAbs = join(
        featureDir,
        featureKebab,
        kebabCase(handlerName) + ".ts",
      );

      return { method, handlerName, schemaName, handlerFileAbs };
    });

  const { filepath: routeFileAbs } = resolveRouteFile(path, routesDir);
  const routeCtxImport = toImport(
    dirname(routeFileAbs),
    resolve(dirname(routesDir), "types", "context.ts"),
  );
  const routeContent = routeTemplate(entries, routeFileAbs, routeCtxImport);

  const files: Array<{ filepath: string; content: string }> = entries.map((entry) => ({
    filepath: entry.handlerFileAbs,
    content: handlerTemplate(
      entry.schemaName,
      entry.handlerName,
      handlerCtxTargetByDir(dirname(entry.handlerFileAbs)),
    ),
  }));

  files.push({ filepath: routeFileAbs, content: routeContent });

  if (dryRun) {
    Logger.std.log(`\nDry run — would create:\n`);

    for (const file of files) {
      Logger.std.log(`  ${file.filepath}\n`);
      Logger.std.log(file.content);
    }

    return;
  }

  for (const file of files) {
    await mkdir(dirname(file.filepath), { recursive: true });
    await writeFile(file.filepath, file.content, "utf-8");
  }

  Logger.std.info(`Created feature route: ${feature}`);
  Logger.std.log(`  Methods: ${entries.map((e) => e.method).join(", ")}`);
  Logger.std.log(`  URL: ${path}`);
  Logger.std.log(`  Route: ${routeFileAbs}`);

  for (const entry of entries) {
    Logger.std.log(`  Handler: ${entry.handlerFileAbs}`);
  }
};
