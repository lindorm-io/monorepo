#!/usr/bin/env node

import { pascalCase } from "@lindorm/case";
import { isArray, isString } from "@lindorm/is";
import { program } from "commander";
import { TypewriterOutput } from "./types";
import { typewriter } from "./utils";
import { absolutePath } from "./utils/private";

program
  .name("typewriter")
  .description("CLI for generating TypeScript types from JSON and YAML files");

program
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

program.parse();

const options = program.opts();

if (!isArray<string>(options.files)) {
  console.error(
    "Please provide either a file or a directory path. Use typewriter --help for more info",
  );
  process.exit(1);
}

if (!isString<TypewriterOutput>(options.output)) {
  console.error(
    "Please provide an output type (typescript or typescript-zod). Use typewriter --help for more info",
  );
  process.exit(1);
}

if (!isString(options.name)) {
  console.error(
    "Please provide a type name to generate. Use typewriter --help for more info",
  );
  process.exit(1);
}

if (!isString(options.write)) {
  console.error(
    "Please provide a directory to write the generated type. Use typewriter --help for more info",
  );
  process.exit(1);
}

const input = options.files.map(absolutePath);
const output = options.output.toLowerCase() as "typescript" | "typescript-zod";
const typeName = pascalCase(options.name);
const verbose = options.verbose ?? false;
const writeToDirectory = absolutePath(options.write);

typewriter({
  input,
  logger: verbose ? { level: "verbose", readable: true } : undefined,
  output,
  typeName,
  writeToDirectory,
})
  .then(() => {
    console.log("Typewriter successful", { typeName, input, writeToDirectory });
    process.exit(0);
  })
  .catch((error) => {
    console.error("Typewriter error", error);
    process.exit(1);
  });
