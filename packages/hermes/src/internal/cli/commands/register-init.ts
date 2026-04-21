import type { Command } from "commander";
import { init } from "./init.js";

export const registerInitCommand = (program: Command): void => {
  program
    .command("init")
    .alias("i")
    .description("Initialize a Hermes source directory")
    .option("-d, --directory <path>", "Output directory", "./src/hermes")
    .option("--dry-run", "Show what would be created without writing files")
    .action(init);
};
