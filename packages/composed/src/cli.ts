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
  .option(
    "-p, --project <name>",
    "docker compose project name (isolates volumes/containers)",
  )
  .option("-v, --verbose", "verbose output", false)
  .option("-b, --build", "pass --build to docker compose up", false)
  .option(
    "-r, --reuse",
    "attach to an already-running stack when all required host ports are served (implies no teardown); fail fast on a partial port conflict",
    false,
  )
  .option("-T, --no-teardown", "skip docker compose down after command")
  .option("-k, --keep-volumes", "keep named volumes on teardown (skip --volumes)", false)
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
      project: options.project ?? "",
      verbose: options.verbose,
      build: options.build,
      teardown,
      keepVolumes: options.keepVolumes,
      reuse: options.reuse,
      waitTimeout: options.waitTimeout,
      command,
      commandArgs: args,
    });

    process.exit(exitCode);
  });

program.parse();
