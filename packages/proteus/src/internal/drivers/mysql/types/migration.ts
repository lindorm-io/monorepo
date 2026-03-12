export type {
  MigrationRunnerBase,
  SqlMigrationContext,
  SqlMigrationRunner,
  MigrationRecord,
  MigrationApplyResult,
  MigrationStatus,
  MigrationTableOptions as MysqlMigrationTableOptions,
  SqlMigrationInterface as MigrationInterface,
} from "#internal/types/migration";

// Re-export as the names this file historically used
export type {
  SqlMigrationContext as MigrationQueryContext,
  SqlMigrationRunner as MigrationQueryRunner,
} from "#internal/types/migration";

// MySQL-specific: LoadedMigration references the shared SqlMigrationInterface
export type LoadedMigration = {
  migration: import("#internal/types/migration").SqlMigrationInterface;
  name: string;
};
