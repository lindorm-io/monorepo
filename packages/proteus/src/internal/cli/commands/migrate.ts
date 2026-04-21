import type { Command } from "commander";
import { migrateGenerate } from "./migrate-generate.js";
import { migrateRun } from "./migrate-run.js";
import { migrateRollback } from "./migrate-rollback.js";
import { migrateStatus } from "./migrate-status.js";
import { migrateBaseline } from "./migrate-baseline.js";
import { migrateCreate } from "./migrate-create.js";
import { migrateResolve } from "./migrate-resolve.js";

export const registerMigrateCommands = (program: Command): void => {
  const migrate = program.command("migrate").description("Migration management commands");

  migrate
    .command("generate")
    .description("Generate a migration file from schema diff")
    .option(
      "-s, --source <path>",
      "Path to source file exporting ProteusSource",
      "./proteus.config.ts",
    )
    .option("-e, --export <name>", "Named export to select")
    .option("-v, --verbose", "Debug-level logging")
    .option("-n, --name <name>", "Migration name slug", "generated")
    .option("-d, --directory <path>", "Output directory (overrides config)")
    .option("--dry-run", "Print content to stdout, don't write")
    .option("-i, --interactive", "Interactive mode: entity select, preview, name prompt")
    .action(migrateGenerate);

  migrate
    .command("run")
    .description("Apply all pending migrations")
    .option(
      "-s, --source <path>",
      "Path to source file exporting ProteusSource",
      "./proteus.config.ts",
    )
    .option("-e, --export <name>", "Named export to select")
    .option("-v, --verbose", "Debug-level logging")
    .action(migrateRun);

  migrate
    .command("rollback")
    .description("Roll back the last N applied migrations")
    .option(
      "-s, --source <path>",
      "Path to source file exporting ProteusSource",
      "./proteus.config.ts",
    )
    .option("-e, --export <name>", "Named export to select")
    .option("-v, --verbose", "Debug-level logging")
    .option("-c, --count <n>", "Number of migrations to roll back", "1")
    .action(migrateRollback);

  migrate
    .command("status")
    .description("Show status of all known migrations")
    .option(
      "-s, --source <path>",
      "Path to source file exporting ProteusSource",
      "./proteus.config.ts",
    )
    .option("-e, --export <name>", "Named export to select")
    .option("-v, --verbose", "Debug-level logging")
    .action(migrateStatus);

  migrate
    .command("baseline")
    .description("Generate a baseline migration capturing the full schema")
    .option(
      "-s, --source <path>",
      "Path to source file exporting ProteusSource",
      "./proteus.config.ts",
    )
    .option("-e, --export <name>", "Named export to select")
    .option("-v, --verbose", "Debug-level logging")
    .option("-n, --name <name>", "Baseline name slug", "baseline")
    .option("-d, --directory <path>", "Output directory (overrides config)")
    .action(migrateBaseline);

  migrate
    .command("create")
    .description("Create a blank migration file with empty up/down stubs")
    .option(
      "-s, --source <path>",
      "Path to source file exporting ProteusSource",
      "./proteus.config.ts",
    )
    .option("-e, --export <name>", "Named export to select")
    .option("-v, --verbose", "Debug-level logging")
    .option("-d, --directory <path>", "Output directory (overrides config)")
    .requiredOption("-n, --name <name>", "Migration name slug")
    .action(migrateCreate);

  migrate
    .command("resolve")
    .description("Mark a migration as applied or rolled-back without executing")
    .option(
      "-s, --source <path>",
      "Path to source file exporting ProteusSource",
      "./proteus.config.ts",
    )
    .option("-e, --export <name>", "Named export to select")
    .option("-v, --verbose", "Debug-level logging")
    .option("-a, --applied <name>", "Mark named migration as applied")
    .option("-r, --rolled-back <name>", "Mark named migration as rolled back")
    .action(migrateResolve);
};
