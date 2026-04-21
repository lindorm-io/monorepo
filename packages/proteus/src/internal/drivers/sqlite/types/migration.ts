export type {
  MigrationRunnerBase,
  SqlMigrationContext,
  SqlMigrationRunner,
  MigrationRecord,
  MigrationApplyResult,
  MigrationStatus,
  MigrationTableOptions as SqliteMigrationTableOptions,
  SqlMigrationInterface as MigrationInterface,
} from "../../../types/migration.js";

// Re-export as the names this file historically used
export type {
  SqlMigrationContext as MigrationQueryContext,
  SqlMigrationRunner as MigrationQueryRunner,
} from "../../../types/migration.js";

// SQLite-specific: LoadedMigration references the shared SqlMigrationInterface
export type LoadedMigration = {
  migration: import("../../../types/migration.js").SqlMigrationInterface;
  name: string;
};
