import type { Command } from "commander";
import { generateMessage } from "./generate-message.js";

export const registerGenerateCommands = (program: Command): void => {
  const generate = program
    .command("generate")
    .alias("g")
    .description("Code generation commands");

  generate
    .command("message")
    .alias("m")
    .description("Generate a message file with Iris decorators")
    .argument("[name]", "Message name in PascalCase")
    .option("-d, --directory <path>", "Output directory", "./src/iris/messages")
    .option("--dry-run", "Show what would be created without writing files")
    .action(generateMessage);
};
