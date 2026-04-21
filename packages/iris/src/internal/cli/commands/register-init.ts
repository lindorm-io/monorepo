import type { Command } from "commander";
import { init } from "./init.js";

export const registerInitCommand = (program: Command): void => {
  program
    .command("init")
    .alias("i")
    .description("Initialize an Iris source directory")
    .option("-D, --driver <driver>", "Messaging driver (rabbit, kafka, nats, redis)")
    .option("-d, --directory <path>", "Output directory", "./src/iris")
    .option("--dry-run", "Show what would be created without writing files")
    .action(init);
};
