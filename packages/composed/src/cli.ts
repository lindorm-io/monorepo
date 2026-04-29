#!/usr/bin/env node

import { composed } from "./internal/utils/composed.js";
import { program } from "commander";

program
  .name("composed")
  .description("Run a command with docker compose services")
  .argument("<command>", "command to run")
  .argument("[args...]", "arguments for the command")
  .passThroughOptions()
  .allowUnknownOption()
  .option("-f, --file <path>", "compose file path")
  .option("-v, --verbose", "verbose output", false)
  .option("--build", "pass --build to docker compose up", false)
  .option("--no-teardown", "skip docker compose down after command")
  .option(
    "-w, --wait-timeout <seconds>",
    "timeout for --wait in seconds",
    (v) => {
      const n = parseInt(v, 10);
      if (Number.isNaN(n) || n < 0) {
        console.error("Error: --wait-timeout must be a non-negative number");
        process.exit(1);
      }
      return n;
    },
    60,
  )
  .action(async (command: string, args: Array<string>, options) => {
    const teardown = options.teardown && process.env.COMPOSED_NO_TEARDOWN !== "1";

    const exitCode = await composed({
      file: options.file ?? "",
      verbose: options.verbose,
      build: options.build,
      teardown,
      waitTimeout: options.waitTimeout,
      command,
      commandArgs: args,
    });

    process.exit(exitCode);
  });

program.parse();
