import type { Command } from "commander";
import { generateDto } from "./generate-dto";

export const registerGenerateCommands = (program: Command): void => {
  const generate = program
    .command("generate")
    .alias("g")
    .description("Code generation commands");

  generate
    .command("command")
    .alias("c")
    .description("Generate a command file with Hermes decorator")
    .argument("[name]", "Command name in PascalCase")
    .option("-d, --directory <path>", "Output directory", "./src/hermes/commands")
    .option("--dry-run", "Show what would be created without writing files")
    .action(generateDto("command"));

  generate
    .command("query")
    .alias("q")
    .description("Generate a query file with Hermes decorator")
    .argument("[name]", "Query name in PascalCase")
    .option("-d, --directory <path>", "Output directory", "./src/hermes/queries")
    .option("--dry-run", "Show what would be created without writing files")
    .action(generateDto("query"));

  generate
    .command("event")
    .alias("e")
    .description("Generate an event file with Hermes decorator")
    .argument("[name]", "Event name in PascalCase")
    .option("-d, --directory <path>", "Output directory", "./src/hermes/events")
    .option("--dry-run", "Show what would be created without writing files")
    .action(generateDto("event"));

  generate
    .command("timeout")
    .alias("t")
    .description("Generate a timeout file with Hermes decorator")
    .argument("[name]", "Timeout name in PascalCase")
    .option("-d, --directory <path>", "Output directory", "./src/hermes/timeouts")
    .option("--dry-run", "Show what would be created without writing files")
    .action(generateDto("timeout"));

  generate
    .command("aggregate")
    .alias("a")
    .description("Generate an aggregate file with Hermes decorator")
    .argument("[name]", "Aggregate name in PascalCase")
    .option("-d, --directory <path>", "Output directory", "./src/hermes/aggregates")
    .option("--dry-run", "Show what would be created without writing files")
    .action(generateDto("aggregate"));

  generate
    .command("saga")
    .alias("s")
    .description("Generate a saga file with Hermes decorator")
    .argument("[name]", "Saga name in PascalCase")
    .option("-d, --directory <path>", "Output directory", "./src/hermes/sagas")
    .option("--dry-run", "Show what would be created without writing files")
    .action(generateDto("saga"));

  generate
    .command("view")
    .alias("v")
    .description("Generate a view file with Hermes decorator")
    .argument("[name]", "View name in PascalCase")
    .option("-d, --directory <path>", "Output directory", "./src/hermes/views")
    .option("--dry-run", "Show what would be created without writing files")
    .action(generateDto("view"));
};
