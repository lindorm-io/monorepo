#!/usr/bin/env node

// Polyfill Symbol.metadata for Stage 3 TC39 decorator support (Node.js < 27)
if (typeof Symbol.metadata === "undefined") {
  (Symbol as any).metadata = Symbol("Symbol.metadata");
}

import { readFileSync } from "fs";
import { resolve } from "path";
import { Command } from "commander";
import { registerInitCommand } from "#internal/cli/commands/register-init";
import { registerGenerateCommands } from "#internal/cli/commands/register-generate";

const pkg = JSON.parse(readFileSync(resolve(__dirname, "..", "package.json"), "utf-8"));

const program = new Command();

program
  .name("iris")
  .description("Iris messaging command-line tools")
  .version(pkg.version);

registerInitCommand(program);
registerGenerateCommands(program);

// Graceful shutdown: clean exit on first signal, force exit on second
let shuttingDown = false;

const onSignal = (signal: string): void => {
  if (shuttingDown) {
    console.error(`Received ${signal} again — forcing exit`);
    process.exit(1);
  }

  shuttingDown = true;
  console.error(`Shutdown signal received (${signal})`);
};

process.on("SIGTERM", () => onSignal("SIGTERM"));
process.on("SIGINT", () => onSignal("SIGINT"));

program.parseAsync().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
