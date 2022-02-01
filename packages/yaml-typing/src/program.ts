#!/usr/bin/env node

import { program } from "commander";
import { yamlTyping } from "./yaml-typing";

program
  .option("-f, --file <file>", "[REQUIRED] file (and type) name")
  .option("-h, --help", "help")
  .option("-e, --require <require>", "[OPTIONAL] set all types as required")
  .option("-o, --root <root>", "[OPTIONAL] root directory")
  .option("-r, --read <read>", "[OPTIONAL] read directory")
  .option("-w, --write <write>", "[OPTIONAL] write directory");

program.parse();

const options = program.opts();

if (options.help) {
  program.help();
  process.exit(0);
}

if (!options.file) {
  program.help();
  console.error("-f, --file <file> is [REQUIRED]");
  process.exit(1);
}

yamlTyping(options.file, {
  read: options.read,
  requireAll: options.require ? JSON.parse(options.require) : undefined,
  root: options.root,
  write: options.write,
})
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
