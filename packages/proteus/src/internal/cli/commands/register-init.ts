import type { Command } from "commander";
import { init } from "./init.js";

export const registerInitCommand = (program: Command): void => {
  program
    .command("init")
    .alias("i")
    .description("Initialize a Proteus source directory")
    .option(
      "-D, --driver <driver>",
      "Database driver (postgres, mysql, sqlite, redis, mongo, memory)",
    )
    .option("-d, --directory <path>", "Output directory", "./src/proteus")
    .option("--dry-run", "Show what would be created without writing files")
    .action(init);
};
