import type { Command } from "commander";
import { generateRoute } from "./generate-route.js";
import { generateListener } from "./generate-listener.js";
import { generateMiddleware } from "./generate-middleware.js";
import { generateHandler } from "./generate-handler.js";
import { generateWorker } from "./generate-worker.js";
import { generateStatic } from "./generate-static.js";
import { generateUpload } from "./generate-upload.js";

export const registerGenerateCommands = (program: Command): void => {
  const generate = program
    .command("generate")
    .alias("g")
    .description("Code generation commands");

  generate
    .command("route")
    .alias("r")
    .description(
      "Generate a route file with HTTP method exports (or, with --feature, a full slice: per-method schema+handler files + a wired route)",
    )
    .argument("[methods]", "HTTP methods, comma-separated (e.g. GET,POST)")
    .argument("[path]", "URL path (e.g. /v1/users/:id)")
    .option("-d, --directory <path>", "Output directory (defaults from lindorm.config)")
    .option(
      "-f, --feature <name>",
      "Feature name; scaffolds per-method schema+handler files + a wired route",
    )
    .option(
      "-m, --methods <list>",
      "HTTP methods, comma-separated (alt to the positional arg)",
    )
    .option("-p, --path <path>", "URL path (alt to the positional arg)")
    .option("--dry-run", "Show what would be created without writing files")
    .action(generateRoute);

  generate
    .command("listener")
    .alias("l")
    .description("Generate a socket listener file")
    .argument("[bindings]", "Bindings, comma-separated (e.g. ON or ON,ONCE)")
    .argument("[event]", "Event name, colon-separated (e.g. chat:message)")
    .option("-d, --directory <path>", "Output directory (defaults from lindorm.config)")
    .option("--dry-run", "Show what would be created without writing files")
    .action(generateListener);

  generate
    .command("middleware")
    .alias("m")
    .description("Generate a _middleware.ts file")
    .argument("[path]", "Path (e.g. /v1/admin or chat)")
    .option("-d, --directory <path>", "Output directory")
    .option("-S, --socket", "Generate socket middleware (default: HTTP)")
    .option("--dry-run", "Show what would be created without writing files")
    .action(generateMiddleware);

  generate
    .command("handler")
    .alias("h")
    .description("Generate a handler file with schema")
    .argument("[name]", "Handler name (e.g. getUser)")
    .option("-d, --directory <path>", "Output directory (defaults from lindorm.config)")
    .option("--dry-run", "Show what would be created without writing files")
    .action(generateHandler);

  generate
    .command("worker")
    .alias("w")
    .description("Generate a worker file")
    .argument("[name]", "Worker name (e.g. HeartbeatWorker)")
    .option("-d, --directory <path>", "Output directory (defaults from lindorm.config)")
    .option("--dry-run", "Show what would be created without writing files")
    .action(generateWorker);

  generate
    .command("static")
    .alias("s")
    .description("Generate a STATIC route file (useStatic mount)")
    .argument("[path]", "URL path (e.g. /assets)")
    .option("-d, --directory <path>", "Output directory (defaults from lindorm.config)")
    .option("--dry-run", "Show what would be created without writing files")
    .action(generateStatic);

  generate
    .command("upload")
    .alias("u")
    .description("Generate an UPLOAD route file (useUpload mount)")
    .argument("[path]", "URL path (e.g. /assets)")
    .option("-d, --directory <path>", "Output directory (defaults from lindorm.config)")
    .option("--dry-run", "Show what would be created without writing files")
    .action(generateUpload);
};
