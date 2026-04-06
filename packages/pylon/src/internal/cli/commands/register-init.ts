import type { Command } from "commander";
import { init } from "./init";

export const registerInitCommand = (program: Command): void => {
  program
    .command("init")
    .alias("i")
    .description("Initialize a Pylon project")
    .option("-d, --directory <path>", "Output directory", ".")
    .option("--dry-run", "Show what would be created without writing files")
    .action(init);
};
