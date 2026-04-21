import type { Command } from "commander";
import { dbPing } from "./db-ping.js";

export const registerDbCommands = (program: Command): void => {
  const db = program.command("db").description("Database diagnostic commands");

  db.command("ping")
    .description("Verify database connectivity")
    .option(
      "-s, --source <path>",
      "Path to source file exporting ProteusSource",
      "./proteus.config.ts",
    )
    .option("-e, --export <name>", "Named export to select")
    .action(dbPing);
};
