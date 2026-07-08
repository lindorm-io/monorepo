import type { Command } from "commander";
import { configInit } from "./config-init.js";

export const registerConfigCommand = (program: Command): void => {
  const config = program.command("config").description("Configuration commands");

  config
    .command("init")
    .description("Create a default lindorm.config.ts in the current directory")
    .option("--dry-run", "Show what would be created without writing files")
    .option("-f, --force", "Overwrite an existing lindorm.config.ts")
    .action(configInit);
};
