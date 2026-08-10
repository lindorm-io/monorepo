#!/usr/bin/env node

import { pascalCase } from "@lindorm/case";
import { isArray, isError, isString } from "@lindorm/is";
import { Command } from "commander";
import { realpathSync } from "fs";
import { pathToFileURL } from "url";
import { typewriter } from "./utils/index.js";
import { absolutePath, isTypewriterOutput } from "./internal/index.js";

export const run = async (argv: Array<string>): Promise<void> => {
  const program = new Command();

  program
    .name("typewriter")
    .description("CLI for generating TypeScript types from JSON and YAML files")
    .option<Array<string>>(
      "-f, --files <paths>",
      "input file(s) path (comma separated)",
      (v) => v.split(","),
    )
    .option(
      "-o, --output <type>",
      "output type (typescript or typescript-zod)",
      "typescript",
    )
    .option("-n, --name <name>", "type name to generate")
    .option("-w, --write <directory>", "directory to write generated type")
    .option("-v, --verbose", "enable verbose logging", false);

  program.parse(argv);

  const options = program.opts();

  if (!isArray<string>(options.files)) {
    throw new Error(
      "Please provide either a file or a directory path. Use typewriter --help for more info",
    );
  }

  const output = isString(options.output) ? options.output.toLowerCase() : undefined;

  if (!isTypewriterOutput(output)) {
    throw new Error(
      `Output type must be one of: typescript, typescript-zod. Received: ${options.output}. Use typewriter --help for more info`,
    );
  }

  if (!isString(options.name)) {
    throw new Error(
      "Please provide a type name to generate. Use typewriter --help for more info",
    );
  }

  if (!isString(options.write)) {
    throw new Error(
      "Please provide a directory to write the generated type. Use typewriter --help for more info",
    );
  }

  const input = options.files.map(absolutePath);
  const typeName = pascalCase(options.name);
  const verbose = options.verbose ?? false;
  const writeToDirectory = absolutePath(options.write);

  await typewriter({
    input,
    logger: verbose ? { level: "verbose", readable: true } : undefined,
    output,
    typeName,
    writeToDirectory,
  });

  console.log("Typewriter successful", { typeName, input, writeToDirectory });
};

const invokedAs = process.argv[1]
  ? pathToFileURL(realpathSync(process.argv[1])).href
  : "";

if (import.meta.url === invokedAs) {
  run(process.argv)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(isError(error) ? error.message : error);
      process.exit(1);
    });
}
