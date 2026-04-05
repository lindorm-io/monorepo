import type { Command } from "commander";
import { generateEntity } from "./generate-entity";

export const registerGenerateCommands = (program: Command): void => {
  const generate = program
    .command("generate")
    .alias("g")
    .description("Code generation commands");

  generate
    .command("entity")
    .alias("e")
    .description("Generate an entity file with Proteus decorators")
    .argument("[name]", "Entity name in PascalCase")
    .option("-d, --directory <path>", "Output directory", "./src/proteus/entities")
    .option("--dry-run", "Show what would be created without writing files")
    .action(generateEntity);
};
