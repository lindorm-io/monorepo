export type {
  MigrationRunnerBase,
  MigrationRecord,
  MigrationApplyResult,
  MigrationStatus,
  MigrationInterface,
} from "#internal/types/migration";

export type MongoMigrationTableOptions = {
  table?: string;
};

export type MongoMigrationRunnerContext = {
  db: () => import("mongodb").Db;
  collection: (name: string) => import("mongodb").Collection;
  transaction: (fn: (ctx: MongoMigrationRunnerContext) => Promise<void>) => Promise<void>;
};
