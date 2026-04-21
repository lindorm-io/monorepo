/**
 * Re-export migration types from shared location.
 */
export type {
  MigrationInterface,
  MigrationRunnerBase,
  SqlMigrationContext,
  SqlMigrationInterface,
  SqlMigrationRunner,
  // Backwards compatibility aliases
  SqlMigrationContext as MigrationQueryContext,
  SqlMigrationRunner as MigrationQueryRunner,
} from "../internal/types/migration.js";
