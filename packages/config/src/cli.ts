#!/usr/bin/env node

import { Dict } from "@lindorm/types";
import { program } from "commander";
import { existsSync, readFileSync } from "fs";
import { load } from "js-yaml";
import { join } from "path";

program.name("config").description("CLI for managing configuration files");

const parseFile = (file: string): Dict => {
  if (file.endsWith(".json")) {
    return parseJson(file);
  }

  if (file.endsWith(".yml") || file.endsWith(".yaml")) {
    return parseYaml(file);
  }

  throw new Error("Unsupported file type");
};

const parseJson = (file: string): Dict => JSON.parse(readFileSync(file, "utf-8")) as Dict;

const parseYaml = (file: string): Dict => load(readFileSync(file, "utf-8")) as Dict;

program
  .command("node_config")
  .description(
    "Generate a NODE_CONFIG environment string from existing .node_config file",
  )
  .option(
    "-f, --file <file>",
    "Path to the .node_config(?.json|yml|yaml) file",
    ".node_config",
  )
  .action((options) => {
    try {
      if (
        options.file !== ".node_config" &&
        !existsSync(join(process.cwd(), options.file))
      ) {
        throw new Error(
          `File ${options.file} does not exist. Please provide a valid path to a .node_config file.`,
        );
      }

      let file: string = options.file;
      let result: string = "";

      if (existsSync(join(process.cwd(), options.file))) {
        file = options.file;
      } else if (existsSync(join(process.cwd(), ".node_config.json"))) {
        file = join(process.cwd(), ".node_config.json");
      } else if (existsSync(join(process.cwd(), ".node_config.yml"))) {
        file = join(process.cwd(), ".node_config.yml");
      } else if (existsSync(join(process.cwd(), ".node_config.yaml"))) {
        file = join(process.cwd(), ".node_config.yaml");
      } else {
        throw new Error(
          "No .node_config file found. Please provide a valid path to a .node_config file.",
        );
      }

      result = JSON.stringify(parseFile(file)).replace(/'/g, "'\\''");

      console.log(`\nInsert the following into your env:\n\nNODE_CONFIG='${result}'\n`);
    } catch (error: any) {
      console.error(error.message);
      process.exit(1);
    }
  });

program.parse();
